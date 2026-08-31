using System.Numerics;
using System.Reflection;
using System.Runtime.CompilerServices;
using CUE4Parse.UE4.Assets.Exports;
using CUE4Parse.UE4.Assets.Exports.Animation;
using CUE4Parse.UE4.Assets.Exports.SkeletalMesh;
using CUE4Parse.UE4.Objects.Core.Math;
using CUE4Parse_Conversion.Animations;
using CUE4Parse_Conversion.Animations.PSA;
using CUE4Parse_Conversion.Meshes;
using CUE4Parse_Conversion.Meshes.PSK;
using SharpGLTF.Geometry;
using SharpGLTF.Geometry.VertexTypes;
using SharpGLTF.Materials;
using SharpGLTF.Scenes;

namespace TkaImport;

/// <summary>
/// CUE4Parse AnimExporter writes .psa / .ueanim. Preview loads glTF clips, sampled onto
/// Female bone names from the body mesh (pose paks do not ship Female_Skeleton).
/// </summary>
internal static class AnimGltf
{
    const float CmToM = 0.01f;
    public static USkeleton? Donor;
    public static USkeletalMesh? DonorMesh;

    public static bool TryWrite(UObject obj, string destGlb, out string error)
    {
        error = "";
        try
        {
            var clips = CollectSequences(obj);
            if (clips.Count == 0)
            {
                error = "no sequences";
                return false;
            }
            if (!TryBones(out var bones))
            {
                error = "no Female mesh (put Enhanced Jodi / body pak in inbox)";
                return false;
            }

            var scene = new SceneBuilder();
            var armature = new NodeBuilder("Armature");
            var nodes = new NodeBuilder[bones.Count];
            for (var i = 0; i < bones.Count; i++)
            {
                if (bones[i].ParentIndex != -1) continue;
                BuildBone(i, armature, bones, nodes);
            }
            scene.AddRigidMesh(AnchorMesh(), armature);

            var wrote = 0;
            var skel = Donor ?? SkeletonFromMesh();
            DumpOnce(clips[0]!, skel, bones);
            var skelNames = SkelBoneNames(skel, bones);
            foreach (var seq in clips)
            {
                CAnimSet? set = null;
                try
                {
                    if (skel != null) set = skel.ConvertAnims(seq);
                }
                catch (Exception ex)
                {
                    error = "ConvertAnims: " + ex.Message;
                    if (!_loggedCodec)
                    {
                        _loggedCodec = true;
                        var kf = seq.GetType().GetProperty("KeyEncodingFormat")?.GetValue(seq);
                        var cf = seq.GetType().GetProperty("AnimationCompressionFormat")?.GetValue(seq);
                        Console.WriteLine($"    codec KeyEncoding={kf} Compression={cf}");
                        Console.WriteLine($"    {ex.Message}");
                    }
                }
                if (set?.Sequences is { Count: > 0 })
                {
                    SampleConverted(set, bones, nodes, seq.Name, skelNames);
                    wrote++;
                    continue;
                }
                if (seq.RawAnimationData != null && seq.RawAnimationData.Any())
                {
                    SampleClip(seq, bones, nodes, obj.Name, skelNames);
                    wrote++;
                    continue;
                }
                if (string.IsNullOrEmpty(error))
                    error = "compressed (no RawAnimationData)";
            }
            if (wrote == 0) return false;

            Directory.CreateDirectory(Path.GetDirectoryName(destGlb)!);
            scene.ToGltf2().SaveGLB(destGlb);
            return File.Exists(destGlb) && new FileInfo(destGlb).Length > 0;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
    }

    static bool TryBones(out List<CSkelMeshBone> bones)
    {
        if (DonorMesh != null && DonorMesh.TryConvert(out CSkeletalMesh converted) && converted.RefSkeleton.Count > 0)
        {
            bones = converted.RefSkeleton;
            return true;
        }
        if (Donor != null && Donor.TryConvert(out bones, out _) && bones.Count > 0)
            return true;
        bones = [];
        return false;
    }

    static List<UAnimSequence> CollectSequences(UObject obj)
    {
        var outSeq = new List<UAnimSequence>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        switch (obj)
        {
            case UAnimSequence seq:
                outSeq.Add(seq);
                break;
            case UAnimMontage montage:
                foreach (var slot in montage.SlotAnimTracks)
                {
                    var segs = slot.AnimTrack?.AnimSegments;
                    if (segs == null) continue;
                    foreach (var seg in segs)
                    {
                        if (!seg.AnimReference.TryLoad(out UAnimSequence loaded) || loaded == null) continue;
                        if (!seen.Add(loaded.GetPathName())) continue;
                        outSeq.Add(loaded);
                    }
                }
                break;
        }
        return outSeq;
    }

    static USkeleton? _fromMesh;
    static bool _loggedCodec;
    static bool _dumpedSeq;

    static void DumpOnce(UAnimSequence seq, USkeleton? skel, List<CSkelMeshBone> bones)
    {
        if (_dumpedSeq) return;
        _dumpedSeq = true;
        var structure = seq.CompressedDataStructure;
        var settings = seq.BoneCompressionSettings?.ToString() ?? "null";
        Console.WriteLine($"    seq {seq.Name} frames={seq.NumFrames} tracks={seq.GetNumTracks()} raw={(seq.RawAnimationData?.Length ?? 0)} additive={seq.AdditiveAnimType}");
        var flags = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
        var codec = typeof(UAnimSequence).GetProperty("BoneCompressionCodec", flags)?.GetValue(seq)
            ?? typeof(UAnimSequence).GetField("BoneCompressionCodec", flags)?.GetValue(seq);
        Console.WriteLine($"    CompressedDataStructure={structure?.GetType().Name ?? "null"} codec={codec?.GetType().Name ?? "null"}");
        Console.WriteLine($"    BoneCompressionSettings={settings} skelBones={skel?.BoneCount ?? 0}");
        var map = seq.CompressedTrackToSkeletonMapTable;
        if (map is { Length: > 0 })
        {
            var max = map.Max(t => t.BoneTreeIndex);
            Console.WriteLine($"    trackMap n={map.Length} maxBone={max} meshBones={bones.Count} skelBones={SkelBoneNames(skel, bones).Count}");
        }
        var extras = bones.Select(b => b.Name.ToString()).Where(n => MeshOnlyBones.Contains(n)).ToArray();
        if (extras.Length > 0)
            Console.WriteLine($"    mesh-only bones skipped for tracks: {string.Join(", ", extras)}");
    }

    static USkeleton? SkeletonFromMesh()
    {
        if (_fromMesh != null) return _fromMesh;
        if (DonorMesh == null) return null;
        var flags = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
        var meshRef = DonorMesh.GetType().GetProperty("ReferenceSkeleton", flags)?.GetValue(DonorMesh)
            ?? DonorMesh.GetType().GetField("ReferenceSkeleton", flags)?.GetValue(DonorMesh);
        if (meshRef == null)
        {
            Console.WriteLine("    Female mesh has no ReferenceSkeleton");
            return null;
        }
        var skel = (USkeleton)RuntimeHelpers.GetUninitializedObject(typeof(USkeleton));
        foreach (var member in new[] { "ReferenceSkeleton", "RefSkeleton", "_referenceSkeleton" })
        {
            typeof(USkeleton).GetProperty(member, flags)?.SetValue(skel, meshRef);
            typeof(USkeleton).GetField(member, flags)?.SetValue(skel, meshRef);
        }
        try { skel.Name = DonorMesh.Name; } catch { /* FName mismatch */ }

        var info = meshRef.GetType().GetProperty("FinalRefBoneInfo")?.GetValue(meshRef) as Array;
        var n = info?.Length ?? 0;
        var btProp = typeof(USkeleton).GetProperty("BoneTree");
        if (btProp != null && n > 0)
        {
            var listType = btProp.PropertyType;
            var elem = listType.IsArray ? listType.GetElementType() : listType.GetGenericArguments().FirstOrDefault();
            if (elem != null)
            {
                var arr = Array.CreateInstance(elem, n);
                for (var i = 0; i < n; i++)
                    arr.SetValue(Activator.CreateInstance(elem), i);
                if (listType.IsArray)
                    btProp.SetValue(skel, arr);
                else
                {
                    var list = Activator.CreateInstance(listType);
                    var add = listType.GetMethod("Add");
                    for (var i = 0; i < n; i++)
                        add?.Invoke(list, [arr.GetValue(i)]);
                    btProp.SetValue(skel, list);
                }
            }
        }
        _fromMesh = skel;
        return skel;
    }

    /// <summary>
    /// ConvertAnims fills Tracks[i] for skeleton bone i (empty track if that bone is not keyed).
    /// Do not compact-skip names before indexing — _end / extra bones would shift every track.
    /// </summary>
    static readonly HashSet<string> MeshOnlyBones = new(StringComparer.OrdinalIgnoreCase)
    {
        "Cam", "hand_l_socket", "Prop_R2", "HeadTarget",
    };

    static List<string> SkelBoneNames(USkeleton? skel, List<CSkelMeshBone> bones)
    {
        try
        {
            var info = skel?.ReferenceSkeleton.FinalRefBoneInfo;
            if (info is { Length: > 0 })
            {
                var names = new List<string>(info.Length);
                for (var i = 0; i < info.Length; i++)
                    names.Add(info[i].Name.ToString());
                return names;
            }
        }
        catch
        {
            /* mesh names below */
        }
        return bones.Select(b => b.Name.ToString()).ToList();
    }

    static bool KeepGameBone(string? name) =>
        !string.IsNullOrEmpty(name)
        && !name!.EndsWith("_end", StringComparison.OrdinalIgnoreCase)
        && !MeshOnlyBones.Contains(name);

    static Dictionary<string, int> MeshIndexByName(List<CSkelMeshBone> bones)
    {
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < bones.Count; i++)
        {
            var name = bones[i].Name.ToString();
            if (!string.IsNullOrEmpty(name) && !map.ContainsKey(name))
                map[name] = i;
        }
        return map;
    }

