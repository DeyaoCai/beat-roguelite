using System.IO.Compression;
using CUE4Parse.Compression;
using CUE4Parse.Encryption.Aes;
using CUE4Parse.FileProvider;
using CUE4Parse.UE4.Assets.Exports;
using CUE4Parse.UE4.Assets.Exports.Animation;
using CUE4Parse.UE4.Assets.Exports.Engine;
using CUE4Parse.UE4.Assets.Exports.SkeletalMesh;
using CUE4Parse.UE4.Assets.Exports.StaticMesh;
using CUE4Parse.UE4.Assets.Exports.Texture;
using CUE4Parse.UE4.Assets.Objects;
using CUE4Parse.UE4.Assets.Objects.Properties;
using CUE4Parse.UE4.Objects.Core.Math;
using CUE4Parse.UE4.Objects.Core.Misc;
using CUE4Parse.UE4.Objects.Engine;
using CUE4Parse.UE4.Objects.UObject;
using CUE4Parse.UE4.Versions;
using CUE4Parse_Conversion;
using CUE4Parse_Conversion.Meshes;
using CUE4Parse_Conversion.Textures;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SharpCompress.Archives;
using SharpCompress.Common;
using SkiaSharp;

namespace TkaImport;

internal static class Program
{
    static int Main(string[] args)
    {
        var inbox = DefaultInbox();
        var output = Path.Combine("..", "co_der-resource", "beat-roguelite", "figures", "tka-jodi", "models");
        var game = EGame.GAME_UE4_27;
        string? aes = null;
        var inspectOnly = false;
        var importAll = false;
        var force = false;
        var listGameAnims = false;
        var gameAnims = false;
        string? only = null;
        const long defaultMaxBytes = 150L * 1024 * 1024;

        for (var i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--in":
                    inbox = args[++i];
                    break;
                case "--out":
                    output = args[++i];
                    break;
                case "--game":
                    game = Enum.Parse<EGame>(args[++i], ignoreCase: true);
                    break;
                case "--aes":
                    aes = args[++i];
                    break;
                case "--inspect":
                    inspectOnly = true;
                    break;
                case "--all":
                    importAll = true;
                    break;
                case "--force":
                    force = true;
                    break;
                case "--only":
                    only = args[++i];
                    break;
                case "--list-game-anims":
                    listGameAnims = true;
                    break;
                case "--game-anims":
                    gameAnims = true;
                    break;
                case "-h":
                case "--help":
                    Console.WriteLine("""
                        tka-import — 解压模组包 → 挂载 pak → 导出 glb/png + 原始 DataTable

                          --in      下载目录（zip/7z/rar/pak）。默认：Vortex TKA 下载目录（若存在），否则 inbox
                          --out     网页模型目录，默认 ../co_der-resource/beat-roguelite/figures/tka-jodi/models
                          --game    UE 版本枚举，默认 GAME_UE4_27
                          --aes     正包 AES。省略时读 TKA_AES，再扫本机 Shipping.exe（AESDumpster 同款）
                          --all     也导入超过 150MB 的包（地图等）
                          --force   忽略缓存，整包重导
                          --only    只处理文件名包含该字符串的包（例：Lips）
                          --inspect 只挂载并列出 pak 内文件，不导出
                          --list-game-anims  列出正包里文件名像走路/待机/开火的 AnimSequence 路径
                          --game-anims       从正包导出那些动作到 ../co_der-resource/beat-roguelite/figures/tka-jodi/models/TKA_Anim
                          写出 tables.json（原表）与 files.json（资源清单）。槽位/化妆语义在网页 catalog。
                        """);
                    return 0;
            }
        }

        inbox = Path.GetFullPath(inbox);
        output = Path.GetFullPath(output);
        Directory.CreateDirectory(inbox);
        Directory.CreateDirectory(output);
        if (string.IsNullOrWhiteSpace(aes))
            aes = Environment.GetEnvironmentVariable("TKA_AES");
        if (string.IsNullOrWhiteSpace(aes))
            aes = AesFromExe.TryFind();

