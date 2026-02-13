using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Newtonsoft.Json;

namespace AICFOConnector.Core
{
    /// <summary>
    /// Main service that orchestrates Tally data synchronization
    /// </summary>
    public class ConnectorService : IDisposable
    {
        private readonly TallyClient _tallyClient;
        private readonly CloudApiClient _cloudApiClient;
        private readonly IConnectorLogger _logger;
        private readonly Timer _autoSyncTimer;
        
        private string _selectedCompany;
        private bool _isConnected;
        private DateTime? _lastSyncTime;
        private string _lastError;
        private readonly object _syncLock = new object();

        public event EventHandler<ConnectionStatusChangedEventArgs> ConnectionStatusChanged;
        public event EventHandler<SyncStatusChangedEventArgs> SyncStatusChanged;
        public event EventHandler<SyncCompletedEventArgs> SyncCompleted;

        public ConnectorService(IConnectorLogger logger = null)
        {
            _logger = logger ?? new FileLogger();
            _tallyClient = new TallyClient();
            _cloudApiClient = new CloudApiClient();
            
            // Auto-sync timer (every 30 minutes by default)
            _autoSyncTimer = new Timer(async _ => await PerformAutoSyncAsync(), null, Timeout.Infinite, Timeout.Infinite);
        }

        #region Connection Management

        /// <summary>
        /// Auto-detect Tally server and connect
        /// </summary>
        public async Task<ConnectionResult> AutoConnectAsync()
        {
            try
            {
                UpdateStatus("Detecting Tally server...", false, null);
                
                // Try to auto-detect Tally URL
                var detectedUrl = await TallyClient.AutoDetectTallyUrlAsync();
                
                if (string.IsNullOrEmpty(detectedUrl))
                {
                    return new ConnectionResult
                    {
                        Success = false,
                        Message = "Could not auto-detect Tally server. Please check if Tally is running and Tally API is enabled.",
                        RequiresManualConfiguration = true
                    };
                }

                return await ConnectAsync(detectedUrl);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Auto-connect failed: {ex.Message}", ex);
                return new ConnectionResult
                {
                    Success = false,
                    Message = $"Auto-connect failed: {ex.Message}",
                    Error = ex
                };
            }
        }

        /// <summary>
        /// Connect to Tally with specific URL
        /// </summary>
        public async Task<ConnectionResult> ConnectAsync(string tallyUrl)
        {
            try
            {
                UpdateStatus("Connecting to Tally...", false, null);
                
                // Test connection to Tally
                _tallyClient.Dispose();
                _tallyClient = new TallyClient(tallyUrl);
                
                var isConnected = await _tallyClient.TestConnectionAsync();
                
                if (!isConnected)
                {
                    return new ConnectionResult
                    {
                        Success = false,
                        Message = $"Cannot connect to Tally at {tallyUrl}. Please ensure Tally is running and the API is enabled.",
                        RequiresManualConfiguration = true
                    };
                }

                // Get list of companies
                var companies = await _tallyClient.GetCompaniesAsync();
                
                if (companies == null || companies.Count == 0)
                {
                    return new ConnectionResult
                    {
                        Success = false,
                        Message = "Connected to Tally but no companies found. Please ensure companies are loaded in Tally.",
                        Companies = new List<string>()
                    };
                }

                _isConnected = true;
                UpdateStatus("Connected to Tally", true, null);
                
                return new ConnectionResult
                {
                    Success = true,
                    Message = "Successfully connected to Tally",
                    Companies = companies.ConvertAll(c => c.Name),
                    TallyUrl = tallyUrl
                };
            }
            catch (Exception ex)
            {
                _logger.LogError($"Connection failed: {ex.Message}", ex);
                return new ConnectionResult
                {
                    Success = false,
                    Message = $"Connection failed: {ex.Message}",
                    Error = ex
                };
            }
        }

