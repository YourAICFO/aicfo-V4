using System.Diagnostics;
using System.Reflection;
using System.ServiceProcess;
using System.Text.Json;
using System.Linq;
using Microsoft.Win32;
using AICFO.Connector.Shared.Models;
using AICFO.Connector.Shared.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Serilog;

namespace AICFO.Connector.Tray;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        WriteBootstrapLog("Tray starting at " + DateTime.UtcNow.ToString("O"));

        try
        {
            var logDir = ConnectorPaths.LogsDirectory;
            try
            {
                Directory.CreateDirectory(logDir);
            }
            catch (Exception ex)
            {
                WriteBootstrapLog("ProgramData logs dir failed: " + ex.Message + "; using user log dir.");
                logDir = ConnectorPaths.UserLogsDirectory;
                Directory.CreateDirectory(logDir);
            }

            Log.Logger = new LoggerConfiguration()
                .MinimumLevel.Information()
                .WriteTo.File(Path.Combine(logDir, "tray.log"), rollingInterval: RollingInterval.Day, retainedFileCountLimit: 14, shared: true)
                .CreateLogger();

            ConfigStore.LogWarning = msg => Log.Warning(msg);

            ApplicationConfiguration.Initialize();
            Application.Run(new TrayApplicationContext(
                new ConfigStore(),
                new CredentialStore(),
                new SyncNowTriggerClient(),
                new AicfoApiClient(new HttpClient(), NullLogger<AicfoApiClient>.Instance),
                new TallyXmlClient(new HttpClient(), NullLogger<TallyXmlClient>.Instance),
                new DiscoveryService()));
        }
        catch (Exception ex)
        {
            WriteBootstrapLog("Fatal: " + ex.ToString());
            throw;
        }
    }

    internal static void WriteBootstrapLog(string message)
    {
        try
        {
            var dir = ConnectorPaths.UserLogsDirectory;
            Directory.CreateDirectory(dir);
            var path = ConnectorPaths.BootstrapLogFile;
            File.AppendAllText(path, DateTime.UtcNow.ToString("O") + " " + message + Environment.NewLine);
        }
        catch
        {
            // Ignore; avoid throwing from bootstrap
        }
    }
}

internal sealed class TrayApplicationContext : ApplicationContext
{
    private readonly NotifyIcon _notifyIcon;
    private readonly ConnectorControlPanel? _controlPanel;

    public TrayApplicationContext(
        IConfigStore configStore,
        ICredentialStore credentialStore,
        ISyncNowTriggerClient syncNowTriggerClient,
        IAicfoApiClient apiClient,
        ITallyXmlClient tallyClient,
        IDiscoveryService discoveryService)
    {
        ConnectorControlPanel? panel = null;
        try
        {
            panel = new ConnectorControlPanel(configStore, credentialStore, syncNowTriggerClient, apiClient, tallyClient, discoveryService);
        }
        catch (Exception ex)
        {
            try { Program.WriteBootstrapLog("UI construction failed: " + ex.ToString()); }
            catch { /* ignore */ }
            try { Log.Error(ex, "ConnectorControlPanel construction failed"); }
            catch { /* ignore */ }
        }
        _controlPanel = panel;

        _notifyIcon = new NotifyIcon
        {
            Text = "AI CFO Connector",
            Visible = true,
            Icon = SystemIcons.Application,
            ContextMenuStrip = BuildMenu()
        };

        _notifyIcon.DoubleClick += (_, _) => OpenControlPanel();

        if (_controlPanel is null)
        {
            _notifyIcon.ShowBalloonTip(5000, "AI CFO Connector", "Started with limited UI. Check logs: %LOCALAPPDATA%\\AICFO\\Logs\\connector.log", ToolTipIcon.Warning);
        }
        else
        {
            var config = configStore.Load();
            if (config is null || config.Mappings.Count == 0)
            {
                OpenControlPanel();
            }
        }
    }

    private ContextMenuStrip BuildMenu()
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("Open Connector Control Panel", null, (_, _) => OpenControlPanel());
        menu.Items.Add("Sync All", null, async (_, _) => await SyncAllAsync());
        menu.Items.Add("Restart Service", null, (_, _) => RestartService());
        menu.Items.Add("Open Logs", null, (_, _) => OpenLogs());
        menu.Items.Add("Exit", null, (_, _) => ExitThread());
        return menu;
    }

    private void OpenControlPanel()
    {
        if (_controlPanel is null)
        {
            _notifyIcon.ShowBalloonTip(5000, "AI CFO Connector", "Control panel unavailable. Check logs: %LOCALAPPDATA%\\AICFO\\Logs\\connector.log", ToolTipIcon.Warning);
            return;
        }
        _controlPanel.Show();
        _controlPanel.WindowState = FormWindowState.Normal;
        _controlPanel.BringToFront();
        _controlPanel.Activate();
    }

    private async Task SyncAllAsync()
    {
        if (_controlPanel is null)
        {
            _notifyIcon.ShowBalloonTip(3000, "AI CFO Connector", "Control panel unavailable. Check logs.", ToolTipIcon.Warning);
            return;
        }
        try
        {
            await _controlPanel.TriggerSyncAllAsync();
            _notifyIcon.ShowBalloonTip(1200, "AI CFO Connector", "Sync all triggered.", ToolTipIcon.Info);
        }
        catch (Exception ex)
        {
            _notifyIcon.ShowBalloonTip(2500, "AI CFO Connector", $"Sync trigger failed: {ex.Message}", ToolTipIcon.Error);
        }
    }

    private static void RestartService()
    {
        try
        {
            using var sc = new ServiceController("AICFO Connector Service");
            if (sc.Status is ServiceControllerStatus.Running or ServiceControllerStatus.StartPending)
            {
                sc.Stop();
                sc.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(20));
            }
            sc.Start();
        }
        catch
        {
            // Non-fatal tray action.
        }
    }

    private static void OpenLogs()
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = ConnectorPaths.LogsDirectory,
            UseShellExecute = true
        });
    }

    protected override void ExitThreadCore()
    {
        _notifyIcon.Visible = false;
        _notifyIcon.Dispose();
        _controlPanel?.Close();
        base.ExitThreadCore();
    }
}

internal sealed class ConnectorControlPanel : Form
{
    private readonly IConfigStore _configStore;
    private readonly ICredentialStore _credentialStore;
    private readonly ISyncNowTriggerClient _syncNowTriggerClient;
    private readonly IAicfoApiClient _apiClient;
    private readonly ITallyXmlClient _tallyClient;
    private readonly IDiscoveryService _discoveryService;

    private readonly TabControl _tabs = new() { Dock = DockStyle.Fill };

    private readonly TextBox _apiUrl = new() { Width = 360 };
    private readonly RadioButton _backendModeAuto = new() { AutoSize = true, Text = "Automatic (recommended)" };
    private readonly RadioButton _backendModePinned = new() { AutoSize = true, Text = "Pinned (advanced)" };
    private readonly Label _autoBackendMessageLabel = new() { AutoSize = true, ForeColor = Color.DimGray, Text = "Using automatic backend configuration" };
    private readonly Label _resolvedApiUrlLabel = new() { AutoSize = true, ForeColor = Color.DimGray, Text = "", Font = SafeSmallLabelFont() };
    private readonly Label _updateAvailableLabel = new() { AutoSize = true, ForeColor = Color.DarkGreen, Text = "" };
    private readonly Label _discoveryFailureBanner = new() { AutoSize = true, ForeColor = Color.DarkOrange, Text = "", MaximumSize = new Size(700, 0), AutoEllipsis = true };
    private readonly Label _statusResolvedApiUrl = new() { AutoSize = true, ForeColor = Color.DimGray, Text = "", Font = SafeSmallLabelFont(), MaximumSize = new Size(500, 0), AutoEllipsis = true };
    private readonly Label _statusDiscoveryUrl = new() { AutoSize = true, ForeColor = Color.DimGray, Text = "", Font = SafeSmallLabelFont(), MaximumSize = new Size(500, 0), AutoEllipsis = true };
    private readonly Label _statusDiscoveryLastSuccess = new() { AutoSize = true, ForeColor = Color.DimGray, Text = "", Font = SafeSmallLabelFont() };
    private Button? _downloadUpdateButton;
    private Button? _checkForUpdatesButton;
    private ConnectorDiscoveryConfig? _lastDiscovery;
    private readonly TextBox _tallyHost = new() { Width = 220, Text = "127.0.0.1" };
    private readonly NumericUpDown _tallyPort = new() { Minimum = 1, Maximum = 65535, Value = 9000, Width = 100 };
    private readonly NumericUpDown _heartbeatSeconds = new() { Minimum = 10, Maximum = 300, Value = 30, Width = 100 };
    private readonly NumericUpDown _syncMinutes = new() { Minimum = 1, Maximum = 240, Value = 15, Width = 100 };
    private readonly ComboBox _statusMappingCombo = new() { Width = 320, DropDownStyle = ComboBoxStyle.DropDownList };
    private readonly Label _backendStatus = new() { AutoSize = true, Text = "Unknown" };
    private readonly Label _tallyStatus = new() { AutoSize = true, Text = "Unknown" };
    private readonly Label _lastHeartbeat = new() { AutoSize = true, Text = "Never" };
    private readonly Label _lastSync = new() { AutoSize = true, Text = "Never" };
    private readonly Label _lastResult = new() { AutoSize = true, Text = "Never" };
    private readonly Label _lastError = new() { AutoSize = true, Text = "None" };
    private readonly CheckBox _startWithWindowsToggle = new() { AutoSize = true, Text = "Start with Windows" };
    private readonly Label _startWithWindowsStatus = new() { AutoSize = true, Text = "Disabled" };
    private readonly Label _statusHint = new() { AutoSize = true, Text = string.Empty, ForeColor = Color.DimGray };
    private readonly DataGridView _statusGrid = new()
    {
        Width = 920,
        Height = 250,
        ReadOnly = true,
        AllowUserToAddRows = false,
        AllowUserToDeleteRows = false,
        AutoGenerateColumns = false,
        SelectionMode = DataGridViewSelectionMode.FullRowSelect,
        MultiSelect = false
    };
    private readonly ComboBox _tallyCompanyCombo = new() { Width = 360, DropDownStyle = ComboBoxStyle.DropDownList };
    private readonly TextBox _loginEmail = new() { Width = 360 };
    private readonly TextBox _loginPassword = new() { Width = 360, UseSystemPasswordChar = true };
    private readonly CheckBox _rememberMe = new() { AutoSize = true, Text = "Remember me" };
    private readonly ComboBox _webCompanyCombo = new() { Width = 360, DropDownStyle = ComboBoxStyle.DropDownList, Enabled = false };
    private readonly TextBox _deviceId = new() { Width = 360 };
    private readonly TextBox _deviceName = new() { Width = 360 };
    private readonly Label _mappingWarning = new()
    {
        AutoSize = true,
        ForeColor = Color.DarkGoldenrod,
        Text = "Be careful: linking wrong company will sync wrong data."
    };
    private readonly Label _webCompaniesEmptyState = new()
    {
        AutoSize = true,
        ForeColor = Color.DimGray,
        Text = "No companies found in your AICFO account.\n1) Open AICFO web portal\n2) Create a company\n3) Return here and click Refresh companies",
        Visible = false
    };
    private readonly Label _tallyCompaniesEmptyState = new()
    {
        AutoSize = true,
        ForeColor = Color.DimGray,
        Text = "No Tally companies detected. Please open Tally and ensure the company is accessible.",
        Visible = false
    };
    private readonly Label _linksEmptyState = new()
    {
        AutoSize = true,
        ForeColor = Color.DimGray,
        Text = "No companies linked yet. Select a Web Company and a Tally Company and click Link.",
        Visible = false
    };
    private readonly Label _actionBanner = new()
    {
        AutoSize = true,
        ForeColor = Color.DimGray,
        Text = string.Empty
    };
    private readonly ListView _mappingsList = new() { Width = 820, Height = 220, View = View.Details, FullRowSelect = true, GridLines = true, ShowItemToolTips = true };
    private readonly Label _linkedSummaryTitle = new() { AutoSize = true, Text = "Select a mapping above", Font = SafeFontForStyle(null, FontStyle.Bold) };