        var work = Path.Combine(Path.GetTempPath(), "tka-import-" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(work);

        try
        {
            InitCompression();
            AnimCodecFallback.Register();
            var maxBytes = importAll ? long.MaxValue : defaultMaxBytes;
            var cache = ImportCache.Load(output);
            if (!force)
            {
                if (cache.Bootstrap(inbox, maxBytes))
                {
                    Console.WriteLine("  缓存：现有下载包记为已导入（模型已在 co_der-resource/beat-roguelite/figures/tka-jodi/models）");
                    cache.Save(output);
                }
            }

            Console.WriteLine($"[1/3] 解压 {inbox}");
            var staged = (listGameAnims || (gameAnims && only == null && !force))
                ? new StagedInbox([], 0)
                : StageInbox(inbox, work, maxBytes, (force || only != null) ? null : cache, only);
            if (staged.Mounts.Count == 0 && !listGameAnims && !gameAnims)
            {
                if (staged.Skipped > 0)
                {
                    cache.Save(output);
                    WriteWardrobeIndex(output, []);
                    Console.WriteLine($"[3/3] 无新包（跳过已导入 {staged.Skipped} 个）。新下载的会自动导；整包重导加 --force。");
                    return 0;
                }
                Console.Error.WriteLine("没有 zip/7z/rar/pak。默认会读 Vortex 的 thekillingantidote 下载目录；也可 --in inbox。");
                return 2;
            }

            Console.WriteLine($"[2/3] 挂载 {staged.Mounts.Count} 个目录（CUE4Parse {game}）已跳过 {staged.Skipped}");
            if (!inspectOnly)
                AnimGltf.Donor = SkeletonDonor.Load(inbox, staged.Mounts.Select(m => m.MountDir), game, aes, work);
            var catalogs = new List<string>();

            if (listGameAnims || gameAnims)
            {
                var paks = SkeletonDonor.GamePakFolder();
                if (paks == null)
                    Console.Error.WriteLine("正包未找到。安装 The Killing Antidote，或设 TKA_GAME。");
                else if (listGameAnims)
                    ListGameAnims(paks, game, aes);
                else
                    catalogs.AddRange(ExportGameAnims(paks, output, game, aes));
                if (staged.Mounts.Count == 0)
                {
                    if (!inspectOnly && !listGameAnims)
                    {
                        cache.Save(output);
                        WriteWardrobeIndex(output, catalogs);
                    }
                    Console.WriteLine("[3/3] 正包动作完成");
                    return 0;
                }
            }
            foreach (var job in staged.Mounts)
            {
                Console.WriteLine($"  mount {Path.GetFileName(job.MountDir)}");
                var mods = ExportMount(job.MountDir, output, game, aes, inspectOnly).ToList();
                catalogs.AddRange(mods);
                if (!inspectOnly && job.SourceFile != null)
                    cache.Remember(new FileInfo(job.SourceFile), mods);
            }

            if (inspectOnly)
            {
                Console.WriteLine("[3/3] inspect 完成（未写 glb/png）");
                return 0;
            }

            cache.Save(output);
            WriteWardrobeIndex(output, catalogs);

            Console.WriteLine($"[3/3] 完成 → {output}");
            Console.WriteLine("刷新网页衣橱即可。各模组见 tables.json / files.json。");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex);
            return 1;
        }
        finally
        {
            try { Directory.Delete(work, true); } catch { /* temp */ }
        }
    }

    static void InitCompression()
    {
        var dll = FindOodleDll();
        if (dll != null)
        {
            var dest = Path.Combine(AppContext.BaseDirectory, "oo2core_9_win64.dll");
            if (!File.Exists(dest) || new FileInfo(dest).Length == 0)
            {
                File.Copy(dll, dest, overwrite: true);
            }
            Console.WriteLine($"Oodle: {dll}");
        }
        else
        {
            Console.WriteLine("未找到 Oodle DLL。工坊 pak 若是 Oodle 压缩，请把 FModel 的 oodle-data-shared.dll 拷到 inbox 或工具目录并改名为 oo2core_9_win64.dll。");
        }

        try { OodleHelper.Initialize(); } catch (Exception ex) { Console.WriteLine($"OodleHelper: {ex.Message}"); }
        try { ZlibHelper.Initialize(); } catch { /* optional */ }
    }

    static string? FindOodleDll()
    {
        var names = new[] { "oo2core_9_win64.dll", "oo2core_8_win64.dll", "oodle-data-shared.dll" };
        var roots = new[]
        {
            AppContext.BaseDirectory,
            Directory.GetCurrentDirectory(),
            Path.Combine(Directory.GetCurrentDirectory(), "inbox"),
            @"C:\Users\Admin\Desktop\FModel",
            @"C:\Users\Admin\Desktop\2026-1-3-633-1-03-1767447636\repak-work",
        };
        foreach (var root in roots.Where(Directory.Exists))
        {
            foreach (var name in names)
            {
                var hit = Directory.EnumerateFiles(root, name, SearchOption.AllDirectories).FirstOrDefault();
                if (hit != null) return hit;
            }
        }
        return null;
    }

    static string DefaultInbox()
    {
        var env = Environment.GetEnvironmentVariable("TKA_INBOX");
        if (!string.IsNullOrWhiteSpace(env) && Directory.Exists(env)) return env;
        var vortex = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Vortex", "downloads", "thekillingantidote");
        if (Directory.Exists(vortex)) return vortex;
        return "inbox";
    }

    static void WriteWardrobeIndex(string output, IEnumerable<string> extra)
    {
        var catalogs = extra.ToList();
        void AddFrom(string fileName)
        {
            foreach (var path in Directory.EnumerateFiles(output, fileName, SearchOption.AllDirectories))
            {
                var mod = Path.GetFileName(Path.GetDirectoryName(path)!);
                if (!string.IsNullOrEmpty(mod)) catalogs.Add(mod);
            }
        }
        AddFrom("tables.json");
        AddFrom("files.json");
        AddFrom("catalog.json");
        File.WriteAllText(
            Path.Combine(output, "wardrobe-index.json"),
            JsonConvert.SerializeObject(
                new { mods = catalogs.Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(m => m).ToArray() },
                Formatting.Indented));
    }

    record MountJob(string MountDir, string? SourceFile);

    record StagedInbox(List<MountJob> Mounts, int Skipped);

    static StagedInbox StageInbox(string inbox, string work, long maxBytes, ImportCache? cache, string? only)
    {
        var mounts = new List<MountJob>();
        var skipped = 0;
        foreach (var file in Directory.EnumerateFiles(inbox, "*", SearchOption.TopDirectoryOnly))
        {
            var ext = Path.GetExtension(file).ToLowerInvariant();
            var info = new FileInfo(file);
            if (!string.IsNullOrEmpty(only)
                && info.Name.IndexOf(only, StringComparison.OrdinalIgnoreCase) < 0)
                continue;
            var len = info.Length;
            if (len <= 0)
            {
                Console.WriteLine($"  skip empty {info.Name}");
                continue;
            }
            if (ext is ".zip" or ".7z" or ".rar")
            {
                if (len > maxBytes)
                {
                    Console.WriteLine($"  skip large {info.Name} ({len / (1024 * 1024)} MB)；地图类用 --all");
                    continue;
                }
                if (cache?.Hit(info) == true)
                {
                    Console.WriteLine($"  skip cached {info.Name}");
                    skipped++;
                    continue;
                }
                var dest = Path.Combine(work, Path.GetFileNameWithoutExtension(file));
                Directory.CreateDirectory(dest);
                Console.WriteLine($"  extract {info.Name}");
                try
                {
                    ExtractArchive(file, dest);
                    var roots = FindMountRoots(dest).ToList();
                    foreach (var root in roots)
                        mounts.Add(new MountJob(root, file));
                    if (roots.Count == 0)
                        cache?.Remember(info, []);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"  extract fail {info.Name}: {ex.Message}");
                }
            }
            else if (ext == ".pak")
            {
                if (len > maxBytes)
                {
                    Console.WriteLine($"  skip large {info.Name} ({len / (1024 * 1024)} MB)；地图类用 --all");
                    continue;
                }
                if (cache?.Hit(info) == true)
                {
                    Console.WriteLine($"  skip cached {info.Name}");
                    skipped++;
                    continue;
                }
                var dest = Path.Combine(work, Path.GetFileNameWithoutExtension(file));
                Directory.CreateDirectory(dest);
                File.Copy(file, Path.Combine(dest, Path.GetFileName(file)), overwrite: true);
                mounts.Add(new MountJob(dest, file));
            }
            else if (nameLooksLikeOodle(file))
            {
                var dest = Path.Combine(AppContext.BaseDirectory, "oo2core_9_win64.dll");
                File.Copy(file, dest, overwrite: true);
            }
        }

        foreach (var dir in Directory.EnumerateDirectories(inbox))
        {
            foreach (var root in FindMountRoots(dir))
                mounts.Add(new MountJob(root, null));
        }

        return new StagedInbox(mounts, skipped);

        static bool nameLooksLikeOodle(string path)
        {
            var n = Path.GetFileName(path).ToLowerInvariant();
            return n.Contains("oo2core") || n.Contains("oodle");
        }
    }

    static IEnumerable<string> FindMountRoots(string dir)
    {
        var paks = Directory.EnumerateFiles(dir, "*.pak", SearchOption.AllDirectories).ToList();
        if (paks.Count == 0) yield break;
        foreach (var group in paks.GroupBy(p => Path.GetDirectoryName(p)!, StringComparer.OrdinalIgnoreCase))
            yield return group.Key;
    }

    static void ExtractArchive(string archivePath, string dest)
    {
        var ext = Path.GetExtension(archivePath).ToLowerInvariant();
        if (ext == ".zip")
        {
            ZipFile.ExtractToDirectory(archivePath, dest, overwriteFiles: true);
            return;
        }

        using var archive = ArchiveFactory.Open(archivePath);
        var opts = new ExtractionOptions { ExtractFullPath = true, Overwrite = true };
        foreach (var entry in archive.Entries.Where(e => !e.IsDirectory))
            entry.WriteToDirectory(dest, opts);
    }

    static IEnumerable<string> ExportMount(string mountDir, string output, EGame game, string? aes, bool inspectOnly)
    {
        var fallbackMod = SanitizeModId(Path.GetFileName(mountDir.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)));
        var versions = new VersionContainer(game);
