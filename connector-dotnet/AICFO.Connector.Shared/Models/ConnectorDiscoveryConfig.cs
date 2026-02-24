using System.Text.Json.Serialization;

namespace AICFO.Connector.Shared.Models;

/// <summary>
/// JSON shape returned by the discovery endpoint (e.g. .well-known/aicfo-connector.json).
/// </summary>
public sealed class ConnectorDiscoveryConfig
{
    [JsonPropertyName("apiBaseUrl")]
    public string ApiBaseUrl { get; set; } = string.Empty;

    [JsonPropertyName("latestConnectorVersion")]
    public string LatestConnectorVersion { get; set; } = string.Empty;

    [JsonPropertyName("minConnectorVersion")]
    public string MinConnectorVersion { get; set; } = string.Empty;

    [JsonPropertyName("downloadUrl")]
    public string DownloadUrl { get; set; } = string.Empty;

    [JsonPropertyName("releaseNotesUrl")]
    public string ReleaseNotesUrl { get; set; } = string.Empty;

    [JsonPropertyName("timestamp")]
    public string Timestamp { get; set; } = string.Empty;
}
