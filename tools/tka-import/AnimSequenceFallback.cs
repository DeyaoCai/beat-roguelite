using System.Reflection;
using System.Reflection.Emit;
using CUE4Parse.UE4.Assets;
using CUE4Parse.UE4.Assets.Exports;
using CUE4Parse.UE4.Assets.Exports.Animation;
using CUE4Parse.UE4.Assets.Exports.Animation.ACL;
using CUE4Parse.UE4.Assets.Readers;
using CUE4Parse.UE4.Objects.Engine;
using CUE4Parse.UE4.Objects.Engine.Animation;
using CUE4Parse.UE4.Objects.UObject;
using CUE4Parse.UE4.Versions;

namespace TkaImport;

/// <summary>
/// Workshop anims reference Engine BoneCompressionSettings from the encrypted game pak.
/// Without that asset, CUE4Parse leaves CompressedDataStructure null and ConvertAnims
/// throws "Unsupported compressed data type". Register a sequence class that picks ACL
/// or UE PerTrack from the DDC handle string.
/// </summary>
internal static class AnimCodecFallback
{
    public static void Register()
    {
        Type? registry = null;
        foreach (var t in SafeTypes(typeof(UObject).Assembly))
        {
            if (t.Name == "ObjectTypeRegistry")
            {
                registry = t;
                break;
            }
        }
        if (registry == null)
        {
            Console.WriteLine("  AnimCodecFallback: ObjectTypeRegistry missing");
            return;
        }
        var register = registry.GetMethods(BindingFlags.Public | BindingFlags.Static)
            .FirstOrDefault(m => m.Name == "RegisterClass" && m.GetParameters().Length == 2);
        if (register == null)
        {
            Console.WriteLine("  AnimCodecFallback: RegisterClass missing");
            return;
        }
        register.Invoke(null, ["AnimSequence", typeof(TkaAnimSequence)]);
        Console.WriteLine("  AnimCodecFallback: AnimSequence codec fallback on");
    }

    static IEnumerable<Type> SafeTypes(Assembly a)
    {
        try
        {
            return a.GetTypes();
        }
        catch (ReflectionTypeLoadException ex)
        {
            return ex.Types.Where(t => t != null)!;
        }
    }
}

internal class TkaAnimSequence : UAnimSequence
{
    static bool _loggedHandle;
    static readonly Action<UObject, FAssetArchive, long> CallBaseDeserialize = BindBaseDeserialize();

    static Action<UObject, FAssetArchive, long> BindBaseDeserialize()
    {
        var method = typeof(UAnimSequenceBase).GetMethod(nameof(Deserialize), [typeof(FAssetArchive), typeof(long)])
            ?? throw new InvalidOperationException("UAnimSequenceBase.Deserialize missing");
        var dm = new DynamicMethod(
            "CallAnimSequenceBaseDeserialize",
            typeof(void),
            [typeof(UObject), typeof(FAssetArchive), typeof(long)],
            typeof(TkaAnimSequence),
            skipVisibility: true);
        var il = dm.GetILGenerator();
        il.Emit(OpCodes.Ldarg_0);
        il.Emit(OpCodes.Ldarg_1);
        il.Emit(OpCodes.Ldarg_2);
        il.Emit(OpCodes.Call, method);
        il.Emit(OpCodes.Ret);
        return dm.CreateDelegate<Action<UObject, FAssetArchive, long>>();
    }

