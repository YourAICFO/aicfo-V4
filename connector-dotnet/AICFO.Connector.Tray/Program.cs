using System.Diagnostics;
using System.ServiceProcess;
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
        Directory.CreateDirectory(ConnectorPaths.LogsDirectory);
        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Information()
            .WriteTo.File(Path.Combine(ConnectorPaths.LogsDirectory, "tray.log"), rollingInterval: RollingInterval.Day, retainedFileCountLimit: 14, shared: true)
            .CreateLogger();

        ApplicationConfiguration.Initialize();
        Application.Run(new TrayApplicationContext(
            new ConfigStore(),
            new CredentialStore(),
            new SyncNowTriggerClient(),
            new AicfoApiClient(new HttpClient(), NullLogger<AicfoApiClient>.Instance),
            new TallyXmlClient(new HttpClient(), NullLogger<TallyXmlClient>.Instance)));
    }
}

internal sealed class TrayApplicationContext : ApplicationContext
{
    private readonly NotifyIcon _notifyIcon;
    private readonly ConnectorControlPanel _controlPanel;

    public TrayApplicationContext(
        IConfigStore configStore,
        ICredentialStore credentialStore,
        ISyncNowTriggerClient syncNowTriggerClient,
        IAicfoApiClient apiClient,
        ITallyXmlClient tallyClient)
    {
        _controlPanel = new ConnectorControlPanel(configStore, credentialStore, syncNowTriggerClient, apiClient, tallyClient);

        _notifyIcon = new NotifyIcon
        {
            Text = "AI CFO Connector",
            Visible = true,
            Icon = SystemIcons.Application,
            ContextMenuStrip = BuildMenu()
        };

        _notifyIcon.DoubleClick += (_, _) => OpenControlPanel();

        var config = configStore.Load();
        if (config is null || config.Mappings.Count == 0)
        {
            OpenControlPanel();
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
        _controlPanel.Show();
        _controlPanel.WindowState = FormWindowState.Normal;
        _controlPanel.BringToFront();
        _controlPanel.Activate();
    }

    private async Task SyncAllAsync()
    {
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
        _controlPanel.Close();
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

    private readonly TabControl _tabs = new() { Dock = DockStyle.Fill };

    private readonly TextBox _apiUrl = new() { Width = 360 };
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
    private readonly ComboBox _tallyCompanyCombo = new() { Width = 360, DropDownStyle = ComboBoxStyle.DropDownList };
    private readonly TextBox _loginEmail = new() { Width = 360 };
    private readonly TextBox _loginPassword = new() { Width = 360, UseSystemPasswordChar = true };
    private readonly ComboBox _webCompanyCombo = new() { Width = 360, DropDownStyle = ComboBoxStyle.DropDownList, Enabled = false };
    private readonly TextBox _deviceId = new() { Width = 360 };
    private readonly TextBox _deviceName = new() { Width = 360 };
    private readonly TextBox _companyId = new() { Width = 360 };
    private readonly TextBox _connectorToken = new() { Width = 360, UseSystemPasswordChar = true };
    private readonly ListView _mappingsList = new() { Width = 820, Height = 220, View = View.Details, FullRowSelect = true, GridLines = true };

    private ConnectorConfig _config = new();
    private string? _onboardingJwt;

    public ConnectorControlPanel(
        IConfigStore configStore,
        ICredentialStore credentialStore,
        ISyncNowTriggerClient syncNowTriggerClient,
        IAicfoApiClient apiClient,
        ITallyXmlClient tallyClient)
    {
        _configStore = configStore;
        _credentialStore = credentialStore;
        _syncNowTriggerClient = syncNowTriggerClient;
        _apiClient = apiClient;
        _tallyClient = tallyClient;

        Text = "AI CFO Connector Control Panel";
        Width = 980;
        Height = 700;
        StartPosition = FormStartPosition.CenterScreen;

        _mappingsList.Columns.Add("AICFO Company ID", 230);
        _mappingsList.Columns.Add("Tally Company", 200);
        _mappingsList.Columns.Add("Last Sync", 150);
        _mappingsList.Columns.Add("Result", 100);
        _mappingsList.Columns.Add("Last Error", 260);

        _tabs.TabPages.Add(BuildStatusTab());
        _tabs.TabPages.Add(BuildMappingTab());
        Controls.Add(_tabs);

        var stableDeviceId = DeviceIdentityStore.GetOrCreateDeviceId();
        _deviceId.Text = stableDeviceId;
        _deviceName.Text = Environment.MachineName;

        _statusMappingCombo.SelectedIndexChanged += (_, _) => RefreshStatusView();
        _mappingsList.SelectedIndexChanged += (_, _) => SyncSelectionToStatusMapping();

        LoadConfig();
    }

    private TabPage BuildStatusTab()
    {
        var tab = new TabPage("Status");
        var panel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 4,
            RowCount = 10,
            Padding = new Padding(12),
            AutoScroll = true
        };

        panel.Controls.Add(new Label { Text = "Backend API URL", AutoSize = true }, 0, 0);
        panel.Controls.Add(_apiUrl, 1, 0);
        panel.Controls.Add(new Label { Text = "Heartbeat (sec)", AutoSize = true }, 2, 0);
        panel.Controls.Add(_heartbeatSeconds, 3, 0);

        panel.Controls.Add(new Label { Text = "Tally Host", AutoSize = true }, 0, 1);
        panel.Controls.Add(_tallyHost, 1, 1);
        panel.Controls.Add(new Label { Text = "Tally Port", AutoSize = true }, 2, 1);
        panel.Controls.Add(_tallyPort, 3, 1);

        panel.Controls.Add(new Label { Text = "Sync Interval (min)", AutoSize = true }, 0, 2);
        panel.Controls.Add(_syncMinutes, 1, 2);
        var saveSettings = new Button { Text = "Save Settings", Width = 120 };
        saveSettings.Click += (_, _) => SaveGlobalSettings();
        panel.Controls.Add(saveSettings, 3, 2);

        panel.Controls.Add(new Label { Text = "Mapping", AutoSize = true }, 0, 3);
        panel.Controls.Add(_statusMappingCombo, 1, 3);

        panel.Controls.Add(new Label { Text = "Backend", AutoSize = true }, 0, 4);
        panel.Controls.Add(_backendStatus, 1, 4);
        panel.Controls.Add(new Label { Text = "Tally", AutoSize = true }, 2, 4);
        panel.Controls.Add(_tallyStatus, 3, 4);

        panel.Controls.Add(new Label { Text = "Last Heartbeat", AutoSize = true }, 0, 5);
        panel.Controls.Add(_lastHeartbeat, 1, 5);
        panel.Controls.Add(new Label { Text = "Last Sync", AutoSize = true }, 2, 5);
        panel.Controls.Add(_lastSync, 3, 5);

        panel.Controls.Add(new Label { Text = "Last Result", AutoSize = true }, 0, 6);
        panel.Controls.Add(_lastResult, 1, 6);
        panel.Controls.Add(new Label { Text = "Last Error", AutoSize = true }, 2, 6);
        panel.Controls.Add(_lastError, 3, 6);

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
        var openLogs = new Button { Text = "Open Logs", Width = 120 };
        openLogs.Click += (_, _) => OpenLogs();
        buttonBar.Controls.AddRange([testBackend, detectTally, testTally, syncNow, syncAll, openLogs]);
        panel.Controls.Add(buttonBar, 0, 8);
        panel.SetColumnSpan(buttonBar, 4);

        tab.Controls.Add(panel);
        return tab;
    }

    private TabPage BuildMappingTab()
    {
        var tab = new TabPage("Company Mapping");
        var panel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 15,
            Padding = new Padding(12),
            AutoScroll = true
        };

        panel.Controls.Add(new Label { Text = "Login (recommended)", AutoSize = true, Font = new Font(Font, FontStyle.Bold) }, 0, 0);
        panel.Controls.Add(new Label { Text = "Email", AutoSize = true }, 0, 1);
        panel.Controls.Add(_loginEmail, 1, 1);
        panel.Controls.Add(new Label { Text = "Password", AutoSize = true }, 0, 2);
        panel.Controls.Add(_loginPassword, 1, 2);

        var loginButton = new Button { Text = "Login", Width = 120 };
        loginButton.Click += async (_, _) => await LoginRecommendedAsync();
        panel.Controls.Add(loginButton, 1, 3);

        panel.Controls.Add(new Label { Text = "Web Company", AutoSize = true }, 0, 4);
        panel.Controls.Add(_webCompanyCombo, 1, 4);
        panel.Controls.Add(new Label { Text = "Device ID", AutoSize = true }, 0, 5);
        panel.Controls.Add(_deviceId, 1, 5);
        panel.Controls.Add(new Label { Text = "Device Name", AutoSize = true }, 0, 6);
        panel.Controls.Add(_deviceName, 1, 6);

        var registerButton = new Button { Text = "Register & Save Mapping", Width = 190 };
        registerButton.Click += async (_, _) => await RegisterAndSaveMappingAsync();
        panel.Controls.Add(registerButton, 1, 7);

        panel.Controls.Add(new Label { Text = "Manual fallback (legacy token)", AutoSize = true, Font = new Font(Font, FontStyle.Bold) }, 0, 8);

        panel.Controls.Add(new Label { Text = "Tally Companies Found", AutoSize = true }, 0, 9);
        panel.Controls.Add(_tallyCompanyCombo, 1, 9);

        panel.Controls.Add(new Label { Text = "AICFO company_id", AutoSize = true }, 0, 10);
        panel.Controls.Add(_companyId, 1, 10);
        panel.Controls.Add(new Label { Text = "connector_token", AutoSize = true }, 0, 11);
        panel.Controls.Add(_connectorToken, 1, 11);

        var mappingButtons = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoSize = true };
        var detectButton = new Button { Text = "Detect Tally Companies", Width = 170 };
        detectButton.Click += async (_, _) => await DetectTallyAsync();
        var linkButton = new Button { Text = "Link Mapping", Width = 120 };
        linkButton.Click += (_, _) => LinkMapping();
        var removeButton = new Button { Text = "Unlink Mapping", Width = 120 };
        removeButton.Click += (_, _) => RemoveSelectedMapping();
        var reRegisterButton = new Button { Text = "Re-register Token", Width = 140 };
        reRegisterButton.Click += async (_, _) => await ReRegisterSelectedMappingAsync();
        var syncButton = new Button { Text = "Sync Selected", Width = 120 };
        syncButton.Click += async (_, _) => await TriggerSelectedSyncAsync();
        mappingButtons.Controls.AddRange([detectButton, linkButton, removeButton, reRegisterButton, syncButton]);
        panel.Controls.Add(mappingButtons, 0, 12);
        panel.SetColumnSpan(mappingButtons, 2);

