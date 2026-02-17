using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AICFO.Connector.Shared.Models;
using Microsoft.Extensions.Logging;

namespace AICFO.Connector.Shared.Services;

public interface IAicfoApiClient
{
    Task<LoginResponse> LoginAsync(string baseUrl, string email, string password, CancellationToken cancellationToken);
    Task<List<WebCompany>> GetCompaniesAsync(string baseUrl, string userJwt, CancellationToken cancellationToken);
    Task<RegisterDeviceResponse> RegisterDeviceAsync(string baseUrl, string userJwt, string companyId, string deviceId, string deviceName, CancellationToken cancellationToken);
    Task<ConnectorStatusV1Response> GetConnectorStatusV1Async(string baseUrl, string userJwt, string companyId, CancellationToken cancellationToken);
    Task<bool> TestBackendReachableAsync(string apiUrl, CancellationToken cancellationToken);
    Task<Dictionary<string, object>?> GetConnectorStatusAsync(ConnectorConfig config, string token, CancellationToken cancellationToken);
    Task SendHeartbeatAsync(ConnectorConfig config, string token, CancellationToken cancellationToken);
    Task<string?> StartSyncRunAsync(ConnectorConfig config, string token, CancellationToken cancellationToken);
    Task SendSyncPayloadAsync(ConnectorConfig config, string token, CoaContractPayload payload, CancellationToken cancellationToken);
    Task CompleteSyncRunAsync(ConnectorConfig config, string token, string? runId, string status, string? lastError, CancellationToken cancellationToken);
}

