using System.Text.Json.Serialization;

namespace AICFO.Connector.Shared.Models;

public sealed class LoginResponse
{
    [JsonPropertyName("token")]
    public string Token { get; init; } = string.Empty;

    [JsonPropertyName("user")]
    public LoginUser? User { get; init; }
}

public sealed class LoginUser
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("email")]
    public string Email { get; init; } = string.Empty;

    [JsonPropertyName("firstName")]
    public string? FirstName { get; init; }

    [JsonPropertyName("lastName")]
    public string? LastName { get; init; }
}

public sealed class WebCompany
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("currency")]
    public string? Currency { get; init; }
}

public sealed class RegisterDeviceResponse
{
    [JsonPropertyName("deviceToken")]
    public string DeviceToken { get; init; } = string.Empty;

    [JsonPropertyName("companyId")]
    public string CompanyId { get; init; } = string.Empty;

    [JsonPropertyName("deviceId")]
    public string DeviceId { get; init; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; init; } = string.Empty;

    [JsonPropertyName("expiresInDays")]
    public int ExpiresInDays { get; init; }
}

public sealed class ConnectorStatusV1Response
{
    [JsonPropertyName("companyId")]
    public string? CompanyId { get; init; }

    [JsonPropertyName("connector")]
    public ConnectorStatusV1Connector? Connector { get; init; }

    [JsonPropertyName("sync")]
    public ConnectorStatusV1Sync? Sync { get; init; }

    [JsonPropertyName("dataReadiness")]
    public ConnectorStatusV1DataReadiness? DataReadiness { get; init; }
}

public sealed class ConnectorStatusV1Connector
{
    [JsonPropertyName("isOnline")]
    public bool? IsOnline { get; init; }

    [JsonPropertyName("lastSeenAt")]
    public DateTimeOffset? LastSeenAt { get; init; }

    [JsonPropertyName("deviceId")]
    public string? DeviceId { get; init; }

    [JsonPropertyName("deviceName")]
    public string? DeviceName { get; init; }

    [JsonPropertyName("status")]
    public string? Status { get; init; }

    [JsonPropertyName("authMode")]
    public string? AuthType { get; init; }
}

public sealed class ConnectorStatusV1Sync
{
    [JsonPropertyName("lastRunId")]
    public string? LastRunId { get; init; }

    [JsonPropertyName("lastRunStatus")]
    public string? Status { get; init; }

    [JsonPropertyName("lastRunStartedAt")]
    public DateTimeOffset? StartedAt { get; init; }

    [JsonPropertyName("lastRunCompletedAt")]
    public DateTimeOffset? CompletedAt { get; init; }

    [JsonPropertyName("lastEventAt")]
    public DateTimeOffset? LastEventAt { get; init; }

    [JsonPropertyName("lastError")]
    public string? LastError { get; init; }
}

public sealed class ConnectorStatusV1DataReadiness
{
    [JsonPropertyName("status")]
    public string? Status { get; init; }

    [JsonPropertyName("latestMonthKey")]
    public string? MonthKey { get; init; }

    [JsonPropertyName("lastValidatedAt")]
    public DateTimeOffset? UpdatedAt { get; init; }

    [JsonPropertyName("reason")]
    public string? Reason { get; init; }
}