    public override void Deserialize(FAssetArchive Ar, long validPos)
    {
        CallBaseDeserialize(this, Ar, validPos);

        NumFrames = GetOrDefault<int>(nameof(NumFrames));
        BoneCompressionSettings = GetOrDefault<ResolvedObject>(nameof(BoneCompressionSettings));
        CurveCompressionSettings = GetOrDefault<ResolvedObject>(nameof(CurveCompressionSettings));
        AdditiveAnimType = GetOrDefault<EAdditiveAnimationType>(nameof(AdditiveAnimType));
        RefPoseType = GetOrDefault<EAdditiveBasePoseType>(nameof(RefPoseType));
        RefPoseSeq = GetOrDefault<ResolvedObject>(nameof(RefPoseSeq));
        RefFrameIndex = GetOrDefault(nameof(RefFrameIndex), 0);
        RetargetSource = GetOrDefault<FName>(nameof(RetargetSource));
        Interpolation = GetOrDefault<EAnimInterpolationType>(nameof(Interpolation));

        var stripFlags = new FStripDataFlags(Ar);
        if (!stripFlags.IsEditorDataStripped())
        {
            RawAnimationData = Ar.ReadArray(() => new FRawAnimSequenceTrack(Ar));
            if (Ar.Ver >= EUnrealEngineObjectUE4Version.ANIMATION_ADD_TRACKCURVES
                && FUE5MainStreamObjectVersion.Get(Ar) < FUE5MainStreamObjectVersion.Type.RemovingSourceAnimationData)
            {
                var source = Ar.ReadArray(() => new FRawAnimSequenceTrack(Ar));
                if (source.Length > 0) RawAnimationData = source;
            }
        }

        if (FFrameworkObjectVersion.Get(Ar) < FFrameworkObjectVersion.Type.MoveCompressedAnimDataToTheDDC)
        {
            InvokePrivate("SerializeCompressedData", Ar);
        }
        else
        {
            var bSerializeCompressedData = Ar.ReadBoolean();
            if (bSerializeCompressedData)
            {
                if (Ar.Game < EGame.GAME_UE4_23) InvokePrivate("SerializeCompressedData", Ar);
                else if (Ar.Game < EGame.GAME_UE4_25) InvokePrivate("SerializeCompressedData2", Ar);
                else SerializeCompressedData3Fallback(Ar);

                if (Ar.Position + 4 <= validPos) SetMember("bUseRawDataOnly", Ar.ReadBoolean());
            }
        }

        typeof(UAnimSequence).GetMethod("EnsureCurveData", BindingFlags.Instance | BindingFlags.NonPublic)
            ?.Invoke(this, null);
    }

    void InvokePrivate(string name, FAssetArchive Ar)
    {
        typeof(UAnimSequence).GetMethod(name, BindingFlags.Instance | BindingFlags.NonPublic)!
            .Invoke(this, [Ar]);
    }

    void SerializeCompressedData3Fallback(FAssetArchive Ar)
    {
        CompressedRawDataSize = Ar.Read<int>();
        CompressedTrackToSkeletonMapTable = Ar.ReadArray<FTrackToSkeletonMap>();
        CompressedCurveNames = Ar.ReadArray(() => new FSmartName(Ar));

        var numBytes = Ar.Read<int>();
        var bUseBulkDataForLoad = Ar.ReadBoolean();
        if (bUseBulkDataForLoad)
            throw new NotImplementedException("Anim: bUseBulkDataForLoad not implemented");
        var serializedByteStream = Ar.ReadBytes(numBytes);

        var boneCodecDDCHandle = Ar.ReadFString();
        var curveCodecPath = Ar.ReadFString();
        var numCurveBytes = Ar.Read<int>();
        CompressedCurveByteStream = Ar.ReadBytes(numCurveBytes);

        var boneCodec = BoneCompressionSettings?.Load<UAnimBoneCompressionSettings>()?.GetCodec(boneCodecDDCHandle)
            ?? GuessCodec(boneCodecDDCHandle);
        var curveCodec = CurveCompressionSettings?.Load<UAnimCurveCompressionSettings>()?.GetCodec(curveCodecPath);
        SetMember("BoneCompressionCodec", boneCodec);
        SetMember("CurveCompressionCodec", curveCodec);

        if (!_loggedHandle)
        {
            _loggedHandle = true;
            var settings = BoneCompressionSettings?.ToString() ?? "null";
            Console.WriteLine($"    boneCodec handle={boneCodecDDCHandle}");
            Console.WriteLine($"    BoneCompressionSettings={settings} codec={boneCodec.GetType().Name}");
        }

        CompressedDataStructure = boneCodec.AllocateAnimData();
        CompressedDataStructure.SerializeCompressedData(Ar);
        CompressedDataStructure.Bind(serializedByteStream);
        NumFrames = CompressedDataStructure.CompressedNumberOfFrames;
    }

    void SetMember(string name, object? value)
    {
        const BindingFlags flags = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
        typeof(UAnimSequence).GetField(name, flags)?.SetValue(this, value);
        typeof(UAnimSequence).GetProperty(name, flags)?.SetValue(this, value);
    }

    static UAnimBoneCompressionCodec GuessCodec(string handle)
    {
        var h = handle ?? "";
        if (h.Contains("ACLDatabase", StringComparison.OrdinalIgnoreCase))
            return new UAnimBoneCompressionCodec_ACLDatabase();
        if (h.Contains("ACL", StringComparison.OrdinalIgnoreCase))
            return new UAnimBoneCompressionCodec_ACLSafe();
        if (h.Contains("PerTrack", StringComparison.OrdinalIgnoreCase))
            return new UAnimCompress_PerTrackCompression();
        return new UAnimCompress();
    }
}
