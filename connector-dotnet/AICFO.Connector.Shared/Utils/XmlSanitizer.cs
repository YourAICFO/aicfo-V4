using System.Text;

namespace AICFO.Connector.Shared.Utils;

/// <summary>
/// Removes invalid XML 1.0 characters and invalid numeric character references before parsing.
/// Strips raw control chars (except tab, LF, CR) and entity refs like &#4; / &#x4; that expand to invalid code points.
/// </summary>
public static class XmlSanitizer
{
    private const int MaxCharRefLen = 15;

    /// <summary>Returns (sanitized string, count of items removed: raw chars + invalid refs).</summary>
    public static (string Sanitized, int RemovedCount) Sanitize(string? xml)
    {
        if (string.IsNullOrEmpty(xml)) return (xml ?? string.Empty, 0);

        var sb = new StringBuilder(xml.Length);
        var removed = 0;
        var i = 0;
        while (i < xml.Length)
        {
            if (xml[i] == '&' && i + 2 < xml.Length && xml[i + 1] == '#')
            {
                var (len, codepoint) = TryParseNumericCharRef(xml, i);
                if (len > 0 && len <= MaxCharRefLen)
                {
                    if (codepoint >= 0 && !IsValidXml10CodePoint(codepoint))
                    {
                        removed++;
                        i += len;
                        continue;
                    }
                    if (codepoint >= 0)
                    {
                        sb.Append(xml.AsSpan(i, len));
                        i += len;
                        continue;
                    }
                }
                sb.Append(xml[i]);
                i++;
                continue;
            }

            var c = xml[i];
            if (IsValidXmlChar(c))
                sb.Append(c);
            else
                removed++;
            i++;
        }
        return (sb.ToString(), removed);
    }

    /// <summary>Returns (length of sequence including ;, or 0 if not a valid ref; parsed codepoint or -1).</summary>
    private static (int Length, int CodePoint) TryParseNumericCharRef(string xml, int start)
    {
        if (start + 3 > xml.Length) return (0, -1);
        var p = start + 2; // after "&#"
        var radix = 10;
        if (xml[p] == 'x' || xml[p] == 'X')
        {
            radix = 16;
            p++;
            if (p >= xml.Length) return (0, -1);
        }

        var numStart = p;
        while (p < xml.Length && p - start <= MaxCharRefLen)
        {
            var ch = xml[p];
            if (ch == ';')
            {
                if (p == numStart) return (0, -1);
                var numStr = xml.Substring(numStart, p - numStart);
                if (TryParseInt(numStr, radix, out var cp))
                    return (p - start + 1, cp);
                return (0, -1);
            }
            if (radix == 10 && (ch < '0' || ch > '9')) return (0, -1);
            if (radix == 16 && !IsHexDigit(ch)) return (0, -1);
            p++;
        }
        return (0, -1);
    }

    private static bool IsHexDigit(char c) =>
        (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');

    private static bool TryParseInt(string s, int radix, out int result)
    {
        result = 0;
        try
        {
            result = Convert.ToInt32(s, radix);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static bool IsValidXml10CodePoint(int codePoint)
    {
        if (codePoint == 0x09 || codePoint == 0x0A || codePoint == 0x0D) return true;
        if (codePoint >= 0x20 && codePoint <= 0xD7FF) return true;
        if (codePoint >= 0xE000 && codePoint <= 0xFFFD) return true;
        if (codePoint >= 0x10000 && codePoint <= 0x10FFFF) return true;
        return false;
    }

    private static bool IsValidXmlChar(char c)
    {
        if (c == '\t' || c == '\n' || c == '\r') return true;
        if (c >= 0x00 && c <= 0x1F) return false;
        if (c == '\uFFFE' || c == '\uFFFF') return false;
        return true;
    }
}
