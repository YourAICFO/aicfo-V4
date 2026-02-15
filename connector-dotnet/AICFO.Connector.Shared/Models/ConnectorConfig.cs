using System.Text.Json.Serialization;

namespace AICFO.Connector.Shared.Models;

public sealed class ConnectorConfig
{
    [JsonPropertyName("api_url")]
    public string ApiUrl { get; set; } = string.Empty;

    [JsonPropertyName("company_id")]
    public string CompanyId { get; set; } = string.Empty;

    [JsonPropertyName("tally_host")]
    public string TallyHost { get; set; } = "127.0.0.1";

    [JsonPropertyName("tally_port")]
    public int TallyPort { get; set; } = 9000;

    [JsonPropertyName("heartbeat_interval_seconds")]
    public int HeartbeatIntervalSeconds { get; set; } = 30;

    [JsonPropertyName("sync_interval_minutes")]
    public int SyncIntervalMinutes { get; set; } = 15;

    [JsonPropertyName("last_sync_at")]
    public DateTimeOffset? LastSyncAt { get; set; }

    [JsonPropertyName("last_heartbeat_at")]
    public DateTimeOffset? LastHeartbeatAt { get; set; }

    [JsonPropertyName("last_error")]
    public string? LastError { get; set; }

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(ApiUrl)) throw new InvalidOperationException("api_url is required");
        if (string.IsNullOrWhiteSpace(CompanyId)) throw new InvalidOperationException("company_id is required");
        if (TallyPort <= 0) throw new InvalidOperationException("tally_port must be positive");
        if (HeartbeatIntervalSeconds < 10) throw new InvalidOperationException("heartbeat_interval_seconds must be >= 10");
        if (SyncIntervalMinutes < 1) throw new InvalidOperationException("sync_interval_minutes must be >= 1");
    }
}
