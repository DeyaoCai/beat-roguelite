namespace TkaImport;

/// <summary>
/// Same C7-immediate scan as GHFear AESDumpster 1.3. Reads the local Shipping.exe
/// so workshop anims can ConvertAnims on the game Female_Skeleton. Never prints the key.
/// </summary>
internal static class AesFromExe
{
    const double MinEntropy = 3.3;

    static readonly string[] Patterns =
    [
        "C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ?",
        "C7 ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ?",
        "C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? 48 ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ?",
        "C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? ? C7 ? ? ? ? ? C3",
    ];

    static readonly int[][] DwordOffsets =
    [
        [3, 10, 17, 24, 35, 42, 49, 56],
        [2, 9, 16, 23, 30, 37, 44, 51],
        [3, 10, 21, 28, 35, 42, 49, 56],
        [51, 45, 38, 31, 24, 17, 10, 3],
    ];

    static readonly HashSet<string> FalsePositives = new(StringComparer.OrdinalIgnoreCase)
    {
        "FFD9FFD9FFD9FFD9FFD9FFD9FFD9FFD9FFD9FFD9FFD9FFD9FFD9FFD9FFD9FFD9",
        "67E6096A85AE67BB72F36E3C3AF54FA57F520E518C68059BABD9831F19CDE05B",
        "D89E05C107D57C3617DD703039590EF7310BC0FF11155868A78FF964A44FFABE",
        "9A99593F9A99593F0AD7633F52B8BE3FE17A543FCDCC4C3D4260E53BAE47A13F",
        "6F168073B9B21449D742241700068ADABC306FA9AA3831164DEE8DE34E0EFBB0",
        "0AD7633FCDCC4C3DCDCCCC3D52B8BE3F9A99593F9A99593FC9767E3FE17A543F",
        "168073C7B21449C7430C00064310BC304314AA3843184DEE431C4E0E83C4205B",
        "E6096AC7AE67BBC7430C3AF543107F5243148C684318ABD9431C19CD436C2000",
        "9E05C1C7D57C36C7430C39594310310B431411154318A78F431CA44F436C1C00",
        "9E05C1C7D57C36C7DD7030C7590EF7C70BC0FFC7155868C78FF964C7A44FFABE",
        "168073C7B21449C7422417C7068ADAC7306FA9C7383116C7EE8DE3C74E0EFBB0",
        "0AD7633FCDCC4C3D00C742143DC742183FC7421C3FC742203FC742247E3FC742",
        "0000803F0AD7A33E0AD7633F52B8BE3FE17A543FCDCC4C3D4260E53B54AE47A1",
        "0AD7A33E0AD7633F52B8BE3FE17A543FCDCC4C3D4260E53BAE47A13F58583934",
        "0AD7A33E0AD7633F52B8BE3FE17A543FCDCC4C3D4260E53BAE47A13F38583934",
        "0000803F0AD7A33E0AD7633F52B8BE3FE17A543FCDCC4C3D4260E53B34AE47A1",
        "0000803F0000803F0AD7A33E0AD7633F52B8BE3FE17A543FCDCC4C3D2C4260E5",
        "0AD7633F52B8BE3FE17A543FCDCC4C3D4260E53BAE47A13F5839343C4CC9767E",
        "07D57C3617DD703039590EF7310BC0FF11155868A78FF964A44FFABE6C1C0000",
        "85AE67BB72F36E3C3AF54FA57F520E518C68059BABD9831F19CDE05B6C200000",
        "E6096AC7AE67BBC7F36E3CC7F54FA5C7520E51C768059BC7D9831FC719CDE05B",
        "0AD7A33E0AD7633F52B8BE3FE17A543FCDCC4C3D4260E53BAE47A13F3C583934",
        "E4D6E74FE4D667500044AC47926595380080DC43000A9B46000080BF000080BF",
        "D04C8F7D71ECC047D8A60970FBA31C9E9EC1250BBBF6459AC480947212E1DB8C",
    };

