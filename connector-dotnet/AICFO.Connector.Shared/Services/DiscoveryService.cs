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
    public const string DefaultDiscoveryUrlConstant = "https://aicfo.in/.well-known/aicfo-connector.json";
    /// <summary>Fallback API base URL only when discovery fails and no api_url is saved.</summary>
    public const string FallbackApiBaseUrl = "https://web-production-be25.up.railway.app";

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
            using var client = new HttpClient
            {
                Timeout = TimeSpan.FromSeconds(10)
            };
            client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", "AICFO-Connector/1.0");
            var response = await client.GetAsync(url, cancellationToken).ConfigureAwait(false);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            var config = JsonSerializer.Deserialize<ConnectorDiscoveryConfig>(json, JsonOptions);
            if (config is null)
            {
                return (null, "Discovery response was empty or invalid JSON.");
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
            return (null, $"Discovery failed: {ex.Message}");
        }
    }
}