    static void SampleConverted(
        CAnimSet set,
        List<CSkelMeshBone> bones,
        NodeBuilder[] nodes,
        string fallbackName,
        List<string> skelNames)
    {
        var meshIndex = MeshIndexByName(bones);
        foreach (var seq in set.Sequences)
        {
            var clipName = string.IsNullOrWhiteSpace(seq.Name) ? fallbackName : seq.Name;
            var frames = Math.Max(seq.NumFrames, 1);
            var duration = seq.AnimEndTime > seq.StartPos ? seq.AnimEndTime - seq.StartPos : 0f;
            if (duration <= 0.001f) duration = frames / 30f;
            var dt = frames > 1 ? duration / (frames - 1) : duration;
            var n = Math.Min(skelNames.Count, seq.Tracks.Count);
            for (var boneIndex = 0; boneIndex < n; boneIndex++)
            {
                var name = skelNames[boneIndex];
                if (!KeepGameBone(name)) continue;
                if (!meshIndex.TryGetValue(name, out var meshBone)) continue;
                var node = nodes[meshBone];
                if (node == null) continue;
                var track = seq.Tracks[boneIndex];
                if (!track.HasKeys()) continue;
                var restPos = bones[meshBone].Position;
                var restRot = bones[meshBone].Orientation;
                var restScale = new FVector(1, 1, 1);
                var timesR = new Dictionary<float, Quaternion>(frames);
                var anyRot = false;
                for (var frame = 0; frame < frames; frame++)
                {
                    var pos = restPos;
                    var rot = restRot;
                    var scale = restScale;
                    track.GetBoneTransform(frame, frames, ref rot, ref pos, ref scale);
                    var t = frame * dt;
                    var q = ToGltfRot(rot);
                    timesR[t] = q;
                    if (!IsIdentity(q)) anyRot = true;
                }
                if (anyRot && !IsRootY180(name, timesR))
                    node.WithLocalRotation(clipName, timesR);
            }
        }
    }

