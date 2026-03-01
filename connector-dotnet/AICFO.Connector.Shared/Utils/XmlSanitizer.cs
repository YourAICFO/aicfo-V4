using System.Text;

namespace AICFO.Connector.Shared.Utils;

/// <summary>
/// Removes invalid XML 1.0 characters before parsing.
/// Allowed control chars: tab (0x09), LF (0x0A), CR (0x0D).
/// Removes: 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, U+FFFE, U+FFFF.
/// </summary>
public static class XmlSanitizer
{
    /// <summary>Returns (sanitized string, count of characters removed).</summary>
    public static (string Sanitized, int RemovedCount) Sanitize(string? xml)
    {
        if (string.IsNullOrEmpty(xml)) return (xml ?? string.Empty, 0);

        var sb = new StringBuilder(xml.Length);
        var removed = 0;
        foreach (var c in xml)
        {
            if (IsValidXmlChar(c))
                sb.Append(c);
            else
                removed++;
        }
        return (sb.ToString(), removed);
    }

    private static bool IsValidXmlChar(char c)
    {
        if (c == '\t' || c == '\n' || c == '\r') return true;
        if (c >= 0x00 && c <= 0x1F) return false;
        if (c == '\uFFFE' || c == '\uFFFF') return false;
        return true;
    }
}