    private static Font SafeFontForStyle(Font? prototype, FontStyle style)
    {
        var baseFont = prototype ?? SystemFonts.MessageBoxFont ?? SystemFonts.DefaultFont ?? Control.DefaultFont;
        if (baseFont is null)
            return new Font(FontFamily.GenericSansSerif, 9f);
        return new Font(baseFont, style);
    }

    private static Font SafeSmallLabelFont()
    {
        var f = SystemFonts.DefaultFont ?? SystemFonts.MessageBoxFont ?? Control.DefaultFont;
        if (f is not null)
            return new Font(f.FontFamily, 8.5f);
        return new Font(FontFamily.GenericSansSerif, 8.5f);
    }
    private readonly Label _linkedWebCompany = new() { AutoSize = true, Text = "-" };
    private readonly Label _linkedShortId = new() { AutoSize = true, Text = "-", ForeColor = Color.DimGray };
    private readonly Label _linkedTallyName = new() { AutoSize = true, Text = "-" };
    private readonly Label _linkedAuthMethod = new() { AutoSize = true, Text = "-" };
    private readonly Label _linkedTallyHostPort = new() { AutoSize = true, Text = "-", ForeColor = Color.DimGray };
    private readonly Label _linkedOnline = new() { AutoSize = true, Text = "-" };
    private readonly Label _linkedLastHeartbeat = new() { AutoSize = true, Text = "-" };
    private readonly Label _linkedLastSyncStatus = new() { AutoSize = true, Text = "-" };
    private readonly Label _linkedReadinessMonth = new() { AutoSize = true, Text = "-" };
    private readonly Label _linkedLastError = new() { AutoSize = true, Text = "-", ForeColor = Color.DarkRed, MaximumSize = new Size(400, 0), AutoEllipsis = true };
    private readonly ListBox _recentActionsList = new() { Width = 400, Height = 120, IntegralHeight = true };
    private const int MaxRecentActions = 20;

    private ConnectorConfig _config = new();
    private string? _deviceAuthToken;
    private readonly List<ConnectorDeviceLink> _deviceLinks = [];
    private readonly System.Windows.Forms.Timer _statusPollTimer = new() { Interval = 15000 };
    private readonly SemaphoreSlim _statusRefreshLock = new(1, 1);
    private bool _statusRefreshRunning;
    private readonly Dictionary<string, string> _statusDiagnosticsByMappingId = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, MappingStatusSnapshot> _statusSnapshotByMappingId = new(StringComparer.OrdinalIgnoreCase);
    private LoginDiagnostics? _lastLoginDiagnostics;
    private bool _suppressAutostartEvent;
    private bool _suppressBackendModeEvent;
    private Button? _linkButton;
    private Button? _syncSelectedButton;