    static void SampleClip(
        UAnimSequence seq,
        List<CSkelMeshBone> bones,
        NodeBuilder[] nodes,
        string fallbackName,
        List<string> skelNames)
    {
        var clipName = string.IsNullOrWhiteSpace(seq.Name) ? fallbackName : seq.Name;
        var frames = Math.Max(seq.NumFrames, 1);
        var duration = seq.SequenceLength > 0.001f ? seq.SequenceLength : frames / 30f;
        var dt = frames > 1 ? duration / (frames - 1) : duration;
        var raw = seq.RawAnimationData;
        var meshIndex = MeshIndexByName(bones);

        for (var boneIndex = 0; boneIndex < skelNames.Count; boneIndex++)
        {
            var name = skelNames[boneIndex];
            if (!KeepGameBone(name)) continue;
            if (!meshIndex.TryGetValue(name, out var meshBone)) continue;
            var node = nodes[meshBone];
            if (node == null) continue;
            var track = seq.FindTrackForBoneIndex(boneIndex);
            if (track < 0 || raw == null || track >= raw.Count()) continue;
            var restRot = bones[meshBone].Orientation;
            var timesR = new Dictionary<float, Quaternion>(frames);
            var anyRot = false;
            for (var frame = 0; frame < frames; frame++)
            {
                var keys = raw[track];
                var rot = At(keys.RotKeys, frame, frames, restRot);
                var t = frame * dt;
                var q = ToGltfRot(rot);
                timesR[t] = q;
                if (!IsIdentity(q)) anyRot = true;
            }
            if (anyRot && !IsRootY180(name, timesR))
                node.WithLocalRotation(clipName, timesR);
        }
    }

