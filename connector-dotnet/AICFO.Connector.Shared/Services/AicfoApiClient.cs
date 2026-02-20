using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using AICFO.Connector.Shared.Models;
using Microsoft.Extensions.Logging;

namespace AICFO.Connector.Shared.Services;

public interface IAicfoApiClient
{
    Task<DeviceLoginResponse> DeviceLoginAsync(string baseUrl, string email, string password, string? deviceId, string? deviceName, CancellationToken cancellationToken);
    Task<LoginResponse> LoginAsync(string baseUrl, string email, string password, CancellationToken cancellationToken);
    Task<List<WebCompany>> GetCompaniesAsync(string baseUrl, string authToken, bool useDeviceRoute, CancellationToken cancellationToken);
    Task<List<ConnectorDeviceLink>> GetDeviceLinksAsync(string baseUrl, string deviceToken, CancellationToken cancellationToken);
    Task<ConnectorDeviceLink> CreateDeviceLinkAsync(string baseUrl, string deviceToken, string companyId, string tallyCompanyId, string tallyCompanyName, CancellationToken cancellationToken);
    Task UnlinkDeviceLinkAsync(string baseUrl, string deviceToken, string linkId, CancellationToken cancellationToken);
    Task<RegisterDeviceResponse> RegisterDeviceAsync(string baseUrl, string userJwt, string companyId, string deviceId, string deviceName, CancellationToken cancellationToken);
    Task<ConnectorStatusV1Response> GetConnectorStatusV1Async(string baseUrl, string userJwt, string companyId, CancellationToken cancellationToken);
    Task<bool> TestBackendReachableAsync(string apiUrl, CancellationToken cancellationToken);
    Task<Dictionary<string, object>?> GetConnectorStatusAsync(ConnectorConfig config, ConnectorMapping mapping, string token, CancellationToken cancellationToken);
    Task SendHeartbeatAsync(ConnectorConfig config, ConnectorMapping mapping, string token, CancellationToken cancellationToken);
    Task<string?> StartSyncRunAsync(ConnectorConfig config, ConnectorMapping mapping, string token, CancellationToken cancellationToken);
    Task SendSyncPayloadAsync(ConnectorConfig config, ConnectorMapping mapping, string token, CoaContractPayload payload, CancellationToken cancellationToken);
    Task CompleteSyncRunAsync(ConnectorConfig config, ConnectorMapping mapping, string token, string? runId, string status, string? lastError, CancellationToken cancellationToken);
}

