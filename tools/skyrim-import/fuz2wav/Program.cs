using NAudio.Wave;

if (args.Length < 2)
{
    Console.Error.WriteLine("usage: fuz2wav <in.xwm> <out.wav>");
    return 2;
}

var src = args[0];
var dst = args[1];
Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(dst))!);
using var reader = new MediaFoundationReader(src);
WaveFileWriter.CreateWaveFile(dst, reader);
return 0;