    static bool IsIdentity(Quaternion q) =>
        q.X * q.X + q.Y * q.Y + q.Z * q.Z < 0.0004f && Math.Abs(Math.Abs(q.W) - 1f) < 0.02f;

    static bool IsRootY180(string name, Dictionary<float, Quaternion> keys)
    {
        if (!name.Equals("root", StringComparison.OrdinalIgnoreCase) || keys.Count == 0)
            return false;
        return keys.Values.All(q =>
            Math.Abs(q.X) < 0.02f && Math.Abs(q.Z) < 0.02f
            && Math.Abs(Math.Abs(q.Y) - 1f) < 0.02f && Math.Abs(q.W) < 0.02f);
    }

    static FQuat At(FQuat[] keys, int frame, int frames, FQuat rest)
    {
        if (keys == null || keys.Length == 0) return rest;
        if (keys.Length == 1) return keys[0];
        var i = frames <= 1 ? 0 : (int)Math.Round(frame * (keys.Length - 1) / (double)(frames - 1));
        return keys[Math.Clamp(i, 0, keys.Length - 1)];
    }

    static MeshBuilder<VertexPosition> AnchorMesh()
    {
        var mesh = new MeshBuilder<VertexPosition>("anim_anchor");
        var prim = mesh.UsePrimitive(new MaterialBuilder("hidden"));
        prim.AddTriangle(
            new VertexPosition(0, 0, 0),
            new VertexPosition(0.0001f, 0, 0),
            new VertexPosition(0, 0.0001f, 0));
        return mesh;
    }

    static void BuildBone(int index, NodeBuilder parent, List<CSkelMeshBone> bones, NodeBuilder[] nodes)
    {
        var bone = bones[index];
        var node = parent.CreateNode(bone.Name.ToString())
            .WithLocalRotation(ToGltfRot(bone.Orientation))
            .WithLocalTranslation(ToGltfPos(bone.Position));
        nodes[index] = node;
        for (var i = 0; i < bones.Count; i++)
        {
            if (bones[i].ParentIndex == index)
                BuildBone(i, node, bones, nodes);
        }
    }

    static Vector3 ToGltfPos(FVector v) => new(v.X * CmToM, v.Z * CmToM, v.Y * CmToM);

    static Quaternion ToGltfRot(FQuat q) => new(q.X, q.Z, q.Y, -q.W);
}