        /// <summary>
        /// Disconnect from Tally
        /// </summary>
        public void Disconnect()
        {
            try
            {
                _isConnected = false;
                _selectedCompany = null;
                _lastSyncTime = null;
                _lastError = null;
                
                StopAutoSync();
                UpdateStatus("Disconnected", false, null);
                
                _logger.LogInfo("Disconnected from Tally");
            }
            catch (Exception ex)
            {
                _logger.LogError($"Disconnect failed: {ex.Message}", ex);
            }
        }

        #endregion

        #region Company Selection

        /// <summary>
        /// Select company for synchronization
        /// </summary>
        public async Task<bool> SelectCompanyAsync(string companyName)
        {
            try
            {
                if (!_isConnected)
                {
                    _lastError = "Not connected to Tally";
                    return false;
                }

                // Verify company exists and is accessible
                var companies = await _tallyClient.GetCompaniesAsync();
                var selectedCompany = companies.Find(c => c.Name.Equals(companyName, StringComparison.OrdinalIgnoreCase));
                
                if (selectedCompany == null)
                {
                    _lastError = $"Company '{companyName}' not found in Tally";
                    return false;
                }

                if (!selectedCompany.IsActive)
                {
                    _lastError = $"Company '{companyName}' is not active in Tally";
                    return false;
                }

                _selectedCompany = companyName;
                _logger.LogInfo($"Selected company: {companyName}");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Company selection failed: {ex.Message}", ex);
                _lastError = ex.Message;
                return false;
            }
        }

        #endregion

        #region Data Synchronization

        /// <summary>
        /// Perform manual sync with selected company
        /// </summary>
        public async Task<SyncResult> SyncDataAsync(DateTime? fromDate = null, DateTime? toDate = null)
        {
            if (string.IsNullOrEmpty(_selectedCompany))
            {
                return new SyncResult
                {
                    Success = false,
                    Message = "No company selected for sync",
                    ErrorMessage = "Please select a company first"
                };
            }

            lock (_syncLock)
            {
                if (IsSyncing)
                {
                    return new SyncResult
                    {
                        Success = false,
                        Message = "Sync already in progress",
                        ErrorMessage = "Please wait for current sync to complete"
                    };
                }
            }

            try
            {
                UpdateSyncStatus("Syncing data...", 0);
                
                // Step 1: Fetch data from Tally
                var tallyData = await FetchDataFromTallyAsync(_selectedCompany, fromDate, toDate);
                
                if (tallyData == null || !tallyData.HasData)
                {
                    return new SyncResult
                    {
                        Success = false,
                        Message = "No data found to sync",
                        TransactionsSynced = 0,
                        VouchersProcessed = 0,
                        LedgersProcessed = 0
                    };
                }

                // Step 2: Validate and prepare data
                UpdateSyncStatus("Preparing data...", 25);
                var preparedData = await PrepareDataForUploadAsync(tallyData);
                
                // Step 3: Upload to cloud
                UpdateSyncStatus("Uploading to cloud...", 50);
                var uploadResult = await UploadDataToCloudAsync(preparedData);
                
                if (!uploadResult.Success)
                {
                    return new SyncResult
                    {
                        Success = false,
                        Message = "Upload failed",
                        ErrorMessage = uploadResult.ErrorMessage
                    };
                }

                // Step 4: Wait for cloud processing (optional)
                UpdateSyncStatus("Processing in cloud...", 75);
                
                // Update last sync time
                _lastSyncTime = DateTime.Now;
                
                UpdateSyncStatus("Sync completed", 100);
                
                return new SyncResult
                {
                    Success = true,
                    Message = "Data synced successfully",
                    TransactionsSynced = tallyData.TransactionCount,
                    VouchersProcessed = tallyData.VoucherCount,
                    LedgersProcessed = tallyData.LedgerCount,
                    SyncedFromDate = fromDate,
                    SyncedToDate = toDate
                };
            }
            catch (Exception ex)
            {
                _logger.LogError($"Sync failed: {ex.Message}", ex);
                _lastError = ex.Message;
                
                UpdateSyncStatus("Sync failed", 0);
                
                return new SyncResult
                {
                    Success = false,
                    Message = "Sync failed",
                    ErrorMessage = ex.Message
                };
            }
        }

