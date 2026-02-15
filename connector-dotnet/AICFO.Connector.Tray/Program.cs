using System.Diagnostics;
using System.ServiceProcess;
using AICFO.Connector.Shared.Models;
using AICFO.Connector.Shared.Services;
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
        Application.Run(new TrayApplicationContext(new ConfigStore(), new CredentialStore(), new SyncNowTriggerClient()));
    }
}

internal sealed class TrayApplicationContext : ApplicationContext
{
    private readonly IConfigStore _configStore;
    private readonly ICredentialStore _credentialStore;
    private readonly ISyncNowTriggerClient _syncNowTriggerClient;
    private readonly NotifyIcon _notifyIcon;

    public TrayApplicationContext(IConfigStore configStore, ICredentialStore credentialStore, ISyncNowTriggerClient syncNowTriggerClient)
    {
        _configStore = configStore;
        _credentialStore = credentialStore;
        _syncNowTriggerClient = syncNowTriggerClient;

        _notifyIcon = new NotifyIcon
        {
            Text = "AI CFO Connector",
            Visible = true,
            Icon = SystemIcons.Application,
            ContextMenuStrip = BuildMenu()
        };

        _notifyIcon.DoubleClick += (_, _) => OpenConfig();

        var config = _configStore.Load();
        if (config is null || string.IsNullOrWhiteSpace(_credentialStore.LoadConnectorToken(config.CompanyId)))
        {
            OpenConfig();
        }
    }

    private ContextMenuStrip BuildMenu()
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("Configure", null, (_, _) => OpenConfig());
        menu.Items.Add("Sync Now", null, async (_, _) => await SyncNow());
        menu.Items.Add("Restart Service", null, (_, _) => RestartService());
        menu.Items.Add("Open Logs", null, (_, _) => OpenLogs());
        menu.Items.Add("Exit", null, (_, _) => ExitThread());
        return menu;
    }

    private void OpenConfig()
    {
        using var form = new SetupForm(_configStore, _credentialStore);
        form.ShowDialog();
    }

    private async Task SyncNow()
    {
        try
        {
            await _syncNowTriggerClient.TriggerAsync(CancellationToken.None);
            _notifyIcon.ShowBalloonTip(1500, "AI CFO Connector", "Manual sync triggered.", ToolTipIcon.Info);
        }
        catch (Exception ex)
        {
            _notifyIcon.ShowBalloonTip(2000, "AI CFO Connector", $"Sync trigger failed: {ex.Message}", ToolTipIcon.Error);
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
            // Intentionally non-fatal for tray interactions.
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
        base.ExitThreadCore();
    }
}

internal sealed class SetupForm : Form
{
    private readonly IConfigStore _configStore;
    private readonly ICredentialStore _credentialStore;

    private readonly TextBox _apiUrl = new() { Width = 360 };
    private readonly TextBox _companyId = new() { Width = 360 };
    private readonly TextBox _connectorToken = new() { Width = 360, UseSystemPasswordChar = true };
    private readonly NumericUpDown _tallyPort = new() { Minimum = 1, Maximum = 65535, Value = 9000 };
    private readonly NumericUpDown _heartbeatSeconds = new() { Minimum = 10, Maximum = 300, Value = 30 };
    private readonly NumericUpDown _syncMinutes = new() { Minimum = 1, Maximum = 240, Value = 15 };

    public SetupForm(IConfigStore configStore, ICredentialStore credentialStore)
    {
        _configStore = configStore;
        _credentialStore = credentialStore;

        Text = "AI CFO Connector Setup";
        Width = 520;
        Height = 420;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;

        var panel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 8,
            Padding = new Padding(12),
            AutoSize = true
        };

        panel.Controls.Add(new Label { Text = "API URL", AutoSize = true }, 0, 0);
        panel.Controls.Add(_apiUrl, 1, 0);
        panel.Controls.Add(new Label { Text = "Company ID", AutoSize = true }, 0, 1);
        panel.Controls.Add(_companyId, 1, 1);
        panel.Controls.Add(new Label { Text = "Connector Token", AutoSize = true }, 0, 2);
        panel.Controls.Add(_connectorToken, 1, 2);
        panel.Controls.Add(new Label { Text = "Tally Port", AutoSize = true }, 0, 3);
        panel.Controls.Add(_tallyPort, 1, 3);
        panel.Controls.Add(new Label { Text = "Heartbeat Seconds", AutoSize = true }, 0, 4);
        panel.Controls.Add(_heartbeatSeconds, 1, 4);
        panel.Controls.Add(new Label { Text = "Sync Interval Minutes", AutoSize = true }, 0, 5);
        panel.Controls.Add(_syncMinutes, 1, 5);

        var saveButton = new Button { Text = "Save", Width = 120 };
        saveButton.Click += (_, _) => SaveConfig();
        panel.Controls.Add(saveButton, 1, 6);

        Controls.Add(panel);
        LoadExistingConfig();
    }

    private void LoadExistingConfig()
    {
        var config = _configStore.Load();
        if (config is null) return;

        _apiUrl.Text = config.ApiUrl;
        _companyId.Text = config.CompanyId;
        _tallyPort.Value = config.TallyPort;
        _heartbeatSeconds.Value = config.HeartbeatIntervalSeconds;
        _syncMinutes.Value = config.SyncIntervalMinutes;
        _connectorToken.Text = _credentialStore.LoadConnectorToken(config.CompanyId) ?? string.Empty;
    }

    private void SaveConfig()
    {
        var config = new ConnectorConfig
        {
            ApiUrl = _apiUrl.Text.Trim().TrimEnd('/'),
            CompanyId = _companyId.Text.Trim(),
            TallyPort = (int)_tallyPort.Value,
            HeartbeatIntervalSeconds = (int)_heartbeatSeconds.Value,
            SyncIntervalMinutes = (int)_syncMinutes.Value
        };

        config.Validate();

        _configStore.Save(config);
        _credentialStore.SaveConnectorToken(config.CompanyId, _connectorToken.Text.Trim());

        MessageBox.Show("Configuration saved. Restart the service if it is already running.", "AI CFO Connector", MessageBoxButtons.OK, MessageBoxIcon.Information);
        Close();
    }
}
