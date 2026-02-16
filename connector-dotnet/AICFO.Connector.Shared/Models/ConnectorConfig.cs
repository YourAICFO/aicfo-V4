using System.Text.Json.Serialization;

namespace AICFO.Connector.Shared.Models;

public sealed class ConnectorConfig
{
    [JsonPropertyName("api_url")]
    public string ApiUrl { get; set; } = string.Empty;

    [JsonPropertyName("tally_host")]
    public string TallyHost { get; set; } = "127.0.0.1";

    [JsonPropertyName("tally_port")]
    public int TallyPort { get; set; } = 9000;

    [JsonPropertyName("heartbeat_interval_seconds")]
    public int HeartbeatIntervalSeconds { get; set; } = 30;

    [JsonPropertyName("sync_interval_minutes")]
    public int SyncIntervalMinutes { get; set; } = 15;

    [JsonPropertyName("mappings")]
    public List<ConnectorMapping> Mappings { get; set; } = [];

    // Legacy single-mapping fields kept for backward compatibility.
    [JsonPropertyName("company_id")]
    public string CompanyId { get; set; } = string.Empty;

    [JsonPropertyName("last_sync_at")]
    public DateTimeOffset? LastSyncAt { get; set; }

    [JsonPropertyName("last_heartbeat_at")]
    public DateTimeOffset? LastHeartbeatAt { get; set; }

    [JsonPropertyName("last_error")]
    public string? LastError { get; set; }

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(ApiUrl)) throw new InvalidOperationException("api_url is required");
        if (TallyPort <= 0) throw new InvalidOperationException("tally_port must be positive");
        if (HeartbeatIntervalSeconds < 10) throw new InvalidOperationException("heartbeat_interval_seconds must be >= 10");
        if (SyncIntervalMinutes < 1) throw new InvalidOperationException("sync_interval_minutes must be >= 1");
        foreach (var mapping in Mappings)
        {
            mapping.Validate();
        }
    }

    public void EnsureCompatibility()
    {
        // Migrate old single-company config into mappings list.
        if (Mappings.Count == 0 && !string.IsNullOrWhiteSpace(CompanyId))
        {
            Mappings.Add(new ConnectorMapping
            {
                Id = Guid.NewGuid().ToString("N"),
                CompanyId = CompanyId.Trim(),
                TallyCompanyName = "Primary",
                LastSyncAt = LastSyncAt,
                LastHeartbeatAt = LastHeartbeatAt,
                LastError = LastError
            });
        }

        foreach (var mapping in Mappings)
        {
            if (string.IsNullOrWhiteSpace(mapping.Id))
            {
                mapping.Id = Guid.NewGuid().ToString("N");
            }
        }
    }
}

public sealed class ConnectorMapping
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [JsonPropertyName("company_id")]
    public string CompanyId { get; set; } = string.Empty;

    [JsonPropertyName("tally_company_name")]
    public string TallyCompanyName { get; set; } = string.Empty;

    [JsonPropertyName("web_company_name")]
    public string? WebCompanyName { get; set; }

    [JsonPropertyName("auth_method")]
    public string? AuthMethod { get; set; }

    [JsonPropertyName("last_sync_at")]
    public DateTimeOffset? LastSyncAt { get; set; }

    [JsonPropertyName("last_heartbeat_at")]
    public DateTimeOffset? LastHeartbeatAt { get; set; }

    [JsonPropertyName("last_sync_result")]
    public string LastSyncResult { get; set; } = "Never";

    [JsonPropertyName("last_error")]
    public string? LastError { get; set; }

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(Id)) throw new InvalidOperationException("mapping.id is required");
        if (string.IsNullOrWhiteSpace(CompanyId)) throw new InvalidOperationException("mapping.company_id is required");
        if (string.IsNullOrWhiteSpace(TallyCompanyName)) throw new InvalidOperationException("mapping.tally_company_name is required");
    }
}