        /// <summary>
        /// Fetch data from Tally
        /// </summary>
        private async Task<TallyDataPackage> FetchDataFromTallyAsync(string companyName, DateTime? fromDate, DateTime? toDate)
        {
            try
            {
                UpdateSyncStatus("Fetching vouchers...", 10);
                
                // Fetch vouchers (transactions)
                var vouchers = await _tallyClient.GetVouchersAsync(companyName, fromDate, toDate);
                
                UpdateSyncStatus("Fetching ledgers...", 15);
                
                // Fetch ledgers (accounts)
                var ledgers = await _tallyClient.GetLedgersAsync(companyName);
                
                UpdateSyncStatus("Fetching chart of accounts...", 20);
                
                // Fetch chart of accounts
                var chartOfAccounts = await _tallyClient.GetChartOfAccountsAsync(companyName);
                
                var package = new TallyDataPackage
                {
                    CompanyName = companyName,
                    Vouchers = vouchers ?? new List<TallyVoucher>(),
                    Ledgers = ledgers ?? new List<TallyLedger>(),
                    ChartOfAccounts = chartOfAccounts ?? new TallyChartOfAccounts(),
                    FromDate = fromDate,
                    ToDate = toDate,
                    FetchedAt = DateTime.Now
                };

                _logger.LogInfo($"Fetched data from Tally: {package.VoucherCount} vouchers, {package.LedgerCount} ledgers");
                
                return package;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Failed to fetch data from Tally: {ex.Message}", ex);
                throw;
            }
        }

        /// <summary>
        /// Prepare data for upload to cloud
        /// </summary>
        private async Task<CloudDataPackage> PrepareDataForUploadAsync(TallyDataPackage tallyData)
        {
            // Convert Tally data to cloud format
            var cloudPackage = new CloudDataPackage
            {
                CompanyName = tallyData.CompanyName,
                SourceSystem = "TALLY",
                DataTimestamp = tallyData.FetchedAt,
                
                Transactions = ConvertVouchersToTransactions(tallyData.Vouchers),
                Ledgers = ConvertLedgersToCloudFormat(tallyData.Ledgers),
                ChartOfAccounts = tallyData.ChartOfAccounts,
                
                Metadata = new Dictionary<string, object>
                {
                    ["fromDate"] = tallyData.FromDate,
                    ["toDate"] = tallyData.ToDate,
                    ["voucherCount"] = tallyData.VoucherCount,
                    ["ledgerCount"] = tallyData.LedgerCount,
                    ["syncVersion"] = "1.0"
                }
            };

            // Validate data before upload
            ValidateDataPackage(cloudPackage);
            
            return cloudPackage;
        }

        /// <summary>
        /// Upload data to AI CFO cloud
        /// </summary>
        private async Task<UploadResult> UploadDataToCloudAsync(CloudDataPackage dataPackage)
        {
            try
            {
                var result = await _cloudApiClient.UploadFinancialDataAsync(dataPackage);
                
                if (result.Success)
                {
                    _logger.LogInfo($"Successfully uploaded data to cloud: {result.TransactionId}");
                }
                else
                {
                    _logger.LogError($"Upload to cloud failed: {result.ErrorMessage}");
                }
                
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Upload to cloud failed: {ex.Message}", ex);
                return new UploadResult
                {
                    Success = false,
                    ErrorMessage = ex.Message
                };
            }
        }

        /// <summary>
        /// Convert Tally vouchers to transaction format
        /// </summary>
        private List<CloudTransaction> ConvertVouchersToTransactions(List<TallyVoucher> vouchers)
        {
            var transactions = new List<CloudTransaction>();
            
            foreach (var voucher in vouchers)
            {
                try
                {
                    // Determine transaction type based on voucher type
                    var transactionType = DetermineTransactionType(voucher);
                    
                    var transaction = new CloudTransaction
                    {
                        ExternalId = voucher.Guid,
                        Date = voucher.Date,
                        Type = transactionType,
                        Category = voucher.LedgerName ?? voucher.VoucherType ?? "Unknown",
                        Amount = Math.Abs(voucher.Amount),
                        Description = voucher.Narration ?? $"{voucher.VoucherType} transaction",
                        PartyName = voucher.PartyName,
                        SourceReference = voucher.VoucherNumber
                    };
                    
                    transactions.Add(transaction);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"Failed to convert voucher {voucher.Guid}: {ex.Message}");
                    // Continue with other vouchers
                }
            }
            