        panel.Controls.Add(new Label { Text = "Current Mappings", AutoSize = true }, 0, 13);
        panel.SetColumnSpan(_mappingsList, 2);
        panel.Controls.Add(_mappingsList, 0, 14);

        tab.Controls.Add(panel);
        return tab;
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
            MessageBox.Show("No mapping selected. Triggered sync for all mappings.", "AI CFO Connector");
            return;
        }

        await _syncNowTriggerClient.TriggerMappingAsync(mapping.Id, CancellationToken.None);
        MessageBox.Show($"Triggered sync for company {mapping.CompanyId}.", "AI CFO Connector");
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
                await _apiClient.GetConnectorStatusAsync(_config, token, CancellationToken.None);
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
            MessageBox.Show("Please set Backend API URL first.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
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
            var login = await _apiClient.LoginAsync(apiBaseUrl, email, password, CancellationToken.None);
            if (string.IsNullOrWhiteSpace(login.Token))
            {
                MessageBox.Show("Login failed: token missing.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            _onboardingJwt = login.Token;
            var companies = await _apiClient.GetCompaniesAsync(apiBaseUrl, _onboardingJwt, CancellationToken.None);
            _webCompanyCombo.Items.Clear();
            foreach (var company in companies)
            {
                _webCompanyCombo.Items.Add(new WebCompanyComboItem(company));
            }

            _webCompanyCombo.Enabled = true;
            if (_webCompanyCombo.Items.Count > 0)
            {
                _webCompanyCombo.SelectedIndex = 0;
                MessageBox.Show("Login successful. Select web company and register this device.", "AI CFO Connector");
            }
            else
            {
                MessageBox.Show("No companies found in your account.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }
        catch (Exception ex)
        {
            _onboardingJwt = null;
            _webCompanyCombo.Enabled = false;
            _webCompanyCombo.Items.Clear();
            MessageBox.Show($"Login failed: {ex.Message}", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private async Task RegisterAndSaveMappingAsync()
    {
        SaveGlobalSettings();
        var apiBaseUrl = _config.ApiUrl.Trim();
        if (string.IsNullOrWhiteSpace(apiBaseUrl))
        {
            MessageBox.Show("Please set Backend API URL first.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        if (string.IsNullOrWhiteSpace(_onboardingJwt))
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

        var deviceId = _deviceId.Text.Trim();
        var deviceName = _deviceName.Text.Trim();
        if (string.IsNullOrWhiteSpace(deviceId) || string.IsNullOrWhiteSpace(deviceName))
        {
            MessageBox.Show("Please provide Device ID and Device Name.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        try
        {
            var registration = await _apiClient.RegisterDeviceAsync(
                apiBaseUrl,
                _onboardingJwt,
                companyItem.Company.Id,
                deviceId,
                deviceName,
                CancellationToken.None);

            if (string.IsNullOrWhiteSpace(registration.DeviceToken))
            {
                MessageBox.Show("Device registration failed: token missing.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            var existing = _config.Mappings.FirstOrDefault(m =>
                string.Equals(m.CompanyId, companyItem.Company.Id, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(m.TallyCompanyName, tallyCompany, StringComparison.OrdinalIgnoreCase));

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

            _credentialStore.SaveMappingToken(existing.Id, registration.DeviceToken);
            _configStore.Save(_config);
            LoadConfig();
            MessageBox.Show("Device mapping saved successfully.", "AI CFO Connector");
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Register device failed: {ex.Message}", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private async Task TestTallyAsync()
    {
        SaveGlobalSettings();
        var ok = await _tallyClient.TestConnectionAsync(_config.TallyHost, _config.TallyPort, CancellationToken.None);
        _tallyStatus.Text = ok ? "Reachable" : "Unreachable";
    }

    private async Task DetectTallyAsync()
    {
        SaveGlobalSettings();
        var host = _config.TallyHost;
        var candidates = new[] { _config.TallyPort, 9000, 9001, 9010, 9020 }.Distinct().ToList();

        foreach (var port in candidates)
        {
            try
            {
                var names = await _tallyClient.GetCompanyNamesAsync(host, port, CancellationToken.None);
                if (names.Count > 0)
                {
                    _config.TallyPort = port;
                    _tallyPort.Value = port;
                    _tallyCompanyCombo.Items.Clear();
                    foreach (var name in names) _tallyCompanyCombo.Items.Add(name);
                    if (_tallyCompanyCombo.Items.Count > 0) _tallyCompanyCombo.SelectedIndex = 0;
                    _tallyStatus.Text = $"Reachable ({host}:{port})";
                    _configStore.Save(_config);
                    return;
                }
            }
            catch
            {
                // Try next candidate.
            }
        }

        _tallyStatus.Text = "Detection failed";
        MessageBox.Show("Could not detect Tally. Verify host/port and ensure Tally XML over HTTP is enabled.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }

    private void SaveGlobalSettings()
    {
        _config.ApiUrl = _apiUrl.Text.Trim().TrimEnd('/');
        _config.TallyHost = _tallyHost.Text.Trim();
        _config.TallyPort = (int)_tallyPort.Value;
        _config.HeartbeatIntervalSeconds = (int)_heartbeatSeconds.Value;
        _config.SyncIntervalMinutes = (int)_syncMinutes.Value;
        _config.EnsureCompatibility();
        _configStore.Save(_config);
    }

    private void LinkMapping()
    {
        SaveGlobalSettings();
        var companyId = _companyId.Text.Trim();
        var token = _connectorToken.Text.Trim();
        var tallyCompany = _tallyCompanyCombo.SelectedItem?.ToString() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(companyId) || string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(tallyCompany))
        {
            MessageBox.Show("Please provide Tally company, company_id and connector_token.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        var existing = _config.Mappings.FirstOrDefault(m =>
            string.Equals(m.CompanyId, companyId, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(m.TallyCompanyName, tallyCompany, StringComparison.OrdinalIgnoreCase));

        if (existing is null)
        {
            existing = new ConnectorMapping
            {
                Id = Guid.NewGuid().ToString("N"),
                CompanyId = companyId,
                TallyCompanyName = tallyCompany,
                LastSyncResult = "Never"
            };
            _config.Mappings.Add(existing);
        }

        existing.CompanyId = companyId;
        existing.TallyCompanyName = tallyCompany;
        existing.AuthMethod = "legacy_token";

        _credentialStore.SaveMappingToken(existing.Id, token);
        _configStore.Save(_config);
        LoadConfig();
        MessageBox.Show("Mapping saved.", "AI CFO Connector");
    }

    private void RemoveSelectedMapping()
    {
        if (_mappingsList.SelectedItems.Count == 0) return;
        var mappingId = _mappingsList.SelectedItems[0].Tag?.ToString();
        if (string.IsNullOrWhiteSpace(mappingId)) return;

        var mapping = _config.Mappings.FirstOrDefault(m => string.Equals(m.Id, mappingId, StringComparison.OrdinalIgnoreCase));
        if (mapping is null) return;

        var confirm = MessageBox.Show(
            $"Remove mapping for company {mapping.CompanyId} ↔ {mapping.TallyCompanyName}?",
            "AI CFO Connector",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question);

        if (confirm != DialogResult.Yes) return;

        _config.Mappings.Remove(mapping);
        _credentialStore.DeleteMappingToken(mapping.Id);
        _configStore.Save(_config);
        LoadConfig();
    }

    private async Task ReRegisterSelectedMappingAsync()
    {
        var mapping = GetSelectedMapping();
        if (mapping is null)
        {
            MessageBox.Show("Select a mapping first.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        SaveGlobalSettings();
        var apiBaseUrl = _config.ApiUrl.Trim();
        if (string.IsNullOrWhiteSpace(apiBaseUrl))
        {
            MessageBox.Show("Please set Backend API URL first.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        if (string.IsNullOrWhiteSpace(_onboardingJwt))
        {
            MessageBox.Show("Please login in the recommended section first.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        var deviceId = _deviceId.Text.Trim();
        var deviceName = _deviceName.Text.Trim();
        if (string.IsNullOrWhiteSpace(deviceId) || string.IsNullOrWhiteSpace(deviceName))
        {
            MessageBox.Show("Please provide Device ID and Device Name.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        try
        {
            var registration = await _apiClient.RegisterDeviceAsync(
                apiBaseUrl,
                _onboardingJwt,
                mapping.CompanyId,
                deviceId,
                deviceName,
                CancellationToken.None);

            _credentialStore.SaveMappingToken(mapping.Id, registration.DeviceToken);
            mapping.AuthMethod = "device_token";
            _configStore.Save(_config);
            LoadConfig();
            MessageBox.Show("Device token re-registered successfully.", "AI CFO Connector");
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Re-register failed: {ex.Message}", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void LoadConfig()
    {
        _config = _configStore.Load() ?? new ConnectorConfig();
        _config.EnsureCompatibility();

        _apiUrl.Text = _config.ApiUrl;
        _tallyHost.Text = _config.TallyHost;
        _tallyPort.Value = Math.Clamp(_config.TallyPort, 1, 65535);
        _heartbeatSeconds.Value = Math.Clamp(_config.HeartbeatIntervalSeconds, 10, 300);
        _syncMinutes.Value = Math.Clamp(_config.SyncIntervalMinutes, 1, 240);

        _statusMappingCombo.Items.Clear();
        foreach (var mapping in _config.Mappings)
        {
            _statusMappingCombo.Items.Add(new MappingComboItem(mapping));
        }
        if (_statusMappingCombo.Items.Count > 0) _statusMappingCombo.SelectedIndex = 0;

        _mappingsList.Items.Clear();
        foreach (var mapping in _config.Mappings)
        {
            var authLabel = string.Equals(mapping.AuthMethod, "device_token", StringComparison.OrdinalIgnoreCase)
                ? "(device token)"
                : "(legacy)";
            var tallyDisplay = $"{mapping.TallyCompanyName} {authLabel}";
            if (!string.IsNullOrWhiteSpace(mapping.WebCompanyName))
            {
                tallyDisplay = $"{mapping.WebCompanyName} ↔ {tallyDisplay}";
            }

            var item = new ListViewItem(mapping.CompanyId)
            {
                Tag = mapping.Id
            };
            item.SubItems.Add(tallyDisplay);
            item.SubItems.Add(mapping.LastSyncAt?.ToLocalTime().ToString("g") ?? "Never");
            item.SubItems.Add(mapping.LastSyncResult);
            item.SubItems.Add(string.IsNullOrWhiteSpace(mapping.LastError) ? "-" : mapping.LastError);
            _mappingsList.Items.Add(item);
        }

        RefreshStatusView();
    }

    private void SyncSelectionToStatusMapping()
    {
        if (_mappingsList.SelectedItems.Count == 0) return;
        var mappingId = _mappingsList.SelectedItems[0].Tag?.ToString();
        if (string.IsNullOrWhiteSpace(mappingId)) return;
        for (var i = 0; i < _statusMappingCombo.Items.Count; i++)
        {
            if (_statusMappingCombo.Items[i] is MappingComboItem item && item.Mapping.Id == mappingId)
            {
                _statusMappingCombo.SelectedIndex = i;
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

internal sealed class MappingComboItem(ConnectorMapping mapping)
{
    public ConnectorMapping Mapping { get; } = mapping;
    public override string ToString()
    {
        var auth = string.Equals(mapping.AuthMethod, "device_token", StringComparison.OrdinalIgnoreCase)
            ? "device token"
            : "legacy";
        var web = string.IsNullOrWhiteSpace(mapping.WebCompanyName) ? mapping.CompanyId : mapping.WebCompanyName;
        return $"{web} ↔ {mapping.TallyCompanyName} ({auth})";
    }
}

internal sealed class WebCompanyComboItem(WebCompany company)
{
    public WebCompany Company { get; } = company;
    public override string ToString() => string.IsNullOrWhiteSpace(company.Currency)
        ? company.Name
        : $"{company.Name} ({company.Currency})";
}