public sealed class AicfoApiClient(HttpClient httpClient, ILogger<AicfoApiClient> logger) : IAicfoApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    public async Task<LoginResponse> LoginAsync(string baseUrl, string email, string password, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri($"{baseUrl.TrimEnd('/')}/api/connector/login"))
        {
            Content = JsonContent.Create(new { email, password })
        };
        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        var envelope = ParseEnvelope<JsonElement>(body);
        if (!response.IsSuccessStatusCode || !envelope.success)
        {
            throw new InvalidOperationException(envelope.error ?? "Login failed.");
        }
        var loginData = envelope.data;
        if (loginData.ValueKind != JsonValueKind.Object || !loginData.TryGetProperty("token", out var tokenElement))
        {
            throw new InvalidOperationException("Login failed: missing token in response.");
        }
        var token = tokenElement.GetString();
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new InvalidOperationException("Login failed: empty token in response.");
        }

        return new LoginResponse { Token = token };
    }

    public async Task<List<WebCompany>> GetCompaniesAsync(string baseUrl, string userJwt, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri($"{baseUrl.TrimEnd('/')}/api/connector/companies"));
        request.Headers.Authorization = new("Bearer", userJwt);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        var envelope = ParseEnvelope<JsonElement>(body);
        if (!response.IsSuccessStatusCode || !envelope.success)
        {
            throw new InvalidOperationException(envelope.error ?? "Failed to fetch companies.");
        }
        var companiesData = envelope.data;
        if (companiesData.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var companies = new List<WebCompany>();
        foreach (var item in companiesData.EnumerateArray())
        {
            if (!item.TryGetProperty("id", out var idElement) || !item.TryGetProperty("name", out var nameElement))
            {
                continue;
            }
            var id = idElement.GetString();
            var name = nameElement.GetString();
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name))
            {
                continue;
            }
            companies.Add(new WebCompany
            {
                Id = id,
                Name = name,
                Currency = item.TryGetProperty("currency", out var currencyElement) ? currencyElement.GetString() : null
            });
        }

        return companies;
    }

    public async Task<RegisterDeviceResponse> RegisterDeviceAsync(string baseUrl, string userJwt, string companyId, string deviceId, string deviceName, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri($"{baseUrl.TrimEnd('/')}/api/connector/register-device"))
        {
            Content = JsonContent.Create(new { companyId, deviceId, deviceName })
        };
        request.Headers.Authorization = new("Bearer", userJwt);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        var envelope = ParseEnvelope<JsonElement>(body);
        if (!response.IsSuccessStatusCode || !envelope.success)
        {
            throw new InvalidOperationException(envelope.error ?? "Register device failed.");
        }
        var data = envelope.data;
        if (data.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidOperationException("Register device failed: missing response data.");
        }
        var deviceToken = data.TryGetProperty("deviceToken", out var tokenElement) ? tokenElement.GetString() : null;
        var returnedCompanyId = data.TryGetProperty("companyId", out var companyElement) ? companyElement.GetString() : null;
        var returnedDeviceId = data.TryGetProperty("deviceId", out var deviceElement) ? deviceElement.GetString() : null;
        var status = data.TryGetProperty("status", out var statusElement) ? statusElement.GetString() : null;

        if (string.IsNullOrWhiteSpace(deviceToken) || string.IsNullOrWhiteSpace(returnedCompanyId) || string.IsNullOrWhiteSpace(returnedDeviceId) || string.IsNullOrWhiteSpace(status))
        {
            throw new InvalidOperationException("Register device failed: incomplete response payload.");
        }

        return new RegisterDeviceResponse
        {
            DeviceToken = deviceToken,
            CompanyId = returnedCompanyId,
            DeviceId = returnedDeviceId,
            Status = status,
            ExpiresInDays = data.TryGetProperty("expiresInDays", out var expiryElement) ? expiryElement.GetInt32() : 0
        };
    }

    public async Task<ConnectorStatusV1Response> GetConnectorStatusV1Async(string baseUrl, string userJwt, string companyId, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri($"{baseUrl.TrimEnd('/')}/api/connector/status/v1?companyId={Uri.EscapeDataString(companyId)}"));
        request.Headers.Authorization = new("Bearer", userJwt);
        request.Headers.TryAddWithoutValidation("x-company-id", companyId);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        var envelope = ParseEnvelope<ConnectorStatusV1Response>(body);

        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            throw new UnauthorizedAccessException(envelope.error ?? "Session expired. Please login again.");
        }

        if (!response.IsSuccessStatusCode || !envelope.success)
        {
            throw new InvalidOperationException(envelope.error ?? "Failed to fetch connector status.");
        }

        if (envelope.data is null)
        {
            throw new InvalidOperationException("Failed to fetch connector status: missing response data.");
        }

        return envelope.data;
    }

    public async Task<bool> TestBackendReachableAsync(string apiUrl, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(apiUrl)) return false;
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri($"{apiUrl.TrimEnd('/')}/health"));
        using var response = await httpClient.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode;
    }

    public async Task<Dictionary<string, object>?> GetConnectorStatusAsync(ConnectorConfig config, string token, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(HttpMethod.Get, config, "/api/connector/status/connector", token);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        return JsonSerializer.Deserialize<Dictionary<string, object>>(body, JsonOptions);
    }

    public async Task SendHeartbeatAsync(ConnectorConfig config, string token, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(HttpMethod.Post, config, "/api/connector/heartbeat", token, new { at = DateTime.UtcNow.ToString("O") });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    public async Task<string?> StartSyncRunAsync(ConnectorConfig config, string token, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(HttpMethod.Post, config, "/api/connector/sync/start", token, new { at = DateTime.UtcNow.ToString("O") });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        using var document = JsonDocument.Parse(body);
        if (document.RootElement.TryGetProperty("data", out var data) && data.TryGetProperty("runId", out var runIdElement))
        {
            return runIdElement.GetString();
        }

        return null;
    }

    public async Task SendSyncPayloadAsync(ConnectorConfig config, string token, CoaContractPayload payload, CancellationToken cancellationToken)
    {
        var serialized = JsonSerializer.Serialize(payload, JsonOptions);
        var payloadHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(serialized))).ToLowerInvariant();

        using var request = CreateRequest(HttpMethod.Post, config, "/api/connector/sync", token, payload, payloadHash);
        using var response = await httpClient.SendAsync(request, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var failureBody = await response.Content.ReadAsStringAsync(cancellationToken);
            logger.LogError("Sync payload rejected status={StatusCode} body={Body}", response.StatusCode, failureBody);
        }

        response.EnsureSuccessStatusCode();
    }

    public async Task CompleteSyncRunAsync(ConnectorConfig config, string token, string? runId, string status, string? lastError, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(runId)) return;

        using var request = CreateRequest(HttpMethod.Post, config, "/api/connector/sync/complete", token, new
        {
            runId,
            status,
            finishedAt = DateTime.UtcNow.ToString("O"),
            lastError
        });

        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    private static HttpRequestMessage CreateRequest(HttpMethod method, ConnectorConfig config, string path, string token, object? body = null, string? payloadHash = null)
    {
        var baseUri = config.ApiUrl.TrimEnd('/');
        var request = new HttpRequestMessage(method, new Uri($"{baseUri}{path}"));
        request.Headers.Authorization = new("Bearer", token);

        if (!string.IsNullOrWhiteSpace(payloadHash))
        {
            request.Headers.Add("X-Payload-Hash", payloadHash);
        }

        if (body != null)
        {
            request.Content = JsonContent.Create(body);
        }

        return request;
    }

    private static (bool success, T? data, string? error) ParseEnvelope<T>(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return (false, default, "Empty response from backend.");
        }

        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            var success = root.TryGetProperty("success", out var successElement) && successElement.ValueKind == JsonValueKind.True;
            var error = root.TryGetProperty("error", out var errorElement) ? errorElement.GetString() : null;
            if (!root.TryGetProperty("data", out var dataElement))
            {
                return (success, default, error);
            }

            var data = JsonSerializer.Deserialize<T>(dataElement.GetRawText(), JsonOptions);
            return (success, data, error);
        }
        catch (JsonException)
        {
            return (false, default, "Invalid JSON response from backend.");
        }
    }
}