    public static string? TryFind()
    {
        var exe = FindShipping();
        if (exe == null)
        {
            Console.WriteLine("  AES: no TheKillingAntidote-Win64-Shipping.exe (set TKA_GAME or --aes)");
            return null;
        }
        Console.WriteLine($"  AES scan {exe}");
        try
        {
            var buf = File.ReadAllBytes(exe);
            var best = Scan(buf);
            if (best == null)
            {
                Console.WriteLine("  AES: no candidate (entropy >= 3.3)");
                return null;
            }
            Console.WriteLine($"  AES from exe entropy={best.Value.Entropy:F3}");
            return "0x" + best.Value.Hex;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"  AES scan failed: {ex.Message}");
            return null;
        }
    }

    static string? FindShipping()
    {
        var env = Environment.GetEnvironmentVariable("TKA_GAME");
        if (!string.IsNullOrWhiteSpace(env))
        {
            var hit = Directory.EnumerateFiles(env, "*Win64-Shipping.exe", SearchOption.AllDirectories).FirstOrDefault();
            if (hit != null) return hit;
        }
        foreach (var root in new[]
                 {
                     @"E:\SteamLibrary\steamapps\common\TheKillingAntidote",
                     @"C:\Program Files (x86)\Steam\steamapps\common\TheKillingAntidote",
                     @"D:\SteamLibrary\steamapps\common\TheKillingAntidote",
                 })
        {
            var exe = Path.Combine(root, "TheKillingAntidote", "Binaries", "Win64", "TheKillingAntidote-Win64-Shipping.exe");
            if (File.Exists(exe)) return exe;
        }
        return null;
    }

    static (string Hex, double Entropy)? Scan(byte[] buf)
    {
        string? best = null;
        var bestE = -1.0;
        for (var t = 0; t < Patterns.Length; t++)
        {
            var pat = Parse(Patterns[t]);
            var offs = DwordOffsets[t];
            var maxOff = offs.Max() + 4;
            for (var i = 0; i + pat.Length <= buf.Length; i++)
            {
                if (buf[i] != 0xC7) continue;
                if (!Match(buf, i, pat)) continue;
                if (i + maxOff > buf.Length) continue;
                var hex = Concat(buf, i, offs);
                if (FalsePositives.Contains(hex)) continue;
                var e = Entropy(hex);
                if (e < MinEntropy) continue;
                if (e > bestE)
                {
                    bestE = e;
                    best = hex;
                }
            }
        }
        return best == null ? null : (best, bestE);
    }

    static sbyte[] Parse(string pattern)
    {
        var parts = pattern.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var outp = new List<sbyte>(parts.Length);
        foreach (var p in parts)
        {
            if (p == "?" || p == "??") outp.Add(-1);
            else outp.Add((sbyte)Convert.ToByte(p, 16));
        }
        return [.. outp];
    }

    static bool Match(byte[] buf, int at, sbyte[] pat)
    {
        for (var i = 0; i < pat.Length; i++)
        {
            if (pat[i] < 0) continue;
            if (buf[at + i] != (byte)pat[i]) return false;
        }
        return true;
    }

    static string Concat(byte[] buf, int at, int[] offs)
    {
        Span<char> hex = stackalloc char[64];
        const string digits = "0123456789ABCDEF";
        var n = 0;
        foreach (var o in offs)
        {
            for (var k = 0; k < 4; k++)
            {
                var b = buf[at + o + k];
                hex[n++] = digits[b >> 4];
                hex[n++] = digits[b & 0xf];
            }
        }
        return new string(hex);
    }

    static double Entropy(string hex)
    {
        Span<int> freq = stackalloc int[16];
        foreach (var c in hex)
        {
            var v = c is >= '0' and <= '9' ? c - '0' : 10 + (c - 'A');
            if ((uint)v < 16) freq[v]++;
        }
        var n = hex.Length;
        var h = 0.0;
        for (var i = 0; i < 16; i++)
        {
            if (freq[i] == 0) continue;
            var p = freq[i] / (double)n;
            h -= p * Math.Log2(p);
        }
        return h;
    }
}