            return transactions;
        }

        /// <summary>
        /// Convert Tally ledgers to cloud format
        /// </summary>
        private List<CloudLedger> ConvertLedgersToCloudFormat(List<TallyLedger> ledgers)
        {
            return ledgers.ConvertAll(ledger => new CloudLedger
            {
                ExternalId = ledger.Guid,
                Name = ledger.Name,
                ParentGroup = ledger.Parent,
                GroupName = ledger.GroupName,
                ClosingBalance = ledger.ClosingBalance,
                Balance = ledger.Balance
            });
        }

        /// <summary>
        /// Determine transaction type from voucher
        /// </summary>
        private string DetermineTransactionType(TallyVoucher voucher)
        {
            // Map Tally voucher types to our transaction types
            var voucherType = voucher.VoucherType?.ToUpper() ?? "";
            
            if (voucherType.Contains("SALES") || voucherType.Contains("RECEIPT") || voucher.IsReceipt)
                return "REVENUE";
            
            if (voucherType.Contains("PURCHASE") || voucherType.Contains("PAYMENT"))
                return "EXPENSE";
            
            if (voucher.Amount > 0)
                return "REVENUE"; // Default assumption
            
            return "EXPENSE";
        }

        /// <summary>
        /// Validate data package before upload
        /// </summary>
        private void ValidateDataPackage(CloudDataPackage package)
        {
            if (package.Transactions == null || package.Transactions.Count == 0)
            {
                _logger.LogWarning("No transactions in data package");
            }
            
            if (package.Ledgers == null || package.Ledgers.Count == 0)
            {
                _logger.LogWarning("No ledgers in data package");
            }
            
            // Check for negative amounts (data quality issue)
            var negativeTransactions = package.Transactions.FindAll(t => t.Amount < 0);
            if (negativeTransactions.Count > 0)
            {
                _logger.LogWarning($"{negativeTransactions.Count} transactions have negative amounts");
            }
        }

        #endregion

        #region Auto Sync

        /// <summary>
        /// Start automatic synchronization
        /// </summary>
        public void StartAutoSync(int intervalMinutes = 30)
        {
            if (!_isConnected || string.IsNullOrEmpty(_selectedCompany))
            {
                _logger.LogWarning("Cannot start auto-sync: not connected or no company selected");
                return;
            }

            StopAutoSync();
            
            var intervalMs = intervalMinutes * 60 * 1000;
            _autoSyncTimer.Change(intervalMs, intervalMs);
            
            _logger.LogInfo($"Auto-sync started with {intervalMinutes} minute interval");
        }

        /// <summary>
        /// Stop automatic synchronization
        /// </summary>
        public void StopAutoSync()
        {
            _autoSyncTimer.Change(Timeout.Infinite, Timeout.Infinite);
            _logger.LogInfo("Auto-sync stopped");
        }

