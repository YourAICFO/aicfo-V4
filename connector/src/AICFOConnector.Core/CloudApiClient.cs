using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace AICFOConnector.Core
{
    /// <summary>
    /// Client for communicating with AI CFO cloud API
    /// </summary>
    public class CloudApiClient : IDisposable
    {
        private readonly HttpClient _httpClient;
        private readonly string _baseUrl;
        private string _authToken;
        private DateTime _tokenExpiry;

        public CloudApiClient(string baseUrl = "https://aicfo-api.railway.app")
        {
            _baseUrl = baseUrl.TrimEnd('/');
            _httpClient = new HttpClient
            {
                BaseAddress = new Uri(_baseUrl),
                Timeout = TimeSpan.FromMinutes(5) // Long timeout for large data uploads
            };
            
            _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "AICFO-Tally-Connector/1.0");
        }

        #region Authentication

        /// <summary>
        /// Authenticate with AI CFO cloud using short-lived token
        /// </summary>
        public async Task<bool> AuthenticateAsync(string apiKey)
        {
            try
            {
                var authRequest = new
                {
                    apiKey = apiKey,
                    clientId = "tally-connector",
                    clientVersion = "1.0.0"
                };

                var json = JsonConvert.SerializeObject(authRequest);
                var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync("/api/auth/connector", content);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();
                var authResponse = JsonConvert.DeserializeObject<AuthResponse>(responseContent);

                if (authResponse?.Success == true && !string.IsNullOrEmpty(authResponse.Token))
                {
                    _authToken = authResponse.Token;
                    _tokenExpiry = DateTime.Now.AddMinutes(authResponse.ExpiresInMinutes - 1); // Refresh 1 minute early
                    
                    UpdateAuthenticationHeader();
                    return true;
                }

                return false;
            }
            catch (Exception ex)
            {
                throw new CloudApiException($"Authentication failed: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Check if current token is still valid
        /// </summary>
        public bool IsTokenValid()
        {
            return !string.IsNullOrEmpty(_authToken) && DateTime.Now < _tokenExpiry;
        }

        /// <summary>
        /// Refresh authentication token if needed
        /// </summary>
        public async Task<bool> RefreshTokenIfNeededAsync()
        {
            if (IsTokenValid())
                return true;

            if (string.IsNullOrEmpty(_authToken))
                return false;

            try
            {
                // Try to refresh using existing token
                var refreshRequest = new
                {
                    token = _authToken,
                    clientId = "tally-connector"
                };

                var json = JsonConvert.SerializeObject(refreshRequest);
                var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync("/api/auth/refresh", content);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();
                var refreshResponse = JsonConvert.DeserializeObject<AuthResponse>(responseContent);

                if (refreshResponse?.Success == true && !string.IsNullOrEmpty(refreshResponse.Token))
                {
                    _authToken = refreshResponse.Token;
                    _tokenExpiry = DateTime.Now.AddMinutes(refreshResponse.ExpiresInMinutes - 1);
                    
                    UpdateAuthenticationHeader();
                    return true;
                }

                return false;
            }
            catch
            {
                // Refresh failed, need to re-authenticate
                _authToken = null;
                return false;
            }
        }

        private void UpdateAuthenticationHeader()
        {
            if (!string.IsNullOrEmpty(_authToken))
            {
                _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _authToken);
            }
            else
            {
                _httpClient.DefaultRequestHeaders.Authorization = null;
            }
        }

        #endregion

        #region Company Management

        /// <summary>
        /// Register or update company information
        /// </summary>
        public async Task<string> RegisterCompanyAsync(string companyName, string pan, string gstin)
        {
            try
            {
                await RefreshTokenIfNeededAsync();

                var companyData = new
                {
                    name = companyName,
                    pan = pan,
                    gstin = gstin,
                    sourceSystem = "TALLY"
                };

                var json = JsonConvert.SerializeObject(companyData);
                var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync("/api/companies/register", content);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();
                var result = JsonConvert.DeserializeObject<CompanyRegistrationResponse>(responseContent);

                return result?.CompanyId;
            }
            catch (Exception ex)
            {
                throw new CloudApiException($"Company registration failed: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Get company details
        /// </summary>
        public async Task<CompanyInfo> GetCompanyAsync(string companyId)
        {
            try
            {
                await RefreshTokenIfNeededAsync();

                var response = await _httpClient.GetAsync($"/api/companies/{companyId}");
                response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync();
                return JsonConvert.DeserializeObject<CompanyInfo>(content);
            }
            catch (Exception ex)
            {
                throw new CloudApiException($"Failed to get company: {ex.Message}", ex);
            }
        }

        #endregion

        #region Data Upload

        /// <summary>
        /// Upload financial data to AI CFO cloud
        /// </summary>
        public async Task<UploadResult> UploadFinancialDataAsync(CloudDataPackage dataPackage)
        {
            try
            {
                await RefreshTokenIfNeededAsync();

                var json = JsonConvert.SerializeObject(dataPackage);
                var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync("/api/integrations/tally/upload", content);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();
                var uploadResponse = JsonConvert.DeserializeObject<UploadResponse>(responseContent);

                return new UploadResult
                {
                    Success = uploadResponse?.Success ?? false,
                    TransactionId = uploadResponse?.TransactionId,
                    ErrorMessage = uploadResponse?.ErrorMessage
                };
            }
            catch (Exception ex)
            {
                throw new CloudApiException($"Data upload failed: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Check sync status
        /// </summary>
        public async Task<SyncStatus> GetSyncStatusAsync(string companyId)
        {
            try
            {
                await RefreshTokenIfNeededAsync();

                var response = await _httpClient.GetAsync($"/api/sync/status?companyId={companyId}");
                response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync();
                return JsonConvert.DeserializeObject<SyncStatus>(content);
            }
            catch (Exception ex)
            {
                throw new CloudApiException($"Failed to get sync status: {ex.Message}", ex);
            }
        }

        #endregion

        #region Health and Monitoring

        /// <summary>
        /// Test connection to cloud API
        /// </summary>
        public async Task<bool> TestConnectionAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync("/health");
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Get API usage statistics
        /// </summary>
        public async Task<ApiUsageStats> GetUsageStatsAsync()
        {
            try
            {
                await RefreshTokenIfNeededAsync();

                var response = await _httpClient.GetAsync("/api/usage/stats");
                response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync();
                return JsonConvert.DeserializeObject<ApiUsageStats>(content);
            }
            catch (Exception ex)
            {
                throw new CloudApiException($"Failed to get usage stats: {ex.Message}", ex);
            }
        }

        #endregion

        public void Dispose()
        {
            _httpClient?.Dispose();
        }
    }

    #region Authentication Models

    public class AuthResponse
    {
        [JsonProperty("success")]
        public bool Success { get; set; }

        [JsonProperty("token")]
        public string Token { get; set; }

        [JsonProperty("expiresInMinutes")]
        public int ExpiresInMinutes { get; set; }

        [JsonProperty("errorMessage")]
        public string ErrorMessage { get; set; }
    }

    #endregion

    #region Company Models

    public class CompanyRegistrationResponse
    {
        [JsonProperty("success")]
        public bool Success { get; set; }

        [JsonProperty("companyId")]
        public string CompanyId { get; set; }

        [JsonProperty("message")]
        public string Message { get; set; }
    }

    public class CompanyInfo
    {
        [JsonProperty("id")]
        public string Id { get; set; }

        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("pan")]
        public string Pan { get; set; }

        [JsonProperty("gstin")]
        public string Gstin { get; set; }

        [JsonProperty("status")]
        public string Status { get; set; }

        [JsonProperty("createdAt")]
        public DateTime CreatedAt { get; set; }
    }

    #endregion

    #region Sync Models

    public class SyncStatus
    {
        [JsonProperty("status")]
        public string Status { get; set; }

        [JsonProperty("lastSnapshotMonth")]
        public string LastSnapshotMonth { get; set; }

        [JsonProperty("lastBalanceAsOfDate")]
        public DateTime? LastBalanceAsOfDate { get; set; }

        [JsonProperty("errorMessage")]
        public string ErrorMessage { get; set; }

        [JsonProperty("lastSyncCompletedAt")]
        public DateTime? LastSyncCompletedAt { get; set; }
    }

    public class UploadResponse
    {
        [JsonProperty("success")]
        public bool Success { get; set; }

        [JsonProperty("transactionId")]
        public string TransactionId { get; set; }

        [JsonProperty("message")]
        public string Message { get; set; }

        [JsonProperty("errorMessage")]
        public string ErrorMessage { get; set; }
    }

    #endregion

    #region Usage Models

    public class ApiUsageStats
    {
        [JsonProperty("totalRequests")]
        public int TotalRequests { get; set; }

        [JsonProperty("successfulRequests")]
        public int SuccessfulRequests { get; set; }

        [JsonProperty("failedRequests")]
        public int FailedRequests { get; set; }

        [JsonProperty("lastRequestAt")]
        public DateTime? LastRequestAt { get; set; }

        [JsonProperty("quotaRemaining")]
        public int QuotaRemaining { get; set; }

        [JsonProperty("quotaResetDate")]
        public DateTime QuotaResetDate { get; set; }
    }

    #endregion

    #region Exception Classes

    public class CloudApiException : Exception
    {
        public CloudApiException(string message) : base(message) { }
        public CloudApiException(string message, Exception innerException) : base(message, innerException) { }
    }

    #endregion
}