using System.Text.RegularExpressions;

namespace AICFO.Connector.Shared.Services;

/// <summary>
/// Redacts known secret keys from JSON or text before logging or copying to clipboard.
/// Prevents tokens and passwords from appearing in logs or user-facing diagnostics.
/// </summary>
public static class LogRedaction
{
    private static readonly Regex[] SecretKeyPatterns =
    [
        // JSON: "token":"...", "deviceToken":"...", "password":"...", etc.
        CreateJsonSecretPattern("token"),
        CreateJsonSecretPattern("deviceToken"),
        CreateJsonSecretPattern("accessToken"),
        CreateJsonSecretPattern("refreshToken"),
        CreateJsonSecretPattern("password"),
        CreateJsonSecretPattern("secret"),
        CreateJsonSecretPattern("authorization"),
    ];

    private static Regex CreateJsonSecretPattern(string key)
    {
        // Match "key":"value" or "key": "value" (value: quoted string, possibly empty)
        return new Regex(
            $@"(""{Regex.Escape(key)}""\s*:\s*)""[^""]*""",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);
    }

    /// <summary>
    /// Redacts common secret fields from a string (e.g. API response body).
    /// Safe to call with null or empty; returns a non-null string suitable for logging or display.
    /// </summary>
    public static string RedactSecrets(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;

        var result = value;
        foreach (var pattern in SecretKeyPatterns)
        {
            result = pattern.Replace(result, "$1\"[REDACTED]\"");
        }

        return result;
    }
}