#pragma warning disable CS0618
        using var provider = new DefaultFileProvider(mountDir, SearchOption.TopDirectoryOnly, true, versions);
#pragma warning restore CS0618
        provider.Initialize();
        var key = string.IsNullOrWhiteSpace(aes)
            ? new FAesKey(new byte[32])
            : new FAesKey(aes.StartsWith("0x", StringComparison.OrdinalIgnoreCase) ? aes : "0x" + aes);

        var keys = new Dictionary<FGuid, FAesKey>();
        foreach (var reader in provider.UnloadedVfs)
            keys.TryAdd(reader.EncryptionKeyGuid, key);
        keys.TryAdd(new FGuid(), key);
        var mounted = provider.SubmitKeys(keys);
        Console.WriteLine($"  mounted={mounted} files={provider.Files.Count} stillUnloaded={provider.UnloadedVfs.Count} fallbackMod={fallbackMod}");

        if (inspectOnly)
        {
            foreach (var reader in provider.UnloadedVfs)
                Console.WriteLine($"    vfs {reader.Name} encrypted={reader.IsEncrypted} guid={reader.EncryptionKeyGuid}");
            var extCounts = provider.Files.Values
                .GroupBy(f =>
                {
                    var ext = Path.GetExtension(f.Path);
                    return string.IsNullOrEmpty(ext) ? "(none)" : ext.ToLowerInvariant();
                })
                .OrderByDescending(g => g.Count())
                .Take(12);
            foreach (var g in extCounts)
                Console.WriteLine($"    ext {g.Key} x{g.Count()}");
            foreach (var file in provider.Files.Values.Take(20))
                Console.WriteLine($"    file {file.Path}");
            yield break;
        }

        var options = new ExporterOptions
        {
            LodFormat = ELodFormat.FirstLod,
            MeshFormat = EMeshFormat.Gltf2,
            TextureFormat = ETextureFormat.Png,
            ExportMaterials = true,
            ExportMorphTargets = false,
        };

        var rawDir = Path.Combine(Path.GetTempPath(), "tka-raw-" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(rawDir);

        var meshCount = 0;
        var texCount = 0;
        var animCount = 0;
        var typeHistogram = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var modTables = new Dictionary<string, List<(string Table, UDataTable Data)>>(StringComparer.OrdinalIgnoreCase);

        foreach (var file in provider.Files.Values)
        {
            var path = file.Path.Replace('\\', '/');
            if (!path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase)
                && !path.EndsWith(".umap", StringComparison.OrdinalIgnoreCase))
                continue;
            var baseName = Path.GetFileNameWithoutExtension(path);
            if (baseName.EndsWith("_PhysicsAsset", StringComparison.OrdinalIgnoreCase)) continue;
            if (baseName.EndsWith("_Skeleton", StringComparison.OrdinalIgnoreCase)) continue;
            if (baseName.EndsWith("_mat", StringComparison.OrdinalIgnoreCase)) continue;

            try
            {
                var exports = provider.LoadPackage(path).GetExports();
                foreach (var obj in exports)
                {
                    var typeName = obj.GetType().Name;
                    typeHistogram[typeName] = typeHistogram.GetValueOrDefault(typeName) + 1;
                    switch (obj)
                    {
                        case USkeletalMesh:
                        case UStaticMesh:
                        {
                            var exporter = new Exporter(obj, options);
                            if (exporter.TryWriteToDir(new DirectoryInfo(rawDir), out _, out var saved) && saved != null)
                                meshCount++;
                            break;
                        }
                        case UAnimSequence:
                        case UAnimMontage:
                        {
                            var rel = path.Replace('\\', '/');
                            if (rel.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase))
                                rel = rel[..^7];
                            var dest = Path.Combine(rawDir, (rel + ".glb").Replace('/', Path.DirectorySeparatorChar));
                            if (AnimGltf.TryWrite(obj, dest, out var animErr))
                                animCount++;
                            else
                                Console.WriteLine($"  anim fail {obj.Name}: {animErr}");
                            break;
                        }
                        case UTexture2D texture:
                        {
                            if (ExportTexture(texture, rawDir, path)) texCount++;
                            break;
                        }
                        case UDataTable table:
                        {
                            var mid = GuessModId(path, fallbackMod);
                            if (!modTables.TryGetValue(mid, out var list))
                            {
                                list = [];
                                modTables[mid] = list;
                            }
                            list.Add((baseName, table));
                            break;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"  skip {path}: {ex.Message}");
            }
        }

        Console.WriteLine($"  meshes={meshCount} textures={texCount} anims={animCount} types={string.Join(",", typeHistogram.OrderByDescending(kv => kv.Value).Take(6).Select(kv => $"{kv.Key}:{kv.Value}"))}");
        var flushed = FlushRaw(rawDir, output, fallbackMod);
        try { Directory.Delete(rawDir, true); } catch { /* temp */ }

        var names = new HashSet<string>(flushed, StringComparer.OrdinalIgnoreCase);
        foreach (var tableMod in modTables.Keys) names.Add(tableMod);
        foreach (var mod in names)
            if (WriteUnpack(output, mod, modTables.GetValueOrDefault(mod)) is { } id)
                yield return id;
    }

    static bool ExportTexture(UTexture2D texture, string rawDir, string packagePath)
    {
        try
        {
            var decoded = texture.Decode();
            if (decoded == null) return false;
            using var bitmap = decoded.ToSkBitmap();
            if (bitmap == null) return false;
            using var png = bitmap.Encode(SKEncodedImageFormat.Png, 90);
            if (png == null) return false;

            var rel = packagePath.Replace('\\', '/');
            if (rel.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase))
                rel = rel[..^7];
            var dest = Path.Combine(rawDir, (rel + ".png").Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
            File.WriteAllBytes(dest, png.ToArray());
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"  texture fail {texture.Name}: {ex.Message}");
            return false;
        }
    }

    static HashSet<string> FlushRaw(string rawDir, string output, string fallbackMod)
    {
        var mods = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (!Directory.Exists(rawDir)) return mods;
        foreach (var file in Directory.EnumerateFiles(rawDir, "*", SearchOption.AllDirectories))
        {
            var ext = Path.GetExtension(file).ToLowerInvariant();
            if (ext is not ".glb" and not ".gltf" and not ".png" and not ".tga") continue;
            var rel = Path.GetRelativePath(rawDir, file).Replace('\\', '/');
            var guessed = GuessModId(rel, fallbackMod);
            var mapped = MapGamePath(rel, ext, guessed);
            mapped = mapped.Replace("_LOD0", "", StringComparison.OrdinalIgnoreCase);
            var dest = Path.Combine(output, mapped.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
            File.Copy(file, dest, overwrite: true);
            Console.WriteLine($"    {mapped}");
            mods.Add(guessed);
        }
        return mods;
    }

    static string SanitizeModId(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "imported";
        foreach (var c in Path.GetInvalidFileNameChars())
            name = name.Replace(c, '_');
        name = name.Replace('\'', '_').Replace(' ', '_');
        return string.IsNullOrWhiteSpace(name) ? "imported" : name;
    }

    static string GuessModId(string packagePath, string fallback = "imported")
    {
        var n = packagePath.Replace('\\', '/');
        var marker = "/Content/Mod/";
        var i = n.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (i >= 0)
        {
            var rest = n[(i + marker.Length)..];
            var slash = rest.IndexOf('/');
            var id = slash > 0 ? rest[..slash] : rest;
            if (!string.IsNullOrWhiteSpace(id)) return SanitizeModId(id);
        }
        return string.IsNullOrWhiteSpace(fallback) ? "imported" : fallback;
    }

    static string MapGamePath(string packagePath, string newExt, string modId)
    {
        var n = packagePath.Replace('\\', '/');
        var lastSlash = n.LastIndexOf('/');
        var lastDot = n.LastIndexOf('.');
        if (lastDot > lastSlash) n = n[..lastDot];
        var marker = "/Content/Mod/";
        var i = n.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (i >= 0) n = n[(i + marker.Length)..];
        if (!n.StartsWith(modId + "/", StringComparison.OrdinalIgnoreCase)
            && !n.Equals(modId, StringComparison.OrdinalIgnoreCase))
            n = modId + "/" + Path.GetFileName(n);
        if (!newExt.StartsWith('.')) newExt = "." + newExt;
        return n + newExt;
    }

    static string? WriteUnpack(string output, string modId, List<(string Table, UDataTable Data)>? tables)
    {
        var modDir = Path.Combine(output, modId);
        Directory.CreateDirectory(modDir);

        if (tables is { Count: > 0 })
        {
            var dump = new JArray();
            foreach (var (tableName, table) in tables)
            {
                if (table.RowMap == null) continue;
                var dumpRows = new JArray();
                foreach (var (rowName, row) in table.RowMap)
                {
                    dumpRows.Add(new JObject
                    {
                        ["id"] = rowName.Text,
                        ["fields"] = DumpRow(row),
                    });
                }
                dump.Add(new JObject
                {
                    ["table"] = tableName,
                    ["rows"] = dumpRows,
                });
            }
            File.WriteAllText(Path.Combine(modDir, "tables.json"), dump.ToString(Formatting.Indented));
        }

        var files = new JArray();
        foreach (var file in Directory.EnumerateFiles(modDir, "*", SearchOption.AllDirectories))
        {
            var ext = Path.GetExtension(file).ToLowerInvariant();
            if (ext is not ".glb" and not ".gltf" and not ".png") continue;
            files.Add(Path.GetRelativePath(output, file).Replace('\\', '/'));
        }
        File.WriteAllText(
            Path.Combine(modDir, "files.json"),
            new JObject { ["files"] = files }.ToString(Formatting.Indented));

        var stale = Path.Combine(modDir, "catalog.json");
        if (File.Exists(stale)) File.Delete(stale);

        return modId;
    }

    static JObject DumpRow(FStructFallback row)
    {
        var o = new JObject();
        foreach (var prop in row.Properties)
        {
            var key = prop.Name.Text;
            o[key] = ReadProp(row, key) ?? DumpTag(prop.Tag) ?? JValue.CreateNull();
        }
        return o;
    }

    static JToken? ReadProp(FStructFallback row, string key)
    {
        try { if (row.TryGetValue(out FName n, key)) return n.Text; } catch { /* next */ }
        try { if (row.TryGetValue(out string s, key)) return s; } catch { /* next */ }
        try
        {
            if (row.TryGetValue(out FSoftObjectPath soft, key))
                return soft.AssetPathName.Text;
        }
        catch { /* next */ }
        try
        {
            if (row.TryGetValue(out FStructFallback inner, key) && inner != null)
                return DumpRow(inner);
        }
        catch { /* next */ }
        try
        {
            if (row.TryGetValue(out FVector4 v, key))
                return new JArray(v.X, v.Y, v.Z, v.W);
        }
        catch { /* next */ }
        try
        {
            if (row.TryGetValue(out FVector v, key))
                return new JArray(v.X, v.Y, v.Z);
        }
        catch { /* next */ }
        try
        {
            if (row.TryGetValue(out FLinearColor c, key))
                return new JObject { ["r"] = c.R, ["g"] = c.G, ["b"] = c.B, ["a"] = c.A };
        }
        catch { /* next */ }
        try
        {
            if (row.TryGetValue(out UScriptArray arr, key) && arr != null)
                return DumpArray(arr);
        }
        catch { /* next */ }
        try { if (row.TryGetValue(out float f, key)) return f; } catch { /* next */ }
        try { if (row.TryGetValue(out int i, key)) return i; } catch { /* next */ }
        try { if (row.TryGetValue(out bool b, key)) return b; } catch { /* next */ }
        try { if (row.TryGetValue(out byte by, key)) return (int)by; } catch { /* next */ }
        return null;
    }

    static JToken DumpArray(UScriptArray arr)
    {
        var a = new JArray();
        foreach (var el in arr.Properties)
        {
            if (el is StructProperty sp)
                a.Add(DumpScript(sp.Value));
            else
                a.Add(DumpTagged(el));
        }
        return a;
    }

    static JToken DumpScript(FScriptStruct? script)
    {
        if (script == null) return JValue.CreateNull();
        return script.StructType switch
        {
            FStructFallback fb => DumpRow(fb),
            FBox2D box => new JObject
            {
                ["min"] = new JArray(box.Min.X, box.Min.Y),
                ["max"] = new JArray(box.Max.X, box.Max.Y),
            },
            FVector4 v4 => new JArray(v4.X, v4.Y, v4.Z, v4.W),
            FVector v3 => new JArray(v3.X, v3.Y, v3.Z),
            FVector2D v2 => new JArray(v2.X, v2.Y),
            FLinearColor c => new JObject { ["r"] = c.R, ["g"] = c.G, ["b"] = c.B, ["a"] = c.A },
            _ => DumpTagged(script.StructType),
        };
    }

    static JToken DumpTagged(object? value)
    {
        if (value == null) return JValue.CreateNull();
        if (value is FStructFallback fb) return DumpRow(fb);
        if (value is FScriptStruct script) return DumpScript(script);
        if (value is FVector4 v4) return new JArray(v4.X, v4.Y, v4.Z, v4.W);
        if (value is FVector v3) return new JArray(v3.X, v3.Y, v3.Z);
        if (value is FVector2D v2) return new JArray(v2.X, v2.Y);
        if (value is FLinearColor c) return new JObject { ["r"] = c.R, ["g"] = c.G, ["b"] = c.B, ["a"] = c.A };
        try { return JToken.FromObject(value); }
        catch
        {
            var s = value.ToString();
            return string.IsNullOrEmpty(s) ? JValue.CreateNull() : s;
        }
    }

    static JToken? DumpTag(object? tag)
    {
        if (tag is ArrayProperty ap && ap.Value != null) return DumpArray(ap.Value);
        if (tag is StructProperty sp) return DumpScript(sp.Value);
        var s = tag?.ToString();
        return string.IsNullOrWhiteSpace(s) ? null : s;
    }

    static bool LooksLikeLocomotion(string path)
    {
        var file = Path.GetFileNameWithoutExtension(path);
        if (file.EndsWith("_PhysicsAsset", StringComparison.OrdinalIgnoreCase)) return false;
        if (file.EndsWith("_Skeleton", StringComparison.OrdinalIgnoreCase)) return false;
        if (ContainsAny(file, "zombie", "mutant", "boss", "enemy", "npc", "door", "camer", "weaponview"))
            return false;
        return ContainsAny(file, "walk", "idle", "run", "jog", "sprint", "fire", "aim", "shoot", "reload", "pistol", "rifle", "smg");
    }

    static bool ContainsAny(string hay, params string[] needles)
    {
        foreach (var n in needles)
        {
            if (hay.IndexOf(n, StringComparison.OrdinalIgnoreCase) >= 0) return true;
        }
        return false;
    }

    static IEnumerable<string> GameAnimPaths(DefaultFileProvider provider)
    {
        foreach (var file in provider.Files.Values)
        {
            var path = file.Path.Replace('\\', '/');
            if (!path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase)) continue;
            if (!LooksLikeLocomotion(path)) continue;
            yield return path;
        }
    }

    static DefaultFileProvider OpenGameProvider(string paks, EGame game, string? aes)
    {
        var versions = new VersionContainer(game);
#pragma warning disable CS0618
        var provider = new DefaultFileProvider(paks, SearchOption.TopDirectoryOnly, true, versions);
#pragma warning restore CS0618
        provider.Initialize();
        var key = string.IsNullOrWhiteSpace(aes)
            ? new FAesKey(new byte[32])
            : new FAesKey(aes.StartsWith("0x", StringComparison.OrdinalIgnoreCase) ? aes : "0x" + aes);
        var keys = new Dictionary<FGuid, FAesKey>();
        foreach (var reader in provider.UnloadedVfs)
            keys.TryAdd(reader.EncryptionKeyGuid, key);
        keys.TryAdd(new FGuid(), key);
        provider.SubmitKeys(keys);
        return provider;
    }

    static void ListGameAnims(string paks, EGame game, string? aes)
    {
        using var provider = OpenGameProvider(paks, game, aes);
        Console.WriteLine($"  game files={provider.Files.Count}");
        var n = 0;
        foreach (var path in GameAnimPaths(provider).OrderBy(p => p, StringComparer.OrdinalIgnoreCase))
        {
            Console.WriteLine($"  anim {path}");
            n++;
        }
        Console.WriteLine($"  locomotion-like uasset x{n}");
    }

    static IEnumerable<string> ExportGameAnims(string paks, string output, EGame game, string? aes)
    {
        using var provider = OpenGameProvider(paks, game, aes);
        var destRoot = Path.Combine(output, "TKA_Anim");
        Directory.CreateDirectory(destRoot);
        var files = new List<string>();
        var ok = 0;
        var fail = 0;
        foreach (var path in GameAnimPaths(provider))
        {
            try
            {
                foreach (var obj in provider.LoadPackage(path).GetExports())
                {
                    if (obj is not UAnimSequence && obj is not UAnimMontage) continue;
                    var dest = Path.Combine(destRoot, obj.Name + ".glb");
                    if (AnimGltf.TryWrite(obj, dest, out var err))
                    {
                        ok++;
                        files.Add("TKA_Anim/" + obj.Name + ".glb");
                        Console.WriteLine($"  game anim {obj.Name}");
                    }
                    else
                    {
                        fail++;
                        Console.WriteLine($"  game anim fail {obj.Name}: {err}");
                    }
                }
            }
            catch (Exception ex)
            {
                fail++;
                Console.WriteLine($"  game anim skip {path}: {ex.Message}");
            }
        }
        File.WriteAllText(
            Path.Combine(destRoot, "files.json"),
            JsonConvert.SerializeObject(new { files }, Formatting.Indented));
        Console.WriteLine($"  TKA_Anim wrote={ok} fail={fail}");
        if (ok > 0) yield return "TKA_Anim";
    }


    sealed class ImportCache
    {
        const int Ver = 1;
        readonly Dictionary<string, SourceRec> _sources = new(StringComparer.OrdinalIgnoreCase);

        public static string PathFor(string output) => Path.Combine(output, "import-cache.json");

        public static ImportCache Load(string output)
        {
            var cache = new ImportCache();
            var path = PathFor(output);
            if (!File.Exists(path)) return cache;
            try
            {
                var json = JsonConvert.DeserializeObject<FileDto>(File.ReadAllText(path));
                if (json?.v != Ver || json.sources == null) return cache;
                foreach (var (name, rec) in json.sources)
                    cache._sources[name] = rec;
            }
            catch { /* start empty */ }
            return cache;
        }

        public void Save(string output)
        {
            var dto = new FileDto
            {
                v = Ver,
                sources = _sources.OrderBy(kv => kv.Key, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(kv => kv.Key, kv => kv.Value, StringComparer.OrdinalIgnoreCase),
            };
            File.WriteAllText(PathFor(output), JsonConvert.SerializeObject(dto, Formatting.Indented));
        }

        /// <summary>First run after a full import: remember every eligible archive so we don't redo 7 minutes.</summary>
        public bool Bootstrap(string inbox, long maxBytes)
        {
            if (_sources.Count > 0) return false;
            var n = 0;
            foreach (var file in Directory.EnumerateFiles(inbox, "*", SearchOption.TopDirectoryOnly))
            {
                var ext = Path.GetExtension(file).ToLowerInvariant();
                if (ext is not ".zip" and not ".7z" and not ".rar" and not ".pak") continue;
                var info = new FileInfo(file);
                if (info.Length <= 0 || info.Length > maxBytes) continue;
                Remember(info, []);
                n++;
            }
            return n > 0;
        }

        public bool Hit(FileInfo info)
        {
            if (!_sources.TryGetValue(info.Name, out var rec)) return false;
            if (rec.length != info.Length) return false;
            var mtime = info.LastWriteTimeUtc.ToString("o");
            return string.Equals(rec.mtime, mtime, StringComparison.Ordinal)
                || CloseEnough(rec.mtime, info.LastWriteTimeUtc);
        }

        public void Remember(FileInfo info, IReadOnlyList<string> mods)
        {
            _sources[info.Name] = new SourceRec
            {
                length = info.Length,
                mtime = info.LastWriteTimeUtc.ToString("o"),
                mods = mods.Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
            };
        }

        static bool CloseEnough(string? iso, DateTime utc)
        {
            if (!DateTime.TryParse(iso, null, System.Globalization.DateTimeStyles.RoundtripKind, out var t))
                return false;
            return Math.Abs((t.ToUniversalTime() - utc).TotalSeconds) < 3;
        }

        sealed class FileDto
        {
            public int v { get; set; }
            public Dictionary<string, SourceRec>? sources { get; set; }
        }

        sealed class SourceRec
        {
            public long length { get; set; }
            public string? mtime { get; set; }
            public List<string> mods { get; set; } = [];
        }
    }
}
