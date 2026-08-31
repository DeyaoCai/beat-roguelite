using CUE4Parse.Encryption.Aes;
using CUE4Parse.FileProvider;
using CUE4Parse.UE4.Assets.Exports.Animation;
using CUE4Parse.UE4.Assets.Exports.SkeletalMesh;
using CUE4Parse.UE4.Objects.Core.Misc;
using CUE4Parse.UE4.Versions;
using SharpCompress.Archives;
using SharpCompress.Common;

namespace TkaImport;

/// <summary>
/// Workshop pose paks only contain AnimSequence/Montage. Tracks retarget onto Jodi's Female
/// skeleton, which lives in a body mesh pak (e.g. Enhanced Jodi `Female.uasset`).
/// </summary>
internal static class SkeletonDonor
{
    static DefaultFileProvider? KeepAlive;

    public static USkeleton? Load(string inbox, IEnumerable<string> extraMounts, EGame game, string? aes, string work)
    {
        AnimGltf.DonorMesh = null;
        var gamePaks = string.IsNullOrWhiteSpace(aes) ? null : FindGamePaks();
        if (gamePaks != null)
        {
            Console.WriteLine($"  skeleton donor mount {gamePaks}");
            var sk = GrabNamed(gamePaks, game, aes, "Female_Skeleton");
            if (sk != null)
            {
                Console.WriteLine($"  skeleton donor {sk.Name}");
                return sk;
            }
        }

        var dest = Path.Combine(work, "skel-donor");
        Directory.CreateDirectory(dest);
        foreach (var file in Directory.EnumerateFiles(inbox, "*", SearchOption.TopDirectoryOnly))
        {
            var name = Path.GetFileName(file);
            if (!LooksLikeBodyPak(name)) continue;
            try
            {
                var ext = Path.GetExtension(file).ToLowerInvariant();
                var root = Path.Combine(dest, Path.GetFileNameWithoutExtension(file));
                Directory.CreateDirectory(root);
                if (ext is ".zip" or ".7z" or ".rar")
                    ProgramExtract(file, root);
                else if (ext == ".pak")
                    File.Copy(file, Path.Combine(root, Path.GetFileName(file)), overwrite: true);
                else
                    continue;
                foreach (var mount in FindPaks(root))
                {
                    var sk = Grab(mount, game, aes, keep: true);
                    if (sk != null)
                    {
                        Console.WriteLine($"  skeleton donor {name} → {sk.Name}");
                        return sk;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"  skeleton donor skip {name}: {ex.Message}");
            }
        }

        foreach (var dir in extraMounts)
        {
            var sk = Grab(dir, game, aes, keep: false);
            if (sk != null) return sk;
        }

        if (AnimGltf.DonorMesh != null)
            Console.WriteLine($"  mesh donor {AnimGltf.DonorMesh.Name}");
        else
            Console.WriteLine("  skeleton donor: none (install The Killing Antidote, or drop Female_Skeleton in inbox)");
        return null;
    }

    static string? FindGamePaks()
    {
        var env = Environment.GetEnvironmentVariable("TKA_GAME");
        if (!string.IsNullOrWhiteSpace(env))
        {
            var paks = env.EndsWith("Paks", StringComparison.OrdinalIgnoreCase)
                ? env
                : Path.Combine(env, "TheKillingAntidote", "Content", "Paks");
            if (Directory.Exists(paks)) return paks;
        }
        foreach (var root in new[]
                 {
                     @"E:\SteamLibrary\steamapps\common\TheKillingAntidote",
                     @"C:\Program Files (x86)\Steam\steamapps\common\TheKillingAntidote",
                     @"D:\SteamLibrary\steamapps\common\TheKillingAntidote",
                 })
        {
            var paks = Path.Combine(root, "TheKillingAntidote", "Content", "Paks");
            if (File.Exists(Path.Combine(paks, "pakchunk0-WindowsNoEditor.pak"))) return paks;
        }
        return null;
    }

    internal static string? GamePakFolder() => FindGamePaks();

    static USkeleton? GrabNamed(string mountDir, EGame game, string? aes, string assetStem)
    {
        var versions = new VersionContainer(game);
#pragma warning disable CS0618
        var provider = new DefaultFileProvider(mountDir, SearchOption.TopDirectoryOnly, true, versions);
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
        Console.WriteLine($"  game paks mounted={mounted} files={provider.Files.Count} unloaded={provider.UnloadedVfs.Count}");

        foreach (var file in provider.Files.Values)
        {
            var path = file.Path.Replace('\\', '/');
            if (!path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase)) continue;
            if (Path.GetFileNameWithoutExtension(path).IndexOf(assetStem, StringComparison.OrdinalIgnoreCase) < 0)
                continue;
            try
            {
                foreach (var obj in provider.LoadPackage(path).GetExports())
                {
                    if (obj is not USkeleton sk) continue;
                    KeepAlive?.Dispose();
                    KeepAlive = provider;
                    return sk;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"  skeleton load {path}: {ex.Message}");
            }
        }

        provider.Dispose();
        return null;
    }

