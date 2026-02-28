using System.Reflection;
using System.Text.Json;
using AICFO.Connector.Shared.Models;

namespace AICFO.Connector.Shared.Services;

/// <summary>
/// Fetches connector discovery JSON (apiBaseUrl, update info) over HTTPS.
/// Caches last success in memory and optionally to discovery_cache.json.
/// </summary>
public interface IDiscoveryService
{
    /// <summary>
    /// Fetches discovery JSON from the given URL (or default). Returns (config, null) on success or (null, errorMessage) on failure.
    /// </summary>
    Task<(ConnectorDiscoveryConfig? Config, string? ErrorMessage)> FetchAsync(string? discoveryUrl = null, CancellationToken cancellationToken = default);

    /// <summary>Last successfully fetched config (in-memory cache).</summary>
    ConnectorDiscoveryConfig? LastSuccess { get; }

    /// <summary>Default discovery URL. Do not hardcode backend URL here.</summary>
    string DefaultDiscoveryUrl { get; }
}

public sealed class DiscoveryService : IDiscoveryService
{
    /// <summary>Discovery URL we control (Railway backend). aicfo.in returns 400 HTML; backend serves JSON.</summary>
    public const string DefaultDiscoveryUrlConstant = "https://web-production-be25.up.railway.app/.well-known/aicfo-connector.json";
    /// <summary>Fallback API base URL only when discovery fails and no api_url is saved.</summary>
    public const string FallbackApiBaseUrl = "https://web-production-be25.up.railway.app";

    /// <summary>Optional callback for safe diagnostics (e.g. set by Tray to log to Serilog). No secrets.</summary>
    public static Action<string>? LogWarning { get; set; }

    /// <summary>Optional callback for HTTP request logging (method, URL, status, duration). Set by Tray for [INF] logs.</summary>
    public static Action<string, int, long>? LogHttp { get; set; }

    private static string ConnectorVersion => typeof(DiscoveryService).Assembly.GetName().Version?.ToString(3) ?? "1.0";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private ConnectorDiscoveryConfig? _lastSuccess;
    private readonly string _cacheFilePath;

    public ConnectorDiscoveryConfig? LastSuccess => _lastSuccess;
    public string DefaultDiscoveryUrl => DefaultDiscoveryUrlConstant;

    public DiscoveryService()
    {
        _cacheFilePath = ConnectorPaths.DiscoveryCacheFile;
    }

    public async Task<(ConnectorDiscoveryConfig? Config, string? ErrorMessage)> FetchAsync(string? discoveryUrl = null, CancellationToken cancellationToken = default)
    {
        var url = string.IsNullOrWhiteSpace(discoveryUrl) ? DefaultDiscoveryUrlConstant : discoveryUrl.Trim();
        if (!url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return (null, "Discovery URL must use HTTPS.");
        }

        try
        {
            using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = true })
            {
                Timeout = TimeSpan.FromSeconds(10)
            };
            client.DefaultRequestHeaders.TryAddWithoutValidation("Accept", "application/json");
            client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", $"AICFOConnector/{ConnectorVersion}");
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var response = await client.GetAsync(url, HttpCompletionOption.ResponseContentRead, cancellationToken).ConfigureAwait(false);
            var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            sw.Stop();
            LogHttp?.Invoke(url, (int)response.StatusCode, sw.ElapsedMilliseconds);

            var safeSnippet = TruncateForLog(json, 300);

            if (!response.IsSuccessStatusCode)
            {
                var msg = $"Discovery failed: HTTP {(int)response.StatusCode}. Response (first 300 chars): {safeSnippet}";
                LogWarning?.Invoke(msg);
                return (null, msg);
            }

            ConnectorDiscoveryConfig? config;
            try
            {
                config = JsonSerializer.Deserialize<ConnectorDiscoveryConfig>(json, JsonOptions);
            }
            catch (JsonException ex)
            {
                var msg = $"Discovery invalid JSON: {ex.Message}. Response (first 300 chars): {safeSnippet}";
                LogWarning?.Invoke(msg);
                return (null, msg);
            }

            if (config is null)
            {
                var msg = $"Discovery response was empty or invalid JSON. Response (first 300 chars): {safeSnippet}";
                LogWarning?.Invoke(msg);
                return (null, msg);
            }

            _lastSuccess = config;
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(_cacheFilePath)!);
                File.WriteAllText(_cacheFilePath, json);
            }
            catch
            {
                // Non-fatal: in-memory cache still valid
            }

            return (config, null);
        }
        catch (TaskCanceledException)
        {
            return (null, "Discovery request timed out.");
        }
        catch (HttpRequestException ex)
        {
            return (null, $"Discovery request failed: {ex.Message}");
        }
        catch (Exception ex)
        {
            var msg = $"Discovery failed: {ex.Message}";
            LogWarning?.Invoke(msg);
            return (null, msg);
        }
    }

    private static string TruncateForLog(string? value, int maxLength)
    {
        if (string.IsNullOrEmpty(value)) return "(empty)";
        if (value.Length <= maxLength) return value;
        return value.Substring(0, maxLength) + "...";
    }
}