public sealed class AicfoApiClient(HttpClient httpClient, ILogger<AicfoApiClient> logger) : IAicfoApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };
    private static readonly JsonSerializerOptions RequestJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public async Task<DeviceLoginResponse> DeviceLoginAsync(string baseUrl, string email, string password, string? deviceId, string? deviceName, CancellationToken cancellationToken)
    {
        const string endpointPath = "/api/connector/device/login";
        var body = new
        {
            email,
            password,
            deviceId,
            deviceName
        };
        var responseEnvelope = await PostJsonAsync(baseUrl, endpointPath, body, cancellationToken);
        var envelope = ParseEnvelope<JsonElement>(responseEnvelope.responseBody);
        if (!responseEnvelope.isSuccessStatusCode || !envelope.success)
        {
            throw new ApiRequestException(
                envelope.error ?? "Login failed.",
                baseUrl,
                endpointPath,
                responseEnvelope.statusCode,
                responseEnvelope.responseBody);
        }
        var loginData = envelope.data;
        if (loginData.ValueKind != JsonValueKind.Object || !loginData.TryGetProperty("deviceToken", out var tokenElement))
        {
            throw new InvalidOperationException("Login failed: missing device token in response.");
        }
        var token = tokenElement.GetString();
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new InvalidOperationException("Login failed: empty device token in response.");
        }

        return new DeviceLoginResponse { DeviceToken = token };
    }

    public async Task<LoginResponse> LoginAsync(string baseUrl, string email, string password, CancellationToken cancellationToken)
    {
        const string endpointPath = "/api/connector/login";
        var body = new ConnectorLoginRequest
        {
            Email = email,
            Password = password
        };
        var responseEnvelope = await PostJsonAsync(baseUrl, endpointPath, body, cancellationToken);
        var envelope = ParseEnvelope<JsonElement>(responseEnvelope.responseBody);
        if (!responseEnvelope.isSuccessStatusCode || !envelope.success)
        {
            throw new ApiRequestException(
                envelope.error ?? "Login failed.",
                baseUrl,
                endpointPath,
                responseEnvelope.statusCode,
                responseEnvelope.responseBody);
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

    public async Task<List<WebCompany>> GetCompaniesAsync(string baseUrl, string authToken, bool useDeviceRoute, CancellationToken cancellationToken)
    {
        var route = useDeviceRoute ? "/api/connector/device/companies" : "/api/connector/companies";
        using var request = new HttpRequestMessage(HttpMethod.Get, BuildApiUri(baseUrl, route));
        request.Headers.Authorization = new("Bearer", authToken);
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

    public async Task<List<ConnectorDeviceLink>> GetDeviceLinksAsync(string baseUrl, string deviceToken, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, BuildApiUri(baseUrl, "/api/connector/device/links"));
        request.Headers.Authorization = new("Bearer", deviceToken);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        var envelope = ParseEnvelope<List<ConnectorDeviceLink>>(body);
        if (!response.IsSuccessStatusCode || !envelope.success)
        {
            throw new InvalidOperationException(envelope.error ?? "Failed to fetch links.");
        }
        return envelope.data ?? [];
    }

    public async Task<ConnectorDeviceLink> CreateDeviceLinkAsync(string baseUrl, string deviceToken, string companyId, string tallyCompanyId, string tallyCompanyName, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, BuildApiUri(baseUrl, "/api/connector/device/links"))
        {
            Content = JsonContent.Create(new
            {
                companyId,
                tallyCompanyId,
                tallyCompanyName
            })
        };
        request.Headers.Authorization = new("Bearer", deviceToken);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        var envelope = ParseEnvelope<ConnectorDeviceLink>(body);
        if (!response.IsSuccessStatusCode || !envelope.success || envelope.data is null)
        {
            throw new InvalidOperationException(envelope.error ?? "Failed to create link.");
        }
        return envelope.data;
    }

    public async Task UnlinkDeviceLinkAsync(string baseUrl, string deviceToken, string linkId, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, BuildApiUri(baseUrl, $"/api/connector/device/links/{Uri.EscapeDataString(linkId)}/unlink"));
        request.Headers.Authorization = new("Bearer", deviceToken);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        var envelope = ParseEnvelope<JsonElement>(body);
        if (!response.IsSuccessStatusCode || !envelope.success)
        {
            throw new InvalidOperationException(envelope.error ?? "Failed to unlink.");
        }
    }

    public async Task<RegisterDeviceResponse> RegisterDeviceAsync(string baseUrl, string userJwt, string companyId, string deviceId, string deviceName, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, BuildApiUri(baseUrl, "/api/connector/register-device"))
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
        using var request = new HttpRequestMessage(HttpMethod.Get, BuildApiUri(baseUrl, $"/api/connector/status/v1?companyId={Uri.EscapeDataString(companyId)}"));
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
        using var request = new HttpRequestMessage(HttpMethod.Get, BuildApiUri(apiUrl, "/health"));
        using var response = await httpClient.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode;
    }

    public async Task<Dictionary<string, object>?> GetConnectorStatusAsync(ConnectorConfig config, ConnectorMapping mapping, string token, CancellationToken cancellationToken)
    {
        var path = string.IsNullOrWhiteSpace(mapping.LinkId)
            ? "/api/connector/status/connector"
            : $"/api/connector/status/connector?linkId={Uri.EscapeDataString(mapping.LinkId)}";
        using var request = CreateRequest(HttpMethod.Get, config, path, token);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        return JsonSerializer.Deserialize<Dictionary<string, object>>(body, JsonOptions);
    }

    public async Task SendHeartbeatAsync(ConnectorConfig config, ConnectorMapping mapping, string token, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(HttpMethod.Post, config, "/api/connector/heartbeat", token, new
        {
            at = DateTime.UtcNow.ToString("O"),
            linkId = mapping.LinkId
        });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    public async Task<string?> StartSyncRunAsync(ConnectorConfig config, ConnectorMapping mapping, string token, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(HttpMethod.Post, config, "/api/connector/sync/start", token, new
        {
            at = DateTime.UtcNow.ToString("O"),
            linkId = mapping.LinkId
        });
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

    public async Task SendSyncPayloadAsync(ConnectorConfig config, ConnectorMapping mapping, string token, CoaContractPayload payload, CancellationToken cancellationToken)
    {
        var syncEnvelope = new
        {
            linkId = mapping.LinkId,
            chartOfAccounts = payload.ChartOfAccounts,
            asOfDate = payload.AsOfDate,
            partyBalances = payload.PartyBalances,
            loans = payload.Loans,
            interestSummary = payload.InterestSummary,
            metadata = payload.Metadata
        };
        var serialized = JsonSerializer.Serialize(syncEnvelope, JsonOptions);
        var payloadHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(serialized))).ToLowerInvariant();

        using var request = CreateRequest(HttpMethod.Post, config, "/api/connector/sync", token, syncEnvelope, payloadHash);
        using var response = await httpClient.SendAsync(request, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var failureBody = await response.Content.ReadAsStringAsync(cancellationToken);
            var redacted = LogRedaction.RedactSecrets(failureBody);
            logger.LogError("Sync payload rejected status={StatusCode} body={Body}", response.StatusCode, redacted);
        }

        response.EnsureSuccessStatusCode();
    }

    public async Task CompleteSyncRunAsync(ConnectorConfig config, ConnectorMapping mapping, string token, string? runId, string status, string? lastError, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(runId)) return;

        using var request = CreateRequest(HttpMethod.Post, config, "/api/connector/sync/complete", token, new
        {
            linkId = mapping.LinkId,
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
        var request = new HttpRequestMessage(method, BuildApiUri(config.ApiUrl, path));
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

    private static Uri BuildApiUri(string baseUrl, string path)
    {
        var normalizedBase = string.IsNullOrWhiteSpace(baseUrl) ? string.Empty : $"{baseUrl.TrimEnd('/')}/";
        return new Uri(new Uri(normalizedBase, UriKind.Absolute), path.TrimStart('/'));
    }

    private async Task<(bool isSuccessStatusCode, int statusCode, string responseBody)> PostJsonAsync<TBody>(string baseUrl, string endpointPath, TBody body, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, BuildApiUri(baseUrl, endpointPath))
        {
            Content = JsonContent.Create(body, options: RequestJsonOptions)
        };
        request.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        return (response.IsSuccessStatusCode, (int)response.StatusCode, responseBody);
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

public sealed class ApiRequestException(
    string message,
    string baseUrl,
    string endpointPath,
    int statusCode,
    string? responseBody) : InvalidOperationException(message)
{
    public string BaseUrl { get; } = baseUrl;
    public string EndpointPath { get; } = endpointPath;
    public int StatusCode { get; } = statusCode;
    public string? ResponseBody { get; } = responseBody;
}

internal sealed class ConnectorLoginRequest
{
    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;
}