    public ConnectorControlPanel(
        IConfigStore configStore,
        ICredentialStore credentialStore,
        ISyncNowTriggerClient syncNowTriggerClient,
        IAicfoApiClient apiClient,
        ITallyXmlClient tallyClient,
        IDiscoveryService discoveryService)
    {
        _configStore = configStore;
        _credentialStore = credentialStore;
        _syncNowTriggerClient = syncNowTriggerClient;
        _apiClient = apiClient;
        _tallyClient = tallyClient;
        _discoveryService = discoveryService;

        Text = "AI CFO Connector Control Panel";
        Width = 980;
        Height = 700;
        StartPosition = FormStartPosition.CenterScreen;

        _mappingsList.Columns.Add("Web Company Name", 180);
        _mappingsList.Columns.Add("Tally Company Name", 170);
        _mappingsList.Columns.Add("Auth Method", 110);
        _mappingsList.Columns.Add("Status", 110);
        _mappingsList.Columns.Add("Last Sync At", 130);
        _mappingsList.Columns.Add("Last Result", 90);
        _mappingsList.Columns.Add("Last Error", 210);
        _statusGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "WebCompany", HeaderText = "Web Company", Width = 160 });
        _statusGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "TallyCompany", HeaderText = "Tally Company", Width = 130 });
        _statusGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Auth", HeaderText = "Auth", Width = 90 });
        _statusGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Online", HeaderText = "Online", Width = 70 });
        _statusGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "LastSeen", HeaderText = "Last Seen", Width = 130 });
        _statusGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "LastSyncStatus", HeaderText = "Last Sync Status", Width = 120 });
        _statusGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "LastSyncCompleted", HeaderText = "Last Sync Completed", Width = 145 });
        _statusGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Readiness", HeaderText = "Readiness", Width = 110 });
        _statusGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "ReadinessMonth", HeaderText = "Readiness Month", Width = 120 });
        _statusGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "LastError", HeaderText = "Last Error", Width = 200 });

        _tabs.TabPages.Add(BuildStatusTab());
        _tabs.TabPages.Add(BuildMappingTab());
        Controls.Add(_tabs);

        var stableDeviceId = DeviceIdentityStore.GetOrCreateDeviceId();
        _deviceId.Text = stableDeviceId;
        _deviceName.Text = Environment.MachineName;

        _statusMappingCombo.SelectedIndexChanged += (_, _) => RefreshStatusView();
        _mappingsList.SelectedIndexChanged += (_, _) => SyncSelectionToStatusMapping();
        _startWithWindowsToggle.CheckedChanged += (_, _) => HandleStartWithWindowsChanged();
        _statusPollTimer.Tick += async (_, _) => await RefreshStatusGridAsync();
        Shown += async (_, _) =>
        {
            if (!_statusPollTimer.Enabled) _statusPollTimer.Start();
            await RefreshStatusGridAsync();
        };
        FormClosed += (_, _) => _statusPollTimer.Stop();
        VisibleChanged += (_, _) =>
        {
            if (Visible && !_statusPollTimer.Enabled) _statusPollTimer.Start();
            if (!Visible && _statusPollTimer.Enabled) _statusPollTimer.Stop();
            UpdateAutoStartStatusLabel();
        };

        LoadConfig();
        _deviceAuthToken = _credentialStore.LoadDeviceAuthToken();
        if (!string.IsNullOrWhiteSpace(_deviceAuthToken))
        {
            _rememberMe.Checked = true;
            _ = RefreshDeviceLinkDataAsync();
        }
        _ = RunDiscoveryAndApplyAsync(manualUpdateCheck: false);
    }

    private TabPage BuildStatusTab()
    {
        var tab = new TabPage("Status");
        var panel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 4,
            RowCount = 17,
            Padding = new Padding(12),
            AutoScroll = true
        };

        var backendModePanel = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.LeftToRight };
        _backendModeAuto.CheckedChanged += (_, _) => OnBackendModeChanged();
        _backendModePinned.CheckedChanged += (_, _) => OnBackendModeChanged();
        backendModePanel.Controls.Add(_backendModeAuto);
        backendModePanel.Controls.Add(_backendModePinned);
        panel.Controls.Add(new Label { Text = "Backend", AutoSize = true }, 0, 0);
        panel.Controls.Add(backendModePanel, 1, 0);
        panel.Controls.Add(new Label { Text = "Heartbeat (sec)", AutoSize = true }, 2, 0);
        panel.Controls.Add(_heartbeatSeconds, 3, 0);

        var backendUrlPanel = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.TopDown };
        backendUrlPanel.Controls.Add(_autoBackendMessageLabel);
        backendUrlPanel.Controls.Add(_resolvedApiUrlLabel);
        backendUrlPanel.Controls.Add(_apiUrl);
        panel.Controls.Add(new Label { Text = "", AutoSize = true }, 0, 1);
        panel.Controls.Add(backendUrlPanel, 1, 1);
        panel.SetColumnSpan(backendUrlPanel, 3);

        panel.Controls.Add(new Label { Text = "Tally Host", AutoSize = true }, 0, 2);
        panel.Controls.Add(_tallyHost, 1, 2);
        panel.Controls.Add(new Label { Text = "Tally Port", AutoSize = true }, 2, 2);
        panel.Controls.Add(_tallyPort, 3, 2);

        panel.Controls.Add(new Label { Text = "Sync Interval (min)", AutoSize = true }, 0, 3);
        panel.Controls.Add(_syncMinutes, 1, 3);
        var saveSettings = new Button { Text = "Save Settings", Width = 120 };
        saveSettings.Click += (_, _) => SaveGlobalSettings();
        panel.Controls.Add(saveSettings, 3, 3);

        panel.Controls.Add(new Label { Text = "Mapping", AutoSize = true }, 0, 4);
        panel.Controls.Add(_statusMappingCombo, 1, 4);

        panel.Controls.Add(new Label { Text = "Backend", AutoSize = true }, 0, 5);
        var backendStatusRow = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.LeftToRight };
        backendStatusRow.Controls.Add(_backendStatus);
        var copyDiagnosticsBtn = new Button { Text = "Copy Diagnostics", Width = 120 };
        copyDiagnosticsBtn.Click += (_, _) => CopyBackendDiagnostics();
        backendStatusRow.Controls.Add(copyDiagnosticsBtn);
        panel.Controls.Add(backendStatusRow, 1, 5);
        panel.Controls.Add(new Label { Text = "Tally", AutoSize = true }, 2, 5);
        panel.Controls.Add(_tallyStatus, 3, 5);

        panel.Controls.Add(_discoveryFailureBanner, 0, 6);
        panel.SetColumnSpan(_discoveryFailureBanner, 4);

        var statusInfoPanel = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.TopDown };
        statusInfoPanel.Controls.Add(new Label { Text = "Resolved API:", AutoSize = true, Font = SafeFontForStyle(Font, FontStyle.Bold) });
        statusInfoPanel.Controls.Add(_statusResolvedApiUrl);
        statusInfoPanel.Controls.Add(new Label { Text = "Discovery URL:", AutoSize = true, Font = SafeFontForStyle(Font, FontStyle.Bold) });
        statusInfoPanel.Controls.Add(_statusDiscoveryUrl);
        statusInfoPanel.Controls.Add(new Label { Text = "Last discovery success:", AutoSize = true, Font = SafeFontForStyle(Font, FontStyle.Bold) });
        statusInfoPanel.Controls.Add(_statusDiscoveryLastSuccess);
        panel.Controls.Add(statusInfoPanel, 0, 7);
        panel.SetColumnSpan(statusInfoPanel, 4);

        panel.Controls.Add(new Label { Text = "Last Heartbeat", AutoSize = true }, 0, 8);
        panel.Controls.Add(_lastHeartbeat, 1, 8);
        panel.Controls.Add(new Label { Text = "Last Sync", AutoSize = true }, 2, 8);
        panel.Controls.Add(_lastSync, 3, 8);

        panel.Controls.Add(new Label { Text = "Last Result", AutoSize = true }, 0, 9);
        panel.Controls.Add(_lastResult, 1, 9);
        panel.Controls.Add(new Label { Text = "Last Error", AutoSize = true }, 2, 9);
        panel.Controls.Add(_lastError, 3, 9);

        panel.Controls.Add(_startWithWindowsToggle, 0, 10);
        panel.Controls.Add(new Label { Text = "Start at login:", AutoSize = true }, 2, 10);
        panel.Controls.Add(_startWithWindowsStatus, 3, 10);

        var buttonBar = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoSize = true };
        var testBackend = new Button { Text = "Test Backend", Width = 120 };
        testBackend.Click += async (_, _) => await TestBackendAsync();
        var detectTally = new Button { Text = "Detect Tally", Width = 120 };
        detectTally.Click += async (_, _) => await DetectTallyAsync();
        var testTally = new Button { Text = "Test Tally", Width = 120 };
        testTally.Click += async (_, _) => await TestTallyAsync();
        var syncNow = new Button { Text = "Sync Now", Width = 120 };
        syncNow.Click += async (_, _) => await TriggerSelectedSyncAsync();
        var syncAll = new Button { Text = "Sync All", Width = 120 };
        syncAll.Click += async (_, _) => await TriggerSyncAllAsync();
        _checkForUpdatesButton = new Button { Text = "Check for updates", Width = 130 };
        _checkForUpdatesButton.Click += async (_, _) => await RunDiscoveryAndApplyAsync(manualUpdateCheck: true);
        var openLogs = new Button { Text = "Open Logs", Width = 120 };
        openLogs.Click += (_, _) => OpenLogs();
        var refreshStatus = new Button { Text = "Refresh Status", Width = 120 };
        refreshStatus.Click += async (_, _) => await RefreshStatusGridAsync();
        var copyDiagnostics = new Button { Text = "Copy Diagnostics", Width = 130 };
        copyDiagnostics.Click += (_, _) => CopySelectedDiagnostics();
        buttonBar.Controls.AddRange([testBackend, detectTally, testTally, syncNow, syncAll, _checkForUpdatesButton, refreshStatus, copyDiagnostics, openLogs]);
        panel.Controls.Add(buttonBar, 0, 11);
        panel.SetColumnSpan(buttonBar, 4);

        var updateBannerPanel = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.LeftToRight };
        updateBannerPanel.Controls.Add(_updateAvailableLabel);
        _downloadUpdateButton = new Button { Text = "Download update", Width = 120, Visible = false };
        _downloadUpdateButton.Click += (_, _) => OpenDownloadUrl();
        updateBannerPanel.Controls.Add(_downloadUpdateButton);
        panel.Controls.Add(updateBannerPanel, 0, 12);
        panel.SetColumnSpan(updateBannerPanel, 4);

        panel.Controls.Add(new Label { Text = "Connector Status by Mapping", AutoSize = true, Font = SafeFontForStyle(Font, FontStyle.Bold) }, 0, 13);
        panel.SetColumnSpan(_statusGrid, 4);
        panel.Controls.Add(_statusGrid, 0, 14);
        panel.Controls.Add(_statusHint, 0, 15);
        panel.SetColumnSpan(_statusHint, 4);

        tab.Controls.Add(panel);
        return tab;
    }

    private void RefreshBackendModeUi()
    {
        var isAuto = _backendModeAuto.Checked;
        _apiUrl.Visible = !isAuto;
        _autoBackendMessageLabel.Visible = isAuto;
        _resolvedApiUrlLabel.Visible = isAuto;
        _resolvedApiUrlLabel.Text = string.IsNullOrWhiteSpace(_config.ApiUrl) ? "" : _config.ApiUrl;
        if (!isAuto)
            _apiUrl.Text = _config.ApiUrl;
        RefreshDiscoveryStatusLabels();
    }

    private void RefreshDiscoveryStatusLabels()
    {
        _statusResolvedApiUrl.Text = string.IsNullOrWhiteSpace(_config.ApiUrl) ? "(none)" : _config.ApiUrl;
        _statusDiscoveryUrl.Text = string.IsNullOrWhiteSpace(_config.DiscoveryUrl) ? _discoveryService.DefaultDiscoveryUrl : _config.DiscoveryUrl.Trim();
        _statusDiscoveryLastSuccess.Text = _config.ApiUrlLastDiscoveredAt.HasValue
            ? _config.ApiUrlLastDiscoveredAt.Value.ToLocalTime().ToString("g")
            : "Never";
    }

    private void CopyBackendDiagnostics()
    {
        var diagnostics = BuildBackendDiagnostics();
        Clipboard.SetText(JsonSerializer.Serialize(diagnostics, new JsonSerializerOptions { WriteIndented = true }));
        MessageBox.Show("Diagnostics copied to clipboard.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    private Dictionary<string, object?> BuildBackendDiagnostics()
    {
        var d = new Dictionary<string, object?>
        {
            ["apiUrlMode"] = _config.ApiUrlMode,
            ["discoveryUrl"] = string.IsNullOrWhiteSpace(_config.DiscoveryUrl) ? _discoveryService.DefaultDiscoveryUrl : _config.DiscoveryUrl,
            ["resolvedApiUrl"] = _config.ApiUrl,
            ["discoveryLastSuccessAt"] = _config.ApiUrlLastDiscoveredAt?.ToString("O"),
            ["latestConnectorVersion"] = _lastDiscovery?.LatestConnectorVersion ?? _discoveryService.LastSuccess?.LatestConnectorVersion,
            ["minConnectorVersion"] = _lastDiscovery?.MinConnectorVersion ?? _discoveryService.LastSuccess?.MinConnectorVersion
        };
        return d;
    }

    private static void ShowProgramDataError(Exception ex, string path)
    {
        var dir = Path.GetDirectoryName(path) ?? path;
        var message = "Could not write to:\r\n" + path + "\r\n\r\n"
            + (ex?.Message ?? "Unknown error") + "\r\n\r\n"
            + "Ensure the folder exists and you have write permission. "
            + "For ProgramData (e.g. C:\\ProgramData\\AICFO), try running the connector as administrator or check that the folder is not read-only.";
        MessageBox.Show(message, "AI CFO Connector - Configuration Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
    }

    private void SafeSaveConfig()
    {
        try
        {
            _configStore.Save(_config);
        }
        catch (Exception ex)
        {
            ShowProgramDataError(ex, ConnectorPaths.ConfigFile);
        }
    }

    private void OnBackendModeChanged()
    {
        if (_suppressBackendModeEvent) return;
        var isAuto = _backendModeAuto.Checked;
        _config.ApiUrlMode = isAuto ? "auto" : "pinned";
        if (!isAuto)
            _apiUrl.Text = _config.ApiUrl;
        RefreshBackendModeUi();
        SafeSaveConfig();
    }

    private void OpenDownloadUrl()
    {
        var url = _lastDiscovery?.DownloadUrl ?? _discoveryService.LastSuccess?.DownloadUrl;
        if (string.IsNullOrWhiteSpace(url)) return;
        try
        {
            Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Could not open link: {ex.Message}", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }

    private async Task RunDiscoveryAndApplyAsync(bool manualUpdateCheck)
    {
        var discoveryUrl = string.IsNullOrWhiteSpace(_config.DiscoveryUrl) ? _discoveryService.DefaultDiscoveryUrl : _config.DiscoveryUrl.Trim();
        var (config, error) = await _discoveryService.FetchAsync(discoveryUrl, CancellationToken.None).ConfigureAwait(true);

        if (config is not null)
        {
            _lastDiscovery = config;
            Log.Information("Discovery succeeded from {Url}", discoveryUrl);

            if (string.Equals(_config.ApiUrlMode, "auto", StringComparison.OrdinalIgnoreCase))
            {
                var baseUrl = (config.ApiBaseUrl ?? "").Trim().TrimEnd('/');
                if (!string.IsNullOrWhiteSpace(baseUrl) && baseUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                {
                    _config.ApiUrl = baseUrl;
                    _config.ApiUrlLastDiscoveredAt = DateTimeOffset.UtcNow;
                    SafeSaveConfig();
                    if (InvokeRequired)
                        BeginInvoke(() => { _resolvedApiUrlLabel.Text = _config.ApiUrl; _discoveryFailureBanner.Text = ""; _discoveryFailureBanner.Visible = false; RefreshDiscoveryStatusLabels(); });
                    else
                    {
                        _resolvedApiUrlLabel.Text = _config.ApiUrl;
                        _discoveryFailureBanner.Text = "";
                        _discoveryFailureBanner.Visible = false;
                        RefreshDiscoveryStatusLabels();
                    }
                }
            }
        }
        else
        {
            Log.Warning("Discovery failed: {Error}", error ?? "unknown");
            if (string.Equals(_config.ApiUrlMode, "auto", StringComparison.OrdinalIgnoreCase))
            {
                var current = (_config.ApiUrl ?? "").Trim();
                var useFallback = string.IsNullOrWhiteSpace(current) || current.StartsWith("http://localhost", StringComparison.OrdinalIgnoreCase);
                if (useFallback)
                {
                    _config.ApiUrl = DiscoveryService.FallbackApiBaseUrl;
                    SafeSaveConfig();
                }
                var displayUrl = _config.ApiUrl;
                if (InvokeRequired)
                    BeginInvoke(() =>
                    {
                        _resolvedApiUrlLabel.Text = displayUrl;
                        _discoveryFailureBanner.Text = "Automatic backend configuration failed. Using fallback: " + displayUrl;
                        _discoveryFailureBanner.Visible = true;
                        RefreshDiscoveryStatusLabels();
                        if (useFallback)
                            MessageBox.Show("Could not reach the automatic configuration server. Using fallback backend URL. You can switch to \"Pinned\" and set a custom URL if needed.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    });
                else
                {
                    _resolvedApiUrlLabel.Text = displayUrl;
                    _discoveryFailureBanner.Text = "Automatic backend configuration failed. Using fallback: " + displayUrl;
                    _discoveryFailureBanner.Visible = true;
                    RefreshDiscoveryStatusLabels();
                    if (useFallback)
                        MessageBox.Show("Could not reach the automatic configuration server. Using fallback backend URL. You can switch to \"Pinned\" and set a custom URL if needed.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            }
        }

        SetUpdateBanner();
        if (manualUpdateCheck)
        {
            void ShowResult()
            {
                if (_lastDiscovery is null)
                    MessageBox.Show("Could not check for updates. Try again later.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Information);
                else if (_downloadUpdateButton?.Visible != true)
                    MessageBox.Show("You are running the latest version.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            if (InvokeRequired)
                BeginInvoke(ShowResult);
            else
                ShowResult();
        }
    }

    private void SetUpdateBanner()
    {
        var latest = _lastDiscovery?.LatestConnectorVersion ?? _discoveryService.LastSuccess?.LatestConnectorVersion;
        var minVer = _lastDiscovery?.MinConnectorVersion ?? _discoveryService.LastSuccess?.MinConnectorVersion;
        var currentVer = Assembly.GetExecutingAssembly().GetName().Version;
        Version? current = currentVer;
        Version? latestParsed = null;
        Version? minParsed = null;
        if (!string.IsNullOrWhiteSpace(latest) && Version.TryParse(latest, out var l))
            latestParsed = l;
        if (!string.IsNullOrWhiteSpace(minVer) && Version.TryParse(minVer, out var m))
            minParsed = m;

        var tooOld = minParsed is not null && current is not null && current < minParsed;
        var updateAvailable = latestParsed is not null && current is not null && latestParsed > current;

        void Apply()
        {
            if (tooOld)
            {
                _updateAvailableLabel.Text = "Connector is too old. Please update.";
                _updateAvailableLabel.ForeColor = Color.DarkRed;
                _downloadUpdateButton!.Visible = true;
            }
            else if (updateAvailable)
            {
                _updateAvailableLabel.Text = $"Update available: v{latest}";
                _updateAvailableLabel.ForeColor = Color.DarkGreen;
                _downloadUpdateButton!.Visible = true;
            }
            else
            {
                _updateAvailableLabel.Text = "";
                _downloadUpdateButton!.Visible = false;
            }
        }

        if (InvokeRequired)
            BeginInvoke(Apply);
        else
            Apply();
    }

    private TabPage BuildMappingTab()
    {
        var tab = new TabPage("Company Mapping");
        var panel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 24,
            Padding = new Padding(12),
            AutoScroll = true
        };

        panel.Controls.Add(new Label { Text = "Login", AutoSize = true, Font = SafeFontForStyle(Font, FontStyle.Bold) }, 0, 0);
        panel.Controls.Add(new Label { Text = "Email", AutoSize = true }, 0, 1);
        panel.Controls.Add(_loginEmail, 1, 1);
        panel.Controls.Add(new Label { Text = "Password", AutoSize = true }, 0, 2);
        panel.Controls.Add(_loginPassword, 1, 2);
        panel.Controls.Add(_rememberMe, 1, 3);

        var loginButton = new Button { Text = "Login", Width = 120 };
        loginButton.Click += async (_, _) => await LoginRecommendedAsync();
        var copyLoginDiagnosticsButton = new Button { Text = "Copy Login Diagnostics", Width = 170 };
        copyLoginDiagnosticsButton.Click += (_, _) => CopyLoginDiagnostics();
        var loginButtons = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoSize = true };
        loginButtons.Controls.Add(loginButton);
        loginButtons.Controls.Add(copyLoginDiagnosticsButton);
        panel.Controls.Add(loginButtons, 1, 4);

        panel.Controls.Add(new Label { Text = "Web Company", AutoSize = true }, 0, 5);
        panel.Controls.Add(_webCompanyCombo, 1, 5);
        var refreshCompaniesButton = new Button { Text = "Refresh companies", Width = 140 };
        refreshCompaniesButton.Click += async (_, _) => await RefreshDeviceLinkDataAsync();
        panel.Controls.Add(refreshCompaniesButton, 1, 6);
        panel.Controls.Add(_webCompaniesEmptyState, 1, 7);
        panel.Controls.Add(new Label { Text = "Tally Company", AutoSize = true }, 0, 6);
        panel.Controls.Add(_tallyCompanyCombo, 1, 8);
        var rescanTallyButton = new Button { Text = "Rescan Tally companies", Width = 170 };
        rescanTallyButton.Click += async (_, _) => await DetectTallyAsync();
        panel.Controls.Add(rescanTallyButton, 1, 9);
        panel.Controls.Add(_tallyCompaniesEmptyState, 1, 10);
        panel.Controls.Add(new Label { Text = "Device ID", AutoSize = true }, 0, 11);
        panel.Controls.Add(_deviceId, 1, 11);
        panel.Controls.Add(new Label { Text = "Device Name", AutoSize = true }, 0, 12);
        panel.Controls.Add(_deviceName, 1, 12);

        _linkButton = new Button { Text = "LINK", Width = 120 };
        _linkButton.Click += async (_, _) => await RegisterAndSaveMappingAsync();
        panel.Controls.Add(_linkButton, 1, 13);
        panel.Controls.Add(_mappingWarning, 1, 14);

        var mappingButtons = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoSize = true };
        var detectButton = new Button { Text = "Detect Tally Companies", Width = 170 };
        detectButton.Click += async (_, _) => await DetectTallyAsync();
        var removeButton = new Button { Text = "Unlink Mapping", Width = 120 };
        removeButton.Click += (_, _) => RemoveSelectedMapping();
        var reRegisterButton = new Button { Text = "Re-login", Width = 120 };
        reRegisterButton.Click += async (_, _) => await ReRegisterSelectedMappingAsync();
        var refreshLinksButton = new Button { Text = "Refresh links", Width = 120 };
        refreshLinksButton.Click += async (_, _) => await RefreshDeviceLinkDataAsync();
        _syncSelectedButton = new Button { Text = "Sync Selected", Width = 120 };
        _syncSelectedButton.Click += async (_, _) => await TriggerSelectedSyncAsync();
        mappingButtons.Controls.AddRange([detectButton, refreshLinksButton, removeButton, reRegisterButton, _syncSelectedButton]);
        panel.Controls.Add(mappingButtons, 0, 15);
        panel.SetColumnSpan(mappingButtons, 2);
        panel.Controls.Add(_actionBanner, 0, 16);
        panel.SetColumnSpan(_actionBanner, 2);

        panel.Controls.Add(new Label { Text = "Linked Companies", AutoSize = true }, 0, 17);
        panel.SetColumnSpan(_mappingsList, 2);
        panel.Controls.Add(_mappingsList, 0, 18);
        panel.Controls.Add(_linksEmptyState, 0, 19);
        panel.SetColumnSpan(_linksEmptyState, 2);

        var linkedStatusPanel = new TableLayoutPanel
        {
            ColumnCount = 2,
            RowCount = 11,
            AutoSize = true,
            Dock = DockStyle.Top,
            Padding = new Padding(0, 8, 0, 0)
        };
        linkedStatusPanel.Controls.Add(_linkedSummaryTitle, 0, 0);
        linkedStatusPanel.SetColumnSpan(_linkedSummaryTitle, 2);
        linkedStatusPanel.Controls.Add(new Label { Text = "Web Company:", AutoSize = true }, 0, 1);
        linkedStatusPanel.Controls.Add(_linkedWebCompany, 1, 1);
        linkedStatusPanel.Controls.Add(new Label { Text = "Short ID:", AutoSize = true }, 0, 2);
        linkedStatusPanel.Controls.Add(_linkedShortId, 1, 2);
        linkedStatusPanel.Controls.Add(new Label { Text = "Tally Company:", AutoSize = true }, 0, 3);
        linkedStatusPanel.Controls.Add(_linkedTallyName, 1, 3);
        linkedStatusPanel.Controls.Add(new Label { Text = "Auth:", AutoSize = true }, 0, 4);
        linkedStatusPanel.Controls.Add(_linkedAuthMethod, 1, 4);
        linkedStatusPanel.Controls.Add(new Label { Text = "Tally (Host:Port):", AutoSize = true }, 0, 5);
        linkedStatusPanel.Controls.Add(_linkedTallyHostPort, 1, 5);
        linkedStatusPanel.Controls.Add(new Label { Text = "Online:", AutoSize = true }, 0, 6);
        linkedStatusPanel.Controls.Add(_linkedOnline, 1, 6);
        linkedStatusPanel.Controls.Add(new Label { Text = "Last Seen:", AutoSize = true }, 0, 7);
        linkedStatusPanel.Controls.Add(_linkedLastHeartbeat, 1, 7);
        linkedStatusPanel.Controls.Add(new Label { Text = "Last Sync:", AutoSize = true }, 0, 8);
        linkedStatusPanel.Controls.Add(_linkedLastSyncStatus, 1, 8);
        linkedStatusPanel.Controls.Add(new Label { Text = "Readiness:", AutoSize = true }, 0, 9);
        linkedStatusPanel.Controls.Add(_linkedReadinessMonth, 1, 9);
        linkedStatusPanel.Controls.Add(new Label { Text = "Last Error:", AutoSize = true }, 0, 10);
        linkedStatusPanel.Controls.Add(_linkedLastError, 1, 10);
        panel.Controls.Add(linkedStatusPanel, 0, 20);
        panel.SetColumnSpan(linkedStatusPanel, 2);

        panel.Controls.Add(new Label { Text = "Recent actions", AutoSize = true }, 0, 21);
        panel.SetColumnSpan(_recentActionsList, 2);
        panel.Controls.Add(_recentActionsList, 0, 22);

        tab.Controls.Add(panel);
        return tab;
    }

    private void AddRecentAction(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return;
        var line = $"[{DateTime.Now:HH:mm:ss}] {message}";
        if (InvokeRequired)
        {
            BeginInvoke(new Action(() =>
            {
                _recentActionsList.Items.Insert(0, line);
                while (_recentActionsList.Items.Count > MaxRecentActions)
                    _recentActionsList.Items.RemoveAt(_recentActionsList.Items.Count - 1);
            }));
            return;
        }
        _recentActionsList.Items.Insert(0, line);
        while (_recentActionsList.Items.Count > MaxRecentActions)
            _recentActionsList.Items.RemoveAt(_recentActionsList.Items.Count - 1);
    }

    public async Task TriggerSyncAllAsync()
    {
        await _syncNowTriggerClient.TriggerAllAsync(CancellationToken.None);
    }

    private async Task TriggerSelectedSyncAsync()
    {
        var mapping = GetSelectedMapping();
        if (mapping is null)
        {
            await _syncNowTriggerClient.TriggerAllAsync(CancellationToken.None);
            SetActionBanner("No mapping selected. Triggered sync for all mappings.", Color.DarkGoldenrod);
            return;
        }

        var previousSyncAt = mapping.LastSyncAt;
        var webName = string.IsNullOrWhiteSpace(mapping.WebCompanyName) ? "selected company" : mapping.WebCompanyName;

        if (_syncSelectedButton is not null)
        {
            _syncSelectedButton.Enabled = false;
            _syncSelectedButton.Text = "Syncing...";
        }
        SetActionBanner("Syncing...", Color.DimGray);

        try
        {
            await _syncNowTriggerClient.TriggerMappingAsync(mapping.Id, CancellationToken.None);
            var completed = await WaitForSyncCompletionAsync(mapping.Id, previousSyncAt, TimeSpan.FromMinutes(5));
            if (completed is null)
            {
                SetActionBanner($"Sync started for {webName}. Refresh status in a moment.", Color.DarkGreen);
                AddRecentAction("Sync triggered (pending)");
            }
            else if (string.Equals(completed.LastSyncResult, "Failed", StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(completed.LastSyncResult, "failed", StringComparison.OrdinalIgnoreCase))
            {
                SetActionBanner("Sync failed. Please retry.", Color.Firebrick);
                AddRecentAction("Sync failed");
            }
            else
            {
                SetActionBanner($"Sync completed at {FormatDate(completed.LastSyncAt, "now")}.", Color.DarkGreen);
                AddRecentAction($"Sync OK at {FormatDate(completed.LastSyncAt, "now")}");
            }
        }
        catch
        {
            SetActionBanner("Sync failed. Please retry.", Color.Firebrick);
            AddRecentAction("Sync trigger failed");
        }
        finally
        {
            if (_syncSelectedButton is not null)
            {
                _syncSelectedButton.Enabled = true;
                _syncSelectedButton.Text = "Sync Selected";
            }
            await RefreshStatusGridAsync();
        }
    }

    private ConnectorMapping? GetSelectedMapping()
    {
        if (_statusMappingCombo.SelectedItem is MappingComboItem item) return item.Mapping;
        return null;
    }

    private async Task TestBackendAsync()
    {
        SaveGlobalSettings();
        var backendOk = await _apiClient.TestBackendReachableAsync(_config.ApiUrl, CancellationToken.None);
        _backendStatus.Text = backendOk ? "Reachable" : "Unreachable";

        var mapping = GetSelectedMapping();
        if (backendOk && mapping is not null)
        {
            var token = _credentialStore.LoadMappingToken(mapping.Id);
            if (string.IsNullOrWhiteSpace(token))
            {
                _backendStatus.Text = "Reachable (token missing)";
                return;
            }

            try
            {
                await _apiClient.GetConnectorStatusAsync(_config, mapping, token, CancellationToken.None);
                _backendStatus.Text = "Reachable (auth ok)";
            }
            catch (Exception ex)
            {
                _backendStatus.Text = $"Reachable (auth failed: {ex.Message})";
            }
        }
    }

    private async Task LoginRecommendedAsync()
    {
        SaveGlobalSettings();
        var apiBaseUrl = _config.ApiUrl.Trim();
        if (string.IsNullOrWhiteSpace(apiBaseUrl))
        {
            MessageBox.Show("Connector API endpoint is missing in local configuration.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        var email = _loginEmail.Text.Trim();
        var password = _loginPassword.Text;

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            MessageBox.Show("Please enter email and password.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        try
        {
            var login = await _apiClient.DeviceLoginAsync(apiBaseUrl, email, password, _deviceId.Text.Trim(), _deviceName.Text.Trim(), CancellationToken.None);
            _lastLoginDiagnostics = new LoginDiagnostics(
                apiBaseUrl,
                "/api/connector/device/login",
                200,
                "Login successful");
            if (string.IsNullOrWhiteSpace(login.DeviceToken))
            {
                MessageBox.Show("Login failed: token missing.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            _deviceAuthToken = login.DeviceToken;
            if (_rememberMe.Checked)
            {
                _credentialStore.SaveDeviceAuthToken(_deviceAuthToken);
            }
            else
            {
                _credentialStore.DeleteDeviceAuthToken();
            }

            await RefreshDeviceLinkDataAsync();
            SetActionBanner("Login successful. Select a Web Company and a Tally Company, then click Link.", Color.DarkGreen);
            AddRecentAction("Login OK");
            await RefreshStatusGridAsync();
        }
        catch (ApiRequestException ex)
        {
            _deviceAuthToken = null;
            _webCompanyCombo.Enabled = false;
            _webCompanyCombo.Items.Clear();

            var responsePreview = TruncateForUi(LogRedaction.RedactSecrets(ex.ResponseBody), 500);
            _lastLoginDiagnostics = new LoginDiagnostics(
                ex.BaseUrl,
                ex.EndpointPath,
                ex.StatusCode,
                responsePreview);

            MessageBox.Show(
                $"Login failed.\nHTTP {(ex.StatusCode > 0 ? ex.StatusCode : 0)}\nResponse: {responsePreview}\n\nCheck API URL and credentials.",
                "AI CFO Connector",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            SetActionBanner("Login failed. Check API URL and credentials.", Color.Firebrick);
        }
        catch (Exception ex)
        {
            _deviceAuthToken = null;
            _webCompanyCombo.Enabled = false;
            _webCompanyCombo.Items.Clear();
            _lastLoginDiagnostics = new LoginDiagnostics(
                apiBaseUrl,
                "/api/connector/device/login",
                null,
                TruncateForUi(LogRedaction.RedactSecrets(ex.Message), 500));
            MessageBox.Show("Login failed. Check API URL and credentials.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Error);
            SetActionBanner("Login failed. Check API URL and credentials.", Color.Firebrick);
        }
    }

    private async Task RegisterAndSaveMappingAsync()
    {
        SaveGlobalSettings();
        var apiBaseUrl = _config.ApiUrl.Trim();
        if (string.IsNullOrWhiteSpace(apiBaseUrl))
        {
            MessageBox.Show("Connector API endpoint is missing in local configuration.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        if (string.IsNullOrWhiteSpace(_deviceAuthToken))
        {
            MessageBox.Show("Please login first.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        if (_webCompanyCombo.SelectedItem is not WebCompanyComboItem companyItem)
        {
            MessageBox.Show("Please select a web company.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        var tallyCompany = _tallyCompanyCombo.SelectedItem?.ToString() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(tallyCompany))
        {
            MessageBox.Show("Please select a Tally company.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        var existing = _config.Mappings.FirstOrDefault(m =>
            string.Equals(m.CompanyId, companyItem.Company.Id, StringComparison.OrdinalIgnoreCase) &&
            NormalizeCompanyName(m.TallyCompanyName) == NormalizeCompanyName(tallyCompany));

        var conflictMessage = GetMappingConflictMessage(companyItem.Company.Id, tallyCompany, existing?.Id);
        if (!string.IsNullOrWhiteSpace(conflictMessage))
        {
            MessageBox.Show(conflictMessage, "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        var shortId = ShortCompanyId(companyItem.Company.Id);
        var confirm = MessageBox.Show(
            $"You are linking Web Company: {companyItem.Company.Name} ({shortId}) to Tally Company: {tallyCompany}\n\nContinue?",
            "Confirm Company Linking",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question);
        if (confirm != DialogResult.Yes)
        {
            return;
        }

        try
        {
            var link = await _apiClient.CreateDeviceLinkAsync(
                apiBaseUrl,
                _deviceAuthToken,
                companyItem.Company.Id,
                tallyCompany,
                tallyCompany,
                CancellationToken.None);

            if (existing is null)
            {
                existing = new ConnectorMapping
                {
                    Id = Guid.NewGuid().ToString("N"),
                    CompanyId = companyItem.Company.Id,
                    TallyCompanyName = tallyCompany,
                    LastSyncResult = "Never"
                };
                _config.Mappings.Add(existing);
            }

            existing.CompanyId = companyItem.Company.Id;
            existing.WebCompanyName = companyItem.Company.Name;
            existing.TallyCompanyName = tallyCompany;
            existing.AuthMethod = "device_token";
            existing.LinkId = link.Id;

            _credentialStore.SaveMappingToken(existing.Id, _deviceAuthToken);
            SafeSaveConfig();
            await RefreshDeviceLinkDataAsync();
            LoadConfig();
            SetActionBanner($"Linked successfully: {companyItem.Company.Name} ↔ {tallyCompany}", Color.DarkGreen);
            AddRecentAction($"Saved mapping: {companyItem.Company.Name} ↔ {tallyCompany}");
            await RefreshStatusGridAsync();
        }
        catch (Exception ex)
        {
            var friendly = GetFriendlyLinkError(ex.Message);
            MessageBox.Show(friendly, "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Error);
            SetActionBanner(friendly, Color.Firebrick);
            AddRecentAction($"Save mapping failed: {GetFriendlyLinkError(ex.Message)}");
        }
    }

    private void CopyLoginDiagnostics()
    {
        var diagnostics = new Dictionary<string, object?>(BuildBackendDiagnostics());
        if (_lastLoginDiagnostics is not null)
        {
            var responseBodyForCopy = LogRedaction.RedactSecrets(_lastLoginDiagnostics.ResponseBody);
            diagnostics["endpointPath"] = _lastLoginDiagnostics.EndpointPath;
            diagnostics["statusCode"] = _lastLoginDiagnostics.StatusCode;
            diagnostics["responseBody"] = responseBodyForCopy;
        }

        Clipboard.SetText(JsonSerializer.Serialize(diagnostics, new JsonSerializerOptions { WriteIndented = true }));
        MessageBox.Show("Login diagnostics copied.", "AI CFO Connector");
    }

    private async Task RefreshDeviceLinkDataAsync()
    {
        try
        {
            SaveGlobalSettings();
            if (string.IsNullOrWhiteSpace(_deviceAuthToken) || string.IsNullOrWhiteSpace(_config.ApiUrl))
            {
                _webCompanyCombo.Items.Clear();
                _webCompanyCombo.Enabled = false;
                _deviceLinks.Clear();
                _webCompaniesEmptyState.Visible = false;
                _tallyCompaniesEmptyState.Visible = _tallyCompanyCombo.Items.Count == 0;
                _linksEmptyState.Visible = _config.Mappings.Count == 0;
                SetLinkFlowEnabled(false);
                return;
            }

            var selectedWebCompanyId = (_webCompanyCombo.SelectedItem as WebCompanyComboItem)?.Company.Id;
            var companies = await _apiClient.GetCompaniesAsync(_config.ApiUrl, _deviceAuthToken, true, CancellationToken.None);
            var links = await _apiClient.GetDeviceLinksAsync(_config.ApiUrl, _deviceAuthToken, CancellationToken.None);

            _deviceLinks.Clear();
            _deviceLinks.AddRange(links);
            foreach (var link in links)
            {
                var mapping = _config.Mappings.FirstOrDefault(m =>
                    (!string.IsNullOrWhiteSpace(m.LinkId) && string.Equals(m.LinkId, link.Id, StringComparison.OrdinalIgnoreCase)) ||
                    (string.Equals(m.CompanyId, link.CompanyId, StringComparison.OrdinalIgnoreCase) &&
                     NormalizeCompanyName(m.TallyCompanyName) == NormalizeCompanyName(link.TallyCompanyName)));
                if (mapping is null)
                {
                    mapping = new ConnectorMapping
                    {
                        Id = Guid.NewGuid().ToString("N"),
                        LastSyncResult = "Never"
                    };
                    _config.Mappings.Add(mapping);
                }

                mapping.CompanyId = link.CompanyId;
                mapping.WebCompanyName = link.WebCompanyName;
                mapping.TallyCompanyName = link.TallyCompanyName;
                mapping.AuthMethod = "device_token";
                mapping.LinkId = link.Id;
                mapping.LastSyncAt = link.LastSyncAt;
                mapping.LastSyncResult = string.IsNullOrWhiteSpace(link.Status)
                    ? mapping.LastSyncResult
                    : link.Status!.Trim().ToLowerInvariant();
                mapping.LastError = link.LastSyncError;

                if (!string.IsNullOrWhiteSpace(_deviceAuthToken))
                {
                    _credentialStore.SaveMappingToken(mapping.Id, _deviceAuthToken);
                }
            }
            SafeSaveConfig();

            var linkedCompanyIds = new HashSet<string>(
                links.Where(l => !string.IsNullOrWhiteSpace(l.CompanyId)).Select(l => l.CompanyId),
                StringComparer.OrdinalIgnoreCase);
            var linkedTallyNames = new HashSet<string>(
                links.Where(l => !string.IsNullOrWhiteSpace(l.TallyCompanyName)).Select(l => NormalizeCompanyName(l.TallyCompanyName)),
                StringComparer.OrdinalIgnoreCase);

            _webCompanyCombo.Items.Clear();
            foreach (var company in companies.Where(c => !linkedCompanyIds.Contains(c.Id)))
            {
                _webCompanyCombo.Items.Add(new WebCompanyComboItem(company));
            }
            _webCompanyCombo.Enabled = _webCompanyCombo.Items.Count > 0;
            if (_webCompanyCombo.Enabled)
            {
                var selectedIndex = -1;
                if (!string.IsNullOrWhiteSpace(selectedWebCompanyId))
                {
                    for (var i = 0; i < _webCompanyCombo.Items.Count; i++)
                    {
                        if (_webCompanyCombo.Items[i] is WebCompanyComboItem item &&
                            string.Equals(item.Company.Id, selectedWebCompanyId, StringComparison.OrdinalIgnoreCase))
                        {
                            selectedIndex = i;
                            break;
                        }
                    }
                }
                _webCompanyCombo.SelectedIndex = selectedIndex >= 0 ? selectedIndex : 0;
            }
            _webCompaniesEmptyState.Visible = _webCompanyCombo.Items.Count == 0;

            var selectedTally = _tallyCompanyCombo.SelectedItem?.ToString();
            var tallyChoices = _tallyCompanyCombo.Items.Cast<object>()
                .Select(item => item.ToString())
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Where(name => !linkedTallyNames.Contains(NormalizeCompanyName(name!)))
                .ToList();

            _tallyCompanyCombo.Items.Clear();
            foreach (var name in tallyChoices)
            {
                if (!string.IsNullOrEmpty(name))
                    _tallyCompanyCombo.Items.Add(name);
            }
            if (_tallyCompanyCombo.Items.Count > 0)
            {
                var next = tallyChoices.FirstOrDefault(name => string.Equals(name, selectedTally, StringComparison.OrdinalIgnoreCase));
                _tallyCompanyCombo.SelectedItem = next ?? tallyChoices[0];
            }
            _tallyCompaniesEmptyState.Visible = _tallyCompanyCombo.Items.Count == 0;
            _linksEmptyState.Visible = _config.Mappings.Count == 0;
            SetLinkFlowEnabled(_webCompanyCombo.Items.Count > 0 && _tallyCompanyCombo.Items.Count > 0);
            if (_webCompanyCombo.Items.Count == 0)
            {
                SetActionBanner("No companies found. Create one in AICFO web portal, then click Refresh companies.", Color.DarkGoldenrod);
            }
            else if (_tallyCompanyCombo.Items.Count == 0)
            {
                SetActionBanner("No Tally companies detected. Click Rescan Tally companies.", Color.DarkGoldenrod);
            }
            else if (_config.Mappings.Count == 0)
            {
                SetActionBanner("No companies linked yet. Select both companies and click Link.", Color.DimGray);
            }
        }
        catch
        {
            SetActionBanner("Unable to refresh companies right now. Please retry.", Color.Firebrick);
        }
    }

    private void SetLinkFlowEnabled(bool enabled)
    {
        _webCompanyCombo.Enabled = enabled && _webCompanyCombo.Items.Count > 0;
        _tallyCompanyCombo.Enabled = enabled && _tallyCompanyCombo.Items.Count > 0;
        if (_linkButton is not null) _linkButton.Enabled = enabled;
    }

    private void SetActionBanner(string message, Color color)
    {
        _actionBanner.Text = message;
        _actionBanner.ForeColor = color;
    }

    private static string GetFriendlyLinkError(string raw)
    {
        var text = (raw ?? string.Empty).ToLowerInvariant();
        if (text.Contains("already linked") || text.Contains("unique")) return "This company pair is already linked. Unlink old mapping first.";
        if (text.Contains("trial has expired") || text.Contains("subscription")) return "Subscription access required. Please check billing in AICFO web portal.";
        if (text.Contains("access denied") || text.Contains("forbidden")) return "Access denied. Please login with the company owner account.";
        return "Unable to link right now. Please retry.";
    }

    private async Task<ConnectorMapping?> WaitForSyncCompletionAsync(string mappingId, DateTimeOffset? previousSyncAt, TimeSpan timeout)
    {
        var started = DateTime.UtcNow;
        while (DateTime.UtcNow - started < timeout)
        {
            await Task.Delay(TimeSpan.FromSeconds(3));
            var latest = _configStore.Load();
            latest?.EnsureCompatibility();
            var mapping = latest?.Mappings.FirstOrDefault(m => string.Equals(m.Id, mappingId, StringComparison.OrdinalIgnoreCase));
            if (mapping is null) return null;
            if (mapping.LastSyncAt.HasValue && (!previousSyncAt.HasValue || mapping.LastSyncAt.Value > previousSyncAt.Value))
            {
                _config = latest!;
                LoadConfig();
                return mapping;
            }
        }
        return null;
    }

    private async Task TestTallyAsync()
    {
        SaveGlobalSettings();
        var host = string.IsNullOrWhiteSpace(_config.TallyHost) ? "127.0.0.1" : _config.TallyHost.Trim();
        var port = _config.TallyPort;
        var ok = await _tallyClient.TestConnectionAsync(host, port, CancellationToken.None);
        if (!ok)
        {
            _tallyStatus.Text = "Unreachable";
            return;
        }
        try
        {
            var names = await _tallyClient.GetCompanyNamesAsync(host, port, CancellationToken.None);
            _tallyStatus.Text = $"Connected ({names.Count} companies)";
        }
        catch
        {
            _tallyStatus.Text = "Reachable (company list failed)";
        }
    }

    private async Task DetectTallyAsync()
    {
        SaveGlobalSettings();
        var host = string.IsNullOrWhiteSpace(_config.TallyHost) ? "127.0.0.1" : _config.TallyHost.Trim();
        var candidates = new[] { 9000, _config.TallyPort, 9001, 9002 }.Distinct().ToList();

        foreach (var port in candidates)
        {
            try
            {
                var names = await _tallyClient.GetCompanyNamesAsync(host, port, CancellationToken.None);
                if (names.Count > 0)
                {
                    _config.TallyHost = host;
                    _config.TallyPort = port;
                    _tallyHost.Text = host;
                    _tallyPort.Value = Math.Clamp(port, 1, 65535);
                    _tallyCompanyCombo.Items.Clear();
                    foreach (var name in names) _tallyCompanyCombo.Items.Add(name);
                    if (_tallyCompanyCombo.Items.Count > 0) _tallyCompanyCombo.SelectedIndex = 0;
                    _tallyStatus.Text = $"Detected ({host}:{port}, {names.Count} companies)";
                    SafeSaveConfig();
                    await RefreshDeviceLinkDataAsync();
                    _tallyCompaniesEmptyState.Visible = false;
                    return;
                }
            }
            catch
            {
                // Try next candidate.
            }
        }

        _tallyStatus.Text = "Detection failed";
        _tallyCompaniesEmptyState.Visible = true;
        MessageBox.Show("Could not detect Tally. Verify host/port and ensure Tally company is open.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }

    private void SaveGlobalSettings()
    {
        if (string.Equals(_config.ApiUrlMode, "pinned", StringComparison.OrdinalIgnoreCase))
            _config.ApiUrl = _apiUrl.Text.Trim().TrimEnd('/');
        _config.TallyHost = _tallyHost.Text.Trim();
        _config.TallyPort = (int)_tallyPort.Value;
        _config.HeartbeatIntervalSeconds = (int)_heartbeatSeconds.Value;
        _config.SyncIntervalMinutes = (int)_syncMinutes.Value;
        _config.StartWithWindows = _startWithWindowsToggle.Checked;
        _config.EnsureCompatibility();
        SafeSaveConfig();
    }

    private void HandleStartWithWindowsChanged()
    {
        if (_suppressAutostartEvent) return;
        try
        {
            if (_startWithWindowsToggle.Checked)
            {
                AutoStartManager.EnableAutoStart();
            }
            else
            {
                AutoStartManager.DisableAutoStart();
            }

            _config.StartWithWindows = _startWithWindowsToggle.Checked;
            SafeSaveConfig();
            UpdateAutoStartStatusLabel();
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Failed to update startup setting: {ex.Message}", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Error);
            _suppressAutostartEvent = true;
            _startWithWindowsToggle.Checked = AutoStartManager.IsAutoStartEnabled();
            _suppressAutostartEvent = false;
            UpdateAutoStartStatusLabel();
        }
    }

    private void UpdateAutoStartStatusLabel()
    {
        var enabled = AutoStartManager.IsAutoStartEnabled();
        _startWithWindowsStatus.Text = enabled ? "On" : "Off";
    }

    private void LinkMapping()
    {
        MessageBox.Show("Legacy manual linking is disabled in this build.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    private void RemoveSelectedMapping()
    {
        if (_mappingsList.SelectedItems.Count == 0) return;
        var mappingId = _mappingsList.SelectedItems[0].Tag?.ToString();
        if (string.IsNullOrWhiteSpace(mappingId)) return;

        var mapping = _config.Mappings.FirstOrDefault(m => string.Equals(m.Id, mappingId, StringComparison.OrdinalIgnoreCase));
        if (mapping is null) return;

        var confirm = MessageBox.Show(
            $"Remove mapping for {mapping.WebCompanyName ?? "Web Company"} ↔ {mapping.TallyCompanyName}?",
            "AI CFO Connector",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question);

        if (confirm != DialogResult.Yes) return;

        try
        {
            if (!string.IsNullOrWhiteSpace(_deviceAuthToken) && !string.IsNullOrWhiteSpace(mapping.LinkId))
            {
                _apiClient.UnlinkDeviceLinkAsync(_config.ApiUrl, _deviceAuthToken, mapping.LinkId, CancellationToken.None).GetAwaiter().GetResult();
            }
        }
        catch
        {
            // Keep local unlink available even if backend unlink call fails.
        }

        _config.Mappings.Remove(mapping);
        _credentialStore.DeleteMappingToken(mapping.Id);
        SafeSaveConfig();
        AddRecentAction($"Unlinked: {mapping.WebCompanyName ?? "Web"} ↔ {mapping.TallyCompanyName}");
        _ = RefreshDeviceLinkDataAsync();
        LoadConfig();
        _ = RefreshStatusGridAsync();
    }

    private async Task ReRegisterSelectedMappingAsync()
    {
        _deviceAuthToken = null;
        _credentialStore.DeleteDeviceAuthToken();
        _webCompanyCombo.Items.Clear();
        _webCompanyCombo.Enabled = false;
        MessageBox.Show("Session cleared. Login again to refresh links.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Information);
        await RefreshStatusGridAsync();
    }

    private void LoadConfig()
    {
        var loaded = _configStore.Load();
        _config = loaded ?? new ConnectorConfig();
        _config.EnsureCompatibility();
        if (loaded is null)
            SafeSaveConfig();

        _apiUrl.Text = _config.ApiUrl;
        _suppressBackendModeEvent = true;
        _backendModeAuto.Checked = string.Equals(_config.ApiUrlMode, "auto", StringComparison.OrdinalIgnoreCase);
        _backendModePinned.Checked = !_backendModeAuto.Checked;
        _suppressBackendModeEvent = false;
        RefreshBackendModeUi();
        _tallyHost.Text = _config.TallyHost;
        _tallyPort.Value = Math.Clamp(_config.TallyPort, 1, 65535);
        _heartbeatSeconds.Value = Math.Clamp(_config.HeartbeatIntervalSeconds, 10, 300);
        _syncMinutes.Value = Math.Clamp(_config.SyncIntervalMinutes, 1, 240);
        _suppressAutostartEvent = true;
        _startWithWindowsToggle.Checked = _config.StartWithWindows;
        _suppressAutostartEvent = false;
        try
        {
            if (_config.StartWithWindows) AutoStartManager.EnableAutoStart();
            else AutoStartManager.DisableAutoStart();
        }
        catch
        {
            // Non-fatal. UI status still reflects real registry state.
        }
        UpdateAutoStartStatusLabel();

        _statusMappingCombo.Items.Clear();
        foreach (var mapping in _config.Mappings)
        {
            _statusMappingCombo.Items.Add(new MappingComboItem(mapping));
        }
        if (_statusMappingCombo.Items.Count > 0) _statusMappingCombo.SelectedIndex = 0;

        _mappingsList.Items.Clear();
        foreach (var mapping in _config.Mappings)
        {
            var webName = string.IsNullOrWhiteSpace(mapping.WebCompanyName) ? "(Unnamed)" : mapping.WebCompanyName;
            var authMethod = string.Equals(mapping.AuthMethod, "device_token", StringComparison.OrdinalIgnoreCase)
                ? "Device Token"
                : "Legacy";
            var linkStatus = (_deviceLinks.FirstOrDefault(l => string.Equals(l.Id, mapping.LinkId, StringComparison.OrdinalIgnoreCase))?.Status ?? mapping.LastSyncResult ?? "-")
                .Trim()
                .ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(linkStatus)) linkStatus = "-";

            var item = new ListViewItem(webName)
            {
                Tag = mapping.Id
            };
            item.SubItems.Add(mapping.TallyCompanyName);
            item.SubItems.Add(authMethod);
            item.SubItems.Add(linkStatus);
            item.SubItems.Add(mapping.LastSyncAt?.ToLocalTime().ToString("g") ?? "Never");
            item.SubItems.Add(mapping.LastSyncResult);
            item.SubItems.Add(string.IsNullOrWhiteSpace(mapping.LastError) ? "-" : mapping.LastError);
            if (string.Equals(linkStatus, "failed", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(mapping.LastError))
            {
                item.ToolTipText = mapping.LastError;
            }
            _mappingsList.Items.Add(item);
        }

        _linksEmptyState.Visible = _config.Mappings.Count == 0;
        SetLinkFlowEnabled(_webCompanyCombo.Items.Count > 0 && _tallyCompanyCombo.Items.Count > 0);

        RefreshDiscoveryStatusLabels();
        RefreshStatusView();
    }

    private void SyncSelectionToStatusMapping()
    {
        if (_mappingsList.SelectedItems.Count == 0)
        {
            RefreshLinkedStatusPanel("");
            return;
        }
        var mappingId = _mappingsList.SelectedItems[0].Tag?.ToString();
        if (string.IsNullOrWhiteSpace(mappingId)) return;
        for (var i = 0; i < _statusMappingCombo.Items.Count; i++)
        {
            if (_statusMappingCombo.Items[i] is MappingComboItem item && item.Mapping.Id == mappingId)
            {
                _statusMappingCombo.SelectedIndex = i;
                PopulateMappingFields(item.Mapping);
                RefreshLinkedStatusPanel(item.Mapping.Id);
                break;
            }
        }
    }

    private void RefreshStatusView()
    {
        var mapping = GetSelectedMapping();
        if (mapping is null)
        {
            _lastHeartbeat.Text = "Never";
            _lastSync.Text = "Never";
            _lastResult.Text = "Never";
            _lastError.Text = "None";
            return;
        }

        _lastHeartbeat.Text = mapping.LastHeartbeatAt?.ToLocalTime().ToString("g") ?? "Never";
        _lastSync.Text = mapping.LastSyncAt?.ToLocalTime().ToString("g") ?? "Never";
        _lastResult.Text = mapping.LastSyncResult;
        _lastError.Text = string.IsNullOrWhiteSpace(mapping.LastError) ? "None" : mapping.LastError;
        RefreshLinkedStatusPanel(mapping.Id);
    }

    private async Task RefreshStatusGridAsync()
    {
        if (_statusRefreshRunning) return;
        _statusRefreshRunning = true;
        await _statusRefreshLock.WaitAsync();
        try
        {
            SaveGlobalSettings();
            var rows = new List<(string mappingId, string webCompany, string tallyCompany, string auth, string online, string lastSeen, string lastSyncStatus, string lastSyncCompleted, string readiness, string readinessMonth, string lastError, string diagnostics, MappingStatusSnapshot snapshot)>();
            var sessionExpired = false;
            var hasJwt = false;

            foreach (var mapping in _config.Mappings)
            {
                var mappingId = mapping.Id;
                var webCompany = string.IsNullOrWhiteSpace(mapping.WebCompanyName) ? "Web Company" : mapping.WebCompanyName!;
                var tallyCompany = mapping.TallyCompanyName;
                var auth = string.IsNullOrWhiteSpace(mapping.AuthMethod) ? "legacy" : mapping.AuthMethod!;
                var token = _credentialStore.LoadMappingToken(mappingId);

                var online = "Unknown";
                var lastSeen = "-";
                var lastSyncStatus = mapping.LastSyncResult;
                var lastSyncCompleted = mapping.LastSyncAt?.ToLocalTime().ToString("g") ?? "Never";
                var readiness = hasJwt ? "Unknown" : "Login to view";
                var readinessMonth = hasJwt ? "-" : "Login to view";
                var lastError = string.IsNullOrWhiteSpace(mapping.LastError) ? "-" : mapping.LastError!;
                var diagnostics = "{}";

                try
                {
                    if (!string.IsNullOrWhiteSpace(token))
                    {
                        var legacy = await _apiClient.GetConnectorStatusAsync(_config, mapping, token, CancellationToken.None);
                        online = ParseLegacyOnline(legacy) ? "Yes" : "No";
                        lastSeen = ParseLegacyLastSeen(legacy);
                        lastSyncStatus = ParseLegacySyncStatus(legacy, lastSyncStatus);
                        lastError = ParseLegacyError(legacy, lastError);
                        diagnostics = JsonSerializer.Serialize(legacy, new JsonSerializerOptions { WriteIndented = true });
                    }
                    else
                    {
                        online = "Token missing";
                        lastError = "Token missing";
                    }
                }
                catch (UnauthorizedAccessException)
                {
                    sessionExpired = true;
                    online = "Auth required";
                    readiness = "Login to view";
                    lastError = "Session expired";
                }
                catch (Exception ex)
                {
                    lastError = Truncate(ex.Message, 120);
                }

                rows.Add((mappingId, webCompany, tallyCompany, auth, online, lastSeen, lastSyncStatus, lastSyncCompleted, readiness, readinessMonth, Truncate(lastError, 80), diagnostics, new MappingStatusSnapshot
                {
                    Online = online,
                    LastSeen = lastSeen,
                    LastSyncStatus = lastSyncStatus,
                    LastSyncCompletedAt = lastSyncCompleted,
                    ReadinessMonth = readinessMonth,
                    LastError = Truncate(lastError, 200)
                }));
            }

            if (sessionExpired)
            {
                _webCompanyCombo.Enabled = false;
                _webCompanyCombo.Items.Clear();
                _statusHint.Text = "Session expired - login again.";
            }
            else
            {
                _statusHint.Text = $"Last refreshed: {DateTime.Now:g}";
            }

            if (IsDisposed) return;
            if (InvokeRequired)
            {
                BeginInvoke(new Action(() => ApplyStatusRows(rows)));
            }
            else
            {
                ApplyStatusRows(rows);
            }
        }
        finally
        {
            _statusRefreshRunning = false;
            _statusRefreshLock.Release();
        }
    }

    private void ApplyStatusRows(List<(string mappingId, string webCompany, string tallyCompany, string auth, string online, string lastSeen, string lastSyncStatus, string lastSyncCompleted, string readiness, string readinessMonth, string lastError, string diagnostics, MappingStatusSnapshot snapshot)> rows)
    {
        _statusGrid.Rows.Clear();
        _statusDiagnosticsByMappingId.Clear();
        _statusSnapshotByMappingId.Clear();

        foreach (var row in rows)
        {
            var index = _statusGrid.Rows.Add(
                row.webCompany,
                row.tallyCompany,
                row.auth,
                row.online,
                row.lastSeen,
                row.lastSyncStatus,
                row.lastSyncCompleted,
                row.readiness,
                row.readinessMonth,
                row.lastError
            );
            _statusGrid.Rows[index].Tag = row.mappingId;
            _statusDiagnosticsByMappingId[row.mappingId] = row.diagnostics;
            _statusSnapshotByMappingId[row.mappingId] = row.snapshot;
        }

        if (_statusMappingCombo.SelectedItem is MappingComboItem selected)
        {
            RefreshLinkedStatusPanel(selected.Mapping.Id);
        }
    }

    private void CopySelectedDiagnostics()
    {
        if (_statusGrid.SelectedRows.Count == 0)
        {
            MessageBox.Show("Select a mapping row first.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        var mappingId = _statusGrid.SelectedRows[0].Tag?.ToString();
        if (string.IsNullOrWhiteSpace(mappingId) || !_statusDiagnosticsByMappingId.TryGetValue(mappingId, out var diagnostics))
        {
            MessageBox.Show("No diagnostics available for selected mapping.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        Clipboard.SetText(diagnostics);
        MessageBox.Show("Diagnostics copied to clipboard.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    private static string FormatDate(DateTimeOffset? value, string fallback = "-") => value?.ToLocalTime().ToString("g") ?? fallback;

    private static bool ParseLegacyOnline(Dictionary<string, object>? payload)
    {
        if (payload is null) return false;
        if (TryGetNested(payload, "data", "connectorLastSeenAt", out var seenRaw) && DateTimeOffset.TryParse(seenRaw, out var seenAt))
        {
            return DateTimeOffset.UtcNow - seenAt.ToUniversalTime() <= TimeSpan.FromMinutes(2);
        }
        return false;
    }

    private static string ParseLegacyLastSeen(Dictionary<string, object>? payload)
    {
        if (payload is null) return "-";
        if (TryGetNested(payload, "data", "connectorLastSeenAt", out var seenRaw) && DateTimeOffset.TryParse(seenRaw, out var seenAt))
        {
            return seenAt.ToLocalTime().ToString("g");
        }
        return "-";
    }

    private static string ParseLegacySyncStatus(Dictionary<string, object>? payload, string fallback)
    {
        if (payload is null) return fallback;
        if (TryGetNested(payload, "data", "lastStatus", out var status))
        {
            return status;
        }
        return fallback;
    }

    private static string ParseLegacyError(Dictionary<string, object>? payload, string fallback)
    {
        if (payload is null) return fallback;
        if (TryGetNested(payload, "data", "lastError", out var error) && !string.IsNullOrWhiteSpace(error))
        {
            return error;
        }
        return fallback;
    }

    private static bool TryGetNested(Dictionary<string, object> payload, string parentKey, string childKey, out string value)
    {
        value = string.Empty;
        if (!payload.TryGetValue(parentKey, out var parent) || parent is null) return false;

        JsonElement parentElement;
        if (parent is JsonElement jsonElement)
        {
            parentElement = jsonElement;
        }
        else
        {
            try
            {
                parentElement = JsonSerializer.SerializeToElement(parent);
            }
            catch
            {
                return false;
            }
        }

        if (parentElement.ValueKind == JsonValueKind.Object && parentElement.TryGetProperty(childKey, out var child))
        {
            value = child.ValueKind == JsonValueKind.String ? (child.GetString() ?? string.Empty) : child.ToString();
            return true;
        }

        return false;
    }

    private static string Truncate(string value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length <= maxLength) return value;
        return $"{value[..(maxLength - 3)]}...";
    }

    private static string TruncateForUi(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value)) return "(empty response body)";
        if (value.Length <= maxLength) return value;
        return $"{value[..maxLength]}...";
    }

    private string? GetMappingConflictMessage(string companyId, string tallyCompanyName, string? currentMappingId)
    {
        var byCompany = _config.Mappings.FirstOrDefault(m =>
            !string.Equals(m.Id, currentMappingId, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(m.CompanyId, companyId, StringComparison.OrdinalIgnoreCase) &&
            NormalizeCompanyName(m.TallyCompanyName) != NormalizeCompanyName(tallyCompanyName));
        if (byCompany is not null)
        {
            return $"This Web Company is already linked to Tally Company '{byCompany.TallyCompanyName}'. Unlink the old mapping first.";
        }

        var byTally = _config.Mappings.FirstOrDefault(m =>
            !string.Equals(m.Id, currentMappingId, StringComparison.OrdinalIgnoreCase) &&
            NormalizeCompanyName(m.TallyCompanyName) == NormalizeCompanyName(tallyCompanyName) &&
            !string.Equals(m.CompanyId, companyId, StringComparison.OrdinalIgnoreCase));
        if (byTally is not null)
        {
            var webName = string.IsNullOrWhiteSpace(byTally.WebCompanyName) ? "another web company" : byTally.WebCompanyName;
            return $"This Tally Company is already linked to Web Company '{webName}'. Unlink the old mapping first.";
        }

        return null;
    }

    private void PopulateMappingFields(ConnectorMapping mapping)
    {
        if (!string.IsNullOrWhiteSpace(mapping.TallyCompanyName))
        {
            var existingIndex = _tallyCompanyCombo.Items.IndexOf(mapping.TallyCompanyName);
            if (existingIndex < 0)
            {
                _tallyCompanyCombo.Items.Add(mapping.TallyCompanyName);
                existingIndex = _tallyCompanyCombo.Items.Count - 1;
            }
            _tallyCompanyCombo.SelectedIndex = existingIndex;
        }
    }

    private void RefreshLinkedStatusPanel(string mappingId)
    {
        if (string.IsNullOrWhiteSpace(mappingId))
        {
            _linkedSummaryTitle.Text = "Select a mapping above";
            _linkedWebCompany.Text = "-";
            _linkedShortId.Text = "-";
            _linkedTallyName.Text = "-";
            _linkedAuthMethod.Text = "-";
            _linkedTallyHostPort.Text = "-";
            _linkedOnline.Text = "-";
            _linkedLastHeartbeat.Text = "-";
            _linkedLastSyncStatus.Text = "-";
            _linkedReadinessMonth.Text = "-";
            _linkedLastError.Text = "-";
            return;
        }

        var mapping = _config.Mappings.FirstOrDefault(m => string.Equals(m.Id, mappingId, StringComparison.OrdinalIgnoreCase));
        if (mapping is null)
        {
            _linkedSummaryTitle.Text = "Select a mapping above";
            _linkedWebCompany.Text = "-";
            _linkedShortId.Text = "-";
            _linkedTallyName.Text = "-";
            _linkedAuthMethod.Text = "-";
            _linkedTallyHostPort.Text = "-";
            _linkedOnline.Text = "-";
            _linkedLastHeartbeat.Text = "-";
            _linkedLastSyncStatus.Text = "-";
            _linkedReadinessMonth.Text = "-";
            _linkedLastError.Text = "-";
            return;
        }

        _linkedSummaryTitle.Text = "Linked Company Summary";
        _linkedWebCompany.Text = string.IsNullOrWhiteSpace(mapping.WebCompanyName) ? "(Unnamed)" : mapping.WebCompanyName;
        _linkedShortId.Text = ShortCompanyId(mapping.CompanyId);
        _linkedTallyName.Text = mapping.TallyCompanyName;
        _linkedAuthMethod.Text = string.Equals(mapping.AuthMethod, "device_token", StringComparison.OrdinalIgnoreCase) ? "Device Token" : "Legacy";
        _linkedTallyHostPort.Text = $"{_config.TallyHost}:{_config.TallyPort}";

        if (_statusSnapshotByMappingId.TryGetValue(mappingId, out var status))
        {
            _linkedOnline.Text = status.Online;
            _linkedLastHeartbeat.Text = status.LastSeen;
            _linkedLastSyncStatus.Text = string.IsNullOrWhiteSpace(status.LastSyncCompletedAt) || status.LastSyncCompletedAt == "Never"
                ? status.LastSyncStatus
                : $"{status.LastSyncStatus} at {status.LastSyncCompletedAt}";
            _linkedReadinessMonth.Text = status.ReadinessMonth;
            _linkedLastError.Text = string.IsNullOrWhiteSpace(status.LastError) || status.LastError == "-" ? "None" : status.LastError;
        }
        else
        {
            _linkedOnline.Text = "Unknown";
            _linkedLastHeartbeat.Text = "Unknown";
            _linkedLastSyncStatus.Text = mapping.LastSyncResult ?? "-";
            _linkedReadinessMonth.Text = "-";
            _linkedLastError.Text = string.IsNullOrWhiteSpace(mapping.LastError) ? "None" : mapping.LastError;
        }
    }

    private static string ShortCompanyId(string companyId)
    {
        if (string.IsNullOrWhiteSpace(companyId)) return "-";
        if (companyId.Length <= 12) return companyId;
        return $"{companyId[..8]}...{companyId[^4..]}";
    }

    private static string NormalizeCompanyName(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var parts = value.Trim().Split([' ', '\t', '\r', '\n'], StringSplitOptions.RemoveEmptyEntries);
        return string.Join(" ", parts).ToLowerInvariant();
    }

    private static void OpenLogs()
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = ConnectorPaths.LogsDirectory,
            UseShellExecute = true
        });
    }
}

internal static class AutoStartManager
{
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "AICFOConnector";

    private static string CurrentExecutablePath()
    {
        var path = Application.ExecutablePath;
        if (string.IsNullOrWhiteSpace(path))
        {
            throw new InvalidOperationException("Unable to resolve tray executable path.");
        }
        return path;
    }

    public static void EnableAutoStart()
    {
        using var key = Registry.CurrentUser.CreateSubKey(RunKeyPath, writable: true)
            ?? throw new InvalidOperationException("Unable to open Windows startup registry key.");
        key.SetValue(ValueName, $"\"{CurrentExecutablePath()}\"", RegistryValueKind.String);
    }

    public static void DisableAutoStart()
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: true);
        key?.DeleteValue(ValueName, false);
    }

    public static bool IsAutoStartEnabled()
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: false);
        var value = key?.GetValue(ValueName) as string;
        if (string.IsNullOrWhiteSpace(value)) return false;
        return string.Equals(value, $"\"{CurrentExecutablePath()}\"", StringComparison.OrdinalIgnoreCase);
    }
}

internal sealed class MappingComboItem(ConnectorMapping mapping)
{
    public ConnectorMapping Mapping { get; } = mapping;
    public override string ToString()
    {
        var m = Mapping;
        var auth = string.Equals(m.AuthMethod, "device_token", StringComparison.OrdinalIgnoreCase)
            ? "device token"
            : "legacy";
        var web = string.IsNullOrWhiteSpace(m.WebCompanyName) ? "Web Company" : m.WebCompanyName;
        return $"{web} ↔ {m.TallyCompanyName} ({auth})";
    }
}

internal sealed class WebCompanyComboItem(WebCompany company)
{
    public WebCompany Company { get; } = company;
    public override string ToString()
    {
        var c = Company;
        return string.IsNullOrWhiteSpace(c.Currency) ? c.Name : $"{c.Name} ({c.Currency})";
    }
}

internal sealed class MappingStatusSnapshot
{
    public string Online { get; init; } = "Unknown";
    public string LastSeen { get; init; } = "-";
    public string LastSyncStatus { get; init; } = "-";
    public string LastSyncCompletedAt { get; init; } = "-";
    public string ReadinessMonth { get; init; } = "-";
    public string LastError { get; init; } = "-";
}

internal sealed record LoginDiagnostics(string BaseUrl, string EndpointPath, int? StatusCode, string ResponseBody);
