using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json;
using System.Linq;

namespace AICFOConnector.Core
{
    /// <summary>
    /// Client for connecting to Tally ERP API
    /// </summary>
    public class TallyClient : IDisposable
    {
        private readonly HttpClient _httpClient;
        private readonly string _baseUrl;
        private readonly int _timeoutSeconds;

        public TallyClient(string baseUrl = "http://localhost:9000", int timeoutSeconds = 30)
        {
            _baseUrl = baseUrl.TrimEnd('/');
            _timeoutSeconds = timeoutSeconds;
            
            _httpClient = new HttpClient
            {
                Timeout = TimeSpan.FromSeconds(timeoutSeconds),
                BaseAddress = new Uri(_baseUrl)
            };
            
            _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "AICFO-Tally-Connector/1.0");
        }

        /// <summary>
        /// Test connection to Tally server
        /// </summary>
        public async Task<bool> TestConnectionAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync("/health");
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                // Log error but don't throw - connection test should be safe
                System.Diagnostics.Debug.WriteLine($"Tally connection test failed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Get list of companies from Tally
        /// </summary>
        public async Task<List<TallyCompany>> GetCompaniesAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync("/companies");
                response.EnsureSuccessStatusCode();
                
                var content = await response.Content.ReadAsStringAsync();
                var companies = JsonConvert.DeserializeObject<List<TallyCompany>>(content);
                
                return companies ?? new List<TallyCompany>();
            }
            catch (Exception ex)
            {
                throw new TallyConnectionException($"Failed to fetch companies from Tally: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Get vouchers (transactions) from Tally
        /// </summary>
        public async Task<List<TallyVoucher>> GetVouchersAsync(string companyName, DateTime? fromDate = null, DateTime? toDate = null)
        {
            try
            {
                var url = $"/vouchers?company={Uri.EscapeDataString(companyName)}";
                
                if (fromDate.HasValue)
                    url += $"&from_date={fromDate.Value:yyyy-MM-dd}";
                if (toDate.HasValue)
                    url += $"&to_date={toDate.Value:yyyy-MM-dd}";

                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();
                
                var content = await response.Content.ReadAsStringAsync();
                var vouchers = JsonConvert.DeserializeObject<List<TallyVoucher>>(content);
                
                return vouchers ?? new List<TallyVoucher>();
            }
            catch (Exception ex)
            {
                throw new TallyConnectionException($"Failed to fetch vouchers from Tally: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Get ledgers (accounts) from Tally
        /// </summary>
        public async Task<List<TallyLedger>> GetLedgersAsync(string companyName)
        {
            try
            {
                var url = $"/ledgers?company={Uri.EscapeDataString(companyName)}";
                
                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();
                
                var content = await response.Content.ReadAsStringAsync();
                var ledgers = JsonConvert.DeserializeObject<List<TallyLedger>>(content);
                
                return ledgers ?? new List<TallyLedger>();
            }
            catch (Exception ex)
            {
                throw new TallyConnectionException($"Failed to fetch ledgers from Tally: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Get chart of accounts from Tally
        /// </summary>
        public async Task<TallyChartOfAccounts> GetChartOfAccountsAsync(string companyName)
        {
            try
            {
                var url = $"/chart-of-accounts?company={Uri.EscapeDataString(companyName)}";
                
                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();
                
                var content = await response.Content.ReadAsStringAsync();
                var coa = JsonConvert.DeserializeObject<TallyChartOfAccounts>(content);
                
                return coa ?? new TallyChartOfAccounts();
            }
            catch (Exception ex)
            {
                throw new TallyConnectionException($"Failed to fetch chart of accounts from Tally: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Get trial balance from Tally
        /// </summary>
        public async Task<TallyTrialBalance> GetTrialBalanceAsync(string companyName, DateTime? fromDate = null, DateTime? toDate = null)
        {
            try
            {
                var url = $"/trial-balance?company={Uri.EscapeDataString(companyName)}";
                
                if (fromDate.HasValue)
                    url += $"&from_date={fromDate.Value:yyyy-MM-dd}";
                if (toDate.HasValue)
                    url += $"&to_date={toDate.Value:yyyy-MM-dd}";

                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();
                
                var content = await response.Content.ReadAsStringAsync();
                var trialBalance = JsonConvert.DeserializeObject<TallyTrialBalance>(content);
                
                return trialBalance ?? new TallyTrialBalance();
            }
            catch (Exception ex)
            {
                throw new TallyConnectionException($"Failed to fetch trial balance from Tally: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Auto-detect Tally server port by trying common ports
        /// </summary>
        public static async Task<string> AutoDetectTallyUrlAsync()
        {
            var commonPorts = new[] { 9000, 8080, 8081, 8082, 9090, 9001, 9002 };
            var baseUrls = new[] { "http://localhost", "http://127.0.0.1" };

            foreach (var baseUrl in baseUrls)
            {
                foreach (var port in commonPorts)
                {
                    var testUrl = $"{baseUrl}:{port}";
                    try
                    {
                        using (var testClient = new TallyClient(testUrl, 5)) // Short timeout for detection
                        {
                            if (await testClient.TestConnectionAsync())
                            {
                                return testUrl;
                            }
                        }
                    }
                    catch
                    {
                        // Continue trying other ports
                    }
                }
            }

            return null; // No Tally found on common ports
        }

        public void Dispose()
        {
            _httpClient?.Dispose();
        }
    }

    /// <summary>
    /// Represents a Tally company
    /// </summary>
    public class TallyCompany
    {
        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("guid")]
        public string Guid { get; set; }

        [JsonProperty("startDate")]
        public DateTime? StartDate { get; set; }

        [JsonProperty("endDate")]
        public DateTime? EndDate { get; set; }

        [JsonProperty("isActive")]
        public bool IsActive { get; set; }
    }

    /// <summary>
    /// Represents a Tally voucher (transaction)
    /// </summary>
    public class TallyVoucher
    {
        [JsonProperty("guid")]
        public string Guid { get; set; }

        [JsonProperty("voucherNumber")]
        public string VoucherNumber { get; set; }

        [JsonProperty("voucherType")]
        public string VoucherType { get; set; }

        [JsonProperty("date")]
        public DateTime Date { get; set; }

        [JsonProperty("narration")]
        public string Narration { get; set; }

        [JsonProperty("amount")]
        public decimal Amount { get; set; }

        [JsonProperty("total")]
        public decimal Total { get; set; }

        [JsonProperty("partyName")]
        public string PartyName { get; set; }

        [JsonProperty("ledgerName")]
        public string LedgerName { get; set; }

        [JsonProperty("isReceipt")]
        public bool IsReceipt { get; set; }
    }

    /// <summary>
    /// Represents a Tally ledger (account)
    /// </summary>
    public class TallyLedger
    {
        [JsonProperty("guid")]
        public string Guid { get; set; }

        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("parent")]
        public string Parent { get; set; }

        [JsonProperty("groupName")]
        public string GroupName { get; set; }

        [JsonProperty("closingBalance")]
        public decimal ClosingBalance { get; set; }

        [JsonProperty("balance")]
        public decimal Balance { get; set; }
    }

    /// <summary>
    /// Represents Tally chart of accounts
    /// </summary>
    public class TallyChartOfAccounts
    {
        [JsonProperty("groups")]
        public List<TallyGroup> Groups { get; set; } = new List<TallyGroup>();

        [JsonProperty("ledgers")]
        public List<TallyLedger> Ledgers { get; set; } = new List<TallyLedger>();

        [JsonProperty("balances")]
        public TallyBalances Balances { get; set; } = new TallyBalances();
    }

    /// <summary>
    /// Represents a Tally group
    /// </summary>
    public class TallyGroup
    {
        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("parent")]
        public string Parent { get; set; }

        [JsonProperty("guid")]
        public string Guid { get; set; }

        [JsonProperty("reservedName")]
        public string ReservedName { get; set; }
    }

    /// <summary>
    /// Represents Tally balances
    /// </summary>
    public class TallyBalances
    {
        [JsonProperty("current")]
        public TallyBalanceEntry Current { get; set; }

        [JsonProperty("closedMonths")]
        public List<TallyBalanceEntry> ClosedMonths { get; set; } = new List<TallyBalanceEntry>();
    }

    /// <summary>
    /// Represents a balance entry
    /// </summary>
    public class TallyBalanceEntry
    {
        [JsonProperty("monthKey")]
        public string MonthKey { get; set; }

        [JsonProperty("asOfDate")]
        public DateTime AsOfDate { get; set; }

        [JsonProperty("items")]
        public List<TallyBalanceItem> Items { get; set; } = new List<TallyBalanceItem>();
    }

    /// <summary>
    /// Represents a single balance item
    /// </summary>
    public class TallyBalanceItem
    {
        [JsonProperty("ledgerGuid")]
        public string LedgerGuid { get; set; }

        [JsonProperty("balance")]
        public decimal Balance { get; set; }

        [JsonProperty("closingBalance")]
        public decimal ClosingBalance { get; set; }

        [JsonProperty("closing_balance")]
        public decimal ClosingBalanceAlt { get; set; }
    }

    /// <summary>
    /// Represents Tally trial balance
    /// </summary>
    public class TallyTrialBalance
    {
        [JsonProperty("companyName")]
        public string CompanyName { get; set; }

        [JsonProperty("asOfDate")]
        public DateTime AsOfDate { get; set; }

        [JsonProperty("debitTotal")]
        public decimal DebitTotal { get; set; }

        [JsonProperty("creditTotal")]
        public decimal CreditTotal { get; set; }

        [JsonProperty("ledgers")]
        public List<TallyTrialBalanceLedger> Ledgers { get; set; } = new List<TallyTrialBalanceLedger>();
    }

    /// <summary>
    /// Represents a ledger in trial balance
    /// </summary>
    public class TallyTrialBalanceLedger
    {
        [JsonProperty("ledgerName")]
        public string LedgerName { get; set; }

        [JsonProperty("debitAmount")]
        public decimal DebitAmount { get; set; }

        [JsonProperty("creditAmount")]
        public decimal CreditAmount { get; set; }

        [JsonProperty("groupName")]
        public string GroupName { get; set; }
    }

    /// <summary>
    /// Exception thrown when Tally connection fails
    /// </summary>
    public class TallyConnectionException : Exception
    {
        public TallyConnectionException(string message) : base(message) { }
        public TallyConnectionException(string message, Exception innerException) : base(message, innerException) { }
    }
}