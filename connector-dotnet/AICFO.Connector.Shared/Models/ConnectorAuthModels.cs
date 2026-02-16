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