        /// <summary>
        /// Perform automatic sync
        /// </summary>
        private async Task PerformAutoSyncAsync(object state)
        {
            try
            {
                _logger.LogInfo("Starting automatic sync");
                
                // Sync last 7 days of data by default for auto-sync
                var toDate = DateTime.Today;
                var fromDate = toDate.AddDays(-7);
                
                var result = await SyncDataAsync(fromDate, toDate);
                
                if (result.Success)
                {
                    _logger.LogInfo($"Automatic sync completed: {result.TransactionsSynced} transactions");
                }
                else
                {
                    _logger.LogError($"Automatic sync failed: {result.ErrorMessage}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Automatic sync error: {ex.Message}", ex);
            }
        }

        #endregion

        #region Status Updates

        private void UpdateStatus(string status, bool isConnected, string error)
        {
            _isConnected = isConnected;
            _lastError = error;
            
            ConnectionStatusChanged?.Invoke(this, new ConnectionStatusChangedEventArgs
            {
                Status = status,
                IsConnected = isConnected,
                Error = error
            });
        }

        private void UpdateSyncStatus(string status, int progressPercent)
        {
            SyncStatusChanged?.Invoke(this, new SyncStatusChangedEventArgs
            {
                Status = status,
                ProgressPercent = progressPercent
            });
        }

        #endregion

        #region Properties

        public bool IsConnected => _isConnected;
        public bool IsSyncing { get; private set; }
        public string SelectedCompany => _selectedCompany;
        public DateTime? LastSyncTime => _lastSyncTime;
        public string LastError => _lastError;

        #endregion

        public void Dispose()
        {
            StopAutoSync();
            _autoSyncTimer?.Dispose();
            _tallyClient?.Dispose();
            _cloudApiClient?.Dispose();
        }
    }

    #region Event Args

    public class ConnectionStatusChangedEventArgs : EventArgs
    {
        public string Status { get; set; }
        public bool IsConnected { get; set; }
        public string Error { get; set; }
    }

    public class SyncStatusChangedEventArgs : EventArgs
    {
        public string Status { get; set; }
        public int ProgressPercent { get; set; }
    }

    public class SyncCompletedEventArgs : EventArgs
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public int TransactionsSynced { get; set; }
    }

    #endregion

    #region Result Classes

    public class ConnectionResult
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public List<string> Companies { get; set; } = new List<string>();
        public string TallyUrl { get; set; }
        public bool RequiresManualConfiguration { get; set; }
        public Exception Error { get; set; }
    }

    public class SyncResult
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public string ErrorMessage { get; set; }
        public int TransactionsSynced { get; set; }
        public int VouchersProcessed { get; set; }
        public int LedgersProcessed { get; set; }
        public DateTime? SyncedFromDate { get; set; }
        public DateTime? SyncedToDate { get; set; }
    }

    public class UploadResult
    {
        public bool Success { get; set; }
        public string TransactionId { get; set; }
        public string ErrorMessage { get; set; }
    }

    #endregion

    #region Data Models

    public class TallyDataPackage
    {
        public string CompanyName { get; set; }
        public List<TallyVoucher> Vouchers { get; set; }
        public List<TallyLedger> Ledgers { get; set; }
        public TallyChartOfAccounts ChartOfAccounts { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public DateTime FetchedAt { get; set; }

        public int TransactionCount => Vouchers?.Count ?? 0;
        public int VoucherCount => Vouchers?.Count ?? 0;
        public int LedgerCount => Ledgers?.Count ?? 0;
        public bool HasData => TransactionCount > 0 || LedgerCount > 0;
    }

    public class CloudDataPackage
    {
        public string CompanyName { get; set; }
        public string SourceSystem { get; set; }
        public DateTime DataTimestamp { get; set; }
        
        public List<CloudTransaction> Transactions { get; set; } = new List<CloudTransaction>();
        public List<CloudLedger> Ledgers { get; set; } = new List<CloudLedger>();
        public TallyChartOfAccounts ChartOfAccounts { get; set; }
        
        public Dictionary<string, object> Metadata { get; set; } = new Dictionary<string, object>();
    }

    public class CloudTransaction
    {
        public string ExternalId { get; set; }
        public DateTime Date { get; set; }
        public string Type { get; set; }
        public string Category { get; set; }
        public decimal Amount { get; set; }
        public string Description { get; set; }
        public string PartyName { get; set; }
        public string SourceReference { get; set; }
    }

    public class CloudLedger
    {
        public string ExternalId { get; set; }
        public string Name { get; set; }
        public string ParentGroup { get; set; }
        public string GroupName { get; set; }
        public decimal ClosingBalance { get; set; }
        public decimal Balance { get; set; }
    }

    #endregion
}