    static bool LooksLikeBodyPak(string name)
    {
        var n = name.ToLowerInvariant();
        if (n.Contains("enhanced") && n.Contains("jodi")) return true;
        if (n.Contains("nude") && n.Contains("jodi")) return true;
        if (n.Contains("female")) return true;
        return false;
    }

    static USkeleton? Grab(string mountDir, EGame game, string? aes, bool keep)
    {
        var versions = new VersionContainer(game);
#pragma warning disable CS0618
        var provider = new DefaultFileProvider(mountDir, SearchOption.TopDirectoryOnly, true, versions);
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

        USkeleton? found = null;
        USkeletalMesh? bestMesh = null;
        var bestScore = -1;
        foreach (var file in provider.Files.Values)
        {
            var path = file.Path.Replace('\\', '/');
            if (!path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase)) continue;
            var baseName = Path.GetFileNameWithoutExtension(path);
            if (baseName.EndsWith("_PhysicsAsset", StringComparison.OrdinalIgnoreCase)) continue;
            if (baseName.EndsWith("_mat", StringComparison.OrdinalIgnoreCase)) continue;
            try
            {
                foreach (var obj in provider.LoadPackage(path).GetExports())
                {
                    if (obj is USkeleton sk)
                    {
                        var score = DonorScore(sk.Name, path);
                        if (score > bestScore)
                        {
                            bestScore = score;
                            found = sk;
                        }
                        if (score >= 80) goto picked;
                    }
                    if (obj is USkeletalMesh mesh)
                    {
                        var score = DonorScore(mesh.Name, path);
                        if (score > bestScore)
                        {
                            bestScore = score;
                            bestMesh = mesh;
                            found = mesh.Skeleton.Load<USkeleton>() ?? found;
                        }
                    }
                }
            }
            catch
            {
                /* next */
            }
        }
        picked:
        if (bestMesh != null && DonorScore(bestMesh.Name, bestMesh.GetPathName()) >= 0)
            AnimGltf.DonorMesh = bestMesh;

        if (keep && (found != null || AnimGltf.DonorMesh != null))
        {
            if (!ReferenceEquals(KeepAlive, provider))
                KeepAlive?.Dispose();
            KeepAlive = provider;
        }
        else
            provider.Dispose();
        return found;
    }

    static int DonorScore(string name, string path)
    {
        var n = $"{name} {path}".ToLowerInvariant();
        if (n.Contains("female_skeleton")) return 100;
        if (n.Contains("/female") || n.Contains("\\female")) return 90;
        if (n.Contains("female") && (n.Contains("body") || n.Contains("jodi"))) return 85;
        if (ContainsAny(n, "bra", "panty", "hair", "sock", "glove", "skirt", "dress", "shoe", "boot"))
            return -1;
        if (n.Contains("jodi") || n.Contains("female")) return 40;
        return 0;
    }

    static bool ContainsAny(string hay, params string[] needles)
    {
        foreach (var x in needles)
            if (hay.IndexOf(x, StringComparison.OrdinalIgnoreCase) >= 0) return true;
        return false;
    }

    static IEnumerable<string> FindPaks(string dir)
    {
        var paks = Directory.EnumerateFiles(dir, "*.pak", SearchOption.AllDirectories).ToList();
        return paks.Select(p => Path.GetDirectoryName(p)!).Distinct(StringComparer.OrdinalIgnoreCase);
    }

    static void ProgramExtract(string archive, string dest)
    {
        var ext = Path.GetExtension(archive).ToLowerInvariant();
        if (ext == ".zip")
        {
            System.IO.Compression.ZipFile.ExtractToDirectory(archive, dest, overwriteFiles: true);
            return;
        }
        using var ar = ArchiveFactory.Open(archive);
        var opts = new ExtractionOptions { ExtractFullPath = true, Overwrite = true };
        foreach (var entry in ar.Entries.Where(e => !e.IsDirectory))
            entry.WriteToDirectory(dest, opts);
    }
}
