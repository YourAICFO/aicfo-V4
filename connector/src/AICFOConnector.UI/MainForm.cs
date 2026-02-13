using System;
using System.Drawing;
using System.Windows.Forms;
using AICFOConnector.Core;
using System.Threading.Tasks;

namespace AICFOConnector.UI
{
    /// <summary>
    /// Main form for the AICFO Tally Connector
    /// </summary>
    public partial class MainForm : Form
    {
        private readonly IConnectorLogger _logger;
        private readonly ConnectorService _connectorService;
        private readonly NotifyIcon _notifyIcon;
        private readonly ContextMenuStrip _trayMenu;

        private bool _isMinimizedToTray = false;

        public MainForm(IConnectorLogger logger)
        {
            _logger = logger;
            _connectorService = new ConnectorService(logger);

            InitializeComponent();
            InitializeTrayIcon();
            WireUpEvents();
            
            // Set form properties
            this.Text = "AICFO Tally Connector";
            this.Icon = Properties.Resources.AppIcon;
            this.MinimumSize = new Size(400, 300);
            this.StartPosition = FormStartPosition.CenterScreen;

            _logger.LogInfo("Main form initialized");
        }

        #region Initialization

        private void InitializeComponent()
        {
            this.components = new System.ComponentModel.Container();
            this.statusStrip = new StatusStrip();
            this.statusLabel = new ToolStripStatusLabel();
            this.connectionStatusLabel = new ToolStripStatusLabel();
            this.mainPanel = new Panel();
            this.connectionGroupBox = new GroupBox();
            this.autoConnectButton = new Button();
            this.manualConnectButton = new Button();
            this.tallyUrlTextBox = new TextBox();
            this.tallyUrlLabel = new Label();
            this.companyGroupBox = new GroupBox();
            this.companyComboBox = new ComboBox();
            this.refreshCompaniesButton = new Button();
            this.companyLabel = new Label();
            this.syncGroupBox = new GroupBox();
            this.lastSyncLabel = new Label();
            this.syncNowButton = new Button();
            this.autoSyncCheckBox = new CheckBox();
            this.menuStrip = new MenuStrip();
            this.fileToolStripMenuItem = new ToolStripMenuItem();
            this.exitToolStripMenuItem = new ToolStripMenuItem();
            this.helpToolStripMenuItem = new ToolStripMenuItem();
            this.aboutToolStripMenuItem = new ToolStripMenuItem();
            this.logsToolStripMenuItem = new ToolStripMenuItem();
            this.viewLogsToolStripMenuItem = new ToolStripMenuItem();
            this.statusStrip.SuspendLayout();
            this.mainPanel.SuspendLayout();
            this.connectionGroupBox.SuspendLayout();
            this.companyGroupBox.SuspendLayout();
            this.syncGroupBox.SuspendLayout();
            this.menuStrip.SuspendLayout();
            this.SuspendLayout();
            
            // Main Panel
            this.mainPanel.Dock = DockStyle.Fill;
            this.mainPanel.Padding = new Padding(10);
            this.mainPanel.Controls.Add(this.syncGroupBox);
            this.mainPanel.Controls.Add(this.companyGroupBox);
            this.mainPanel.Controls.Add(this.connectionGroupBox);
            
            // Connection Group Box
            this.connectionGroupBox.Text = "Tally Connection";
            this.connectionGroupBox.Dock = DockStyle.Top;
            this.connectionGroupBox.Height = 120;
            this.connectionGroupBox.Controls.Add(this.autoConnectButton);
            this.connectionGroupBox.Controls.Add(this.manualConnectButton);
            this.connectionGroupBox.Controls.Add(this.tallyUrlTextBox);
            this.connectionGroupBox.Controls.Add(this.tallyUrlLabel);
            
            this.tallyUrlLabel.Text = "Tally Server URL:";
            this.tallyUrlLabel.Location = new Point(10, 25);
            this.tallyUrlLabel.AutoSize = true;
            
            this.tallyUrlTextBox.Location = new Point(120, 22);
            this.tallyUrlTextBox.Width = 250;
            this.tallyUrlTextBox.PlaceholderText = "http://localhost:9000";
            
            this.autoConnectButton.Text = "Auto Detect";
            this.autoConnectButton.Location = new Point(120, 55);
            this.autoConnectButton.Width = 100;
            this.autoConnectButton.Click += AutoConnectButton_Click;
            
            this.manualConnectButton.Text = "Connect";
            this.manualConnectButton.Location = new Point(230, 55);
            this.manualConnectButton.Width = 100;
            this.manualConnectButton.Click += ManualConnectButton_Click;
            
            // Company Group Box
            this.companyGroupBox.Text = "Company Selection";
            this.companyGroupBox.Dock = DockStyle.Top;
            this.companyGroupBox.Height = 100;
            this.companyGroupBox.Controls.Add(this.companyComboBox);
            this.companyGroupBox.Controls.Add(this.refreshCompaniesButton);
            this.companyGroupBox.Controls.Add(this.companyLabel);
            
            this.companyLabel.Text = "Company:";
            this.companyLabel.Location = new Point(10, 25);
            this.companyLabel.AutoSize = true;
            
            this.companyComboBox.DropDownStyle = ComboBoxStyle.DropDownList;
            this.companyComboBox.Location = new Point(120, 22);
            this.companyComboBox.Width = 250;
            this.companyComboBox.Enabled = false;
            
            this.refreshCompaniesButton.Text = "Refresh";
            this.refreshCompaniesButton.Location = new Point(120, 55);
            this.refreshCompaniesButton.Width = 80;
            this.refreshCompaniesButton.Enabled = false;
            this.refreshCompaniesButton.Click += RefreshCompaniesButton_Click;
            
            // Sync Group Box
            this.syncGroupBox.Text = "Data Synchronization";
            this.syncGroupBox.Dock = DockStyle.Fill;
            this.syncGroupBox.Controls.Add(this.lastSyncLabel);
            this.syncGroupBox.Controls.Add(this.syncNowButton);
            this.syncGroupBox.Controls.Add(this.autoSyncCheckBox);
            
            this.lastSyncLabel.Text = "Last sync: Never";
            this.lastSyncLabel.Location = new Point(10, 25);
            this.lastSyncLabel.AutoSize = true;
            
            this.syncNowButton.Text = "Sync Now";
            this.syncNowButton.Location = new Point(120, 20);
            this.syncNowButton.Width = 100;
            this.syncNowButton.Enabled = false;
            this.syncNowButton.Click += SyncNowButton_Click;
            
            this.autoSyncCheckBox.Text = "Auto-sync every 30 minutes";
            this.autoSyncCheckBox.Location = new Point(120, 55);
            this.autoSyncCheckBox.AutoSize = true;
            this.autoSyncCheckBox.Enabled = false;
            this.autoSyncCheckBox.CheckedChanged += AutoSyncCheckBox_CheckedChanged;
            
            // Status Strip
            this.statusStrip.Items.AddRange(new ToolStripItem[] {
                this.statusLabel,
                this.connectionStatusLabel
            });
            this.statusStrip.Location = new Point(0, 428);
            this.statusStrip.Size = new Size(784, 22);
            this.statusStrip.SizingGrip = false;
            
            this.statusLabel.Text = "Ready";
            this.statusLabel.Spring = true;
            
            this.connectionStatusLabel.Text = "Disconnected";
            this.connectionStatusLabel.ForeColor = Color.Red;
            
            // Menu Strip
            this.menuStrip.Items.AddRange(new ToolStripItem[] {
                this.fileToolStripMenuItem,
                this.helpToolStripMenuItem,
                this.logsToolStripMenuItem
            });
            this.menuStrip.Location = new Point(0, 0);
            this.menuStrip.Size = new Size(784, 24);
            
            this.fileToolStripMenuItem.DropDownItems.AddRange(new ToolStripItem[] {
                this.exitToolStripMenuItem
            });
            this.fileToolStripMenuItem.Text = "&File";
            
            this.exitToolStripMenuItem.Text = "E&xit";
            this.exitToolStripMenuItem.Click += ExitToolStripMenuItem_Click;
            
            this.helpToolStripMenuItem.DropDownItems.AddRange(new ToolStripItem[] {
                this.aboutToolStripMenuItem
            });
            this.helpToolStripMenuItem.Text = "&Help";
            
            this.aboutToolStripMenuItem.Text = "&About";
            this.aboutToolStripMenuItem.Click += AboutToolStripMenuItem_Click;
            
            this.logsToolStripMenuItem.DropDownItems.AddRange(new ToolStripItem[] {
                this.viewLogsToolStripMenuItem
            });
            this.logsToolStripMenuItem.Text = "&Logs";
            
            this.viewLogsToolStripMenuItem.Text = "&View Logs";
            this.viewLogsToolStripMenuItem.Click += ViewLogsToolStripMenuItem_Click;
            
            // Main Form
            this.AutoScaleDimensions = new SizeF(6F, 13F);
            this.AutoScaleMode = AutoScaleMode.Font;
            this.ClientSize = new Size(784, 450);
            this.Controls.Add(this.mainPanel);
            this.Controls.Add(this.statusStrip);
            this.Controls.Add(this.menuStrip);
            this.MainMenuStrip = this.menuStrip;
            this.MinimumSize = new Size(400, 300);
            this.Name = "MainForm";
            this.Text = "AICFO Tally Connector";
            
            this.statusStrip.ResumeLayout(false);
            this.statusStrip.PerformLayout();
            this.mainPanel.ResumeLayout(false);
            this.connectionGroupBox.ResumeLayout(false);
            this.connectionGroupBox.PerformLayout();
            this.companyGroupBox.ResumeLayout(false);
            this.companyGroupBox.PerformLayout();
            this.syncGroupBox.ResumeLayout(false);
            this.syncGroupBox.PerformLayout();
            this.menuStrip.ResumeLayout(false);
            this.menuStrip.PerformLayout();
            this.ResumeLayout(false);
            this.PerformLayout();
        }

        #endregion

        #region Tray Icon

        private void InitializeTrayIcon()
        {
            _trayMenu = new ContextMenuStrip();
            _trayMenu.Items.Add("Show", null, (s, e) => ShowFromTray());
            _trayMenu.Items.Add("Sync Now", null, async (s, e) => await PerformTraySync());
            _trayMenu.Items.Add(new ToolStripSeparator());
            _trayMenu.Items.Add("Exit", null, (s, e) => ExitApplication());

            _notifyIcon = new NotifyIcon
            {
                Text = "AICFO Tally Connector",
                Icon = Properties.Resources.AppIcon,
                ContextMenuStrip = _trayMenu,
                Visible = true
            };

            _notifyIcon.DoubleClick += (s, e) => ShowFromTray();
        }

        private void ShowFromTray()
        {
            _isMinimizedToTray = false;
            this.Show();
            this.WindowState = FormWindowState.Normal;
            this.ShowInTaskbar = true;
            this.Activate();
        }

        private void HideToTray()
        {
            _isMinimizedToTray = true;
            this.Hide();
            this.ShowInTaskbar = false;
        }

        private async Task PerformTraySync()
        {
            if (_connectorService.IsConnected && !string.IsNullOrEmpty(_connectorService.SelectedCompany))
            {
                var result = await _connectorService.SyncDataAsync();
                
                if (result.Success)
                {
                    _notifyIcon.ShowBalloonTip(3000, "Sync Complete", 
                        $"Successfully synced {result.TransactionsSynced} transactions", ToolTipIcon.Info);
                }
                else
                {
                    _notifyIcon.ShowBalloonTip(3000, "Sync Failed", 
                        result.ErrorMessage, ToolTipIcon.Error);
                }
            }
            else
            {
                _notifyIcon.ShowBalloonTip(3000, "Not Ready", 
                    "Please connect to Tally and select a company first", ToolTipIcon.Warning);
            }
        }

        #endregion

        #region Event Handlers

        private void WireUpEvents()
        {
            _connectorService.ConnectionStatusChanged += ConnectorService_ConnectionStatusChanged;
            _connectorService.SyncStatusChanged += ConnectorService_SyncStatusChanged;
            _connectorService.SyncCompleted += ConnectorService_SyncCompleted;

            this.FormClosing += MainForm_FormClosing;
            this.Resize += MainForm_Resize;
        }

        private async void AutoConnectButton_Click(object sender, EventArgs e)
        {
            try
            {
                UpdateUIState(isConnecting: true);
                
                var result = await _connectorService.AutoConnectAsync();
                
                if (result.Success)
                {
                    UpdateCompanyList(result.Companies);
                    statusLabel.Text = "Auto-detected and connected to Tally";
                    _logger.LogInfo($"Auto-connected to Tally at {result.TallyUrl}");
                }
                else
                {
                    statusLabel.Text = result.Message;
                    MessageBox.Show(result.Message, "Connection Failed", 
                        MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    _logger.LogWarning($"Auto-connect failed: {result.Message}");
                }
            }
            catch (Exception ex)
            {
                statusLabel.Text = $"Error: {ex.Message}";
                MessageBox.Show($"Connection error: {ex.Message}", "Error", 
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                _logger.LogError("Auto-connect error", ex);
            }
            finally
            {
                UpdateUIState(isConnecting: false);
            }
        }

        private async void ManualConnectButton_Click(object sender, EventArgs e)
        {
            try
            {
                var tallyUrl = tallyUrlTextBox.Text.Trim();
                if (string.IsNullOrEmpty(tallyUrl))
                {
                    MessageBox.Show("Please enter the Tally server URL", "Validation Error", 
                        MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }

                UpdateUIState(isConnecting: true);
                
                var result = await _connectorService.ConnectAsync(tallyUrl);
                
                if (result.Success)
                {
                    UpdateCompanyList(result.Companies);
                    statusLabel.Text = "Connected to Tally";
                    _logger.LogInfo($"Connected to Tally at {tallyUrl}");
                }
                else
                {
                    statusLabel.Text = result.Message;
                    MessageBox.Show(result.Message, "Connection Failed", 
                        MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    _logger.LogWarning($"Manual connect failed: {result.Message}");
                }
            }
            catch (Exception ex)
            {
                statusLabel.Text = $"Error: {ex.Message}";
                MessageBox.Show($"Connection error: {ex.Message}", "Error", 
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                _logger.LogError("Manual connect error", ex);
            }
            finally
            {
                UpdateUIState(isConnecting: false);
            }
        }

        private async void RefreshCompaniesButton_Click(object sender, EventArgs e)
        {
            try
            {
                var companies = await _connectorService._tallyClient.GetCompaniesAsync();
                UpdateCompanyList(companies.ConvertAll(c => c.Name));
                _logger.LogInfo("Refreshed company list");
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to refresh companies: {ex.Message}", "Error", 
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                _logger.LogError("Failed to refresh companies", ex);
            }
        }

        private async void SyncNowButton_Click(object sender, EventArgs e)
        {
            if (companyComboBox.SelectedItem == null)
            {
                MessageBox.Show("Please select a company first", "Validation Error", 
                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            try
            {
                syncNowButton.Enabled = false;
                statusLabel.Text = "Syncing data...";
                
                var result = await _connectorService.SyncDataAsync();
                
                if (result.Success)
                {
                    statusLabel.Text = $"Sync completed: {result.TransactionsSynced} transactions";
                    MessageBox.Show($"Sync completed successfully!\n\n{result.TransactionsSynced} transactions synced", 
                        "Sync Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    _logger.LogInfo($"Manual sync completed: {result.TransactionsSynced} transactions");
                }
                else
                {
                    statusLabel.Text = "Sync failed";
                    MessageBox.Show($"Sync failed: {result.ErrorMessage}", "Sync Failed", 
                        MessageBoxButtons.OK, MessageBoxIcon.Error);
                    _logger.LogError($"Manual sync failed: {result.ErrorMessage}");
                }
            }
            catch (Exception ex)
            {
                statusLabel.Text = $"Sync error: {ex.Message}";
                MessageBox.Show($"Sync error: {ex.Message}", "Error", 
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                _logger.LogError("Manual sync error", ex);
            }
            finally
            {
                syncNowButton.Enabled = true;
            }
        }

        private void AutoSyncCheckBox_CheckedChanged(object sender, EventArgs e)
        {
            try
            {
                if (autoSyncCheckBox.Checked)
                {
                    _connectorService.StartAutoSync(30); // 30 minutes
                    _logger.LogInfo("Auto-sync enabled");
                }
                else
                {
                    _connectorService.StopAutoSync();
                    _logger.LogInfo("Auto-sync disabled");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError("Auto-sync error", ex);
                MessageBox.Show($"Auto-sync error: {ex.Message}", "Error", 
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void AboutToolStripMenuItem_Click(object sender, EventArgs e)
        {
            var aboutForm = new AboutForm();
            aboutForm.ShowDialog();
        }

        private void ViewLogsToolStripMenuItem_Click(object sender, EventArgs e)
        {
            try
            {
                var logPath = System.IO.Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "AICFO", "Connector", "logs");
                
                if (System.IO.Directory.Exists(logPath))
                {
                    System.Diagnostics.Process.Start("explorer.exe", logPath);
                }
                else
                {
                    MessageBox.Show("Log directory not found", "Logs", 
                        MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Could not open logs: {ex.Message}", "Error", 
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void ExitToolStripMenuItem_Click(object sender, EventArgs e)
        {
            ExitApplication();
        }

        private void MainForm_FormClosing(object sender, FormClosingEventArgs e)
        {
            if (e.CloseReason == CloseReason.UserClosing && !_isMinimizedToTray)
            {
                e.Cancel = true;
                HideToTray();
                return;
            }

            // Clean shutdown
            _logger.LogInfo("Application closing");
            _connectorService?.Dispose();
            _notifyIcon?.Dispose();
        }

        private void MainForm_Resize(object sender, EventArgs e)
        {
            if (this.WindowState == FormWindowState.Minimized && !_isMinimizedToTray)
            {
                HideToTray();
            }
        }

        private void ConnectorService_ConnectionStatusChanged(object sender, ConnectionStatusChangedEventArgs e)
        {
            if (InvokeRequired)
            {
                Invoke(new Action(() => ConnectorService_ConnectionStatusChanged(sender, e)));
                return;
            }

            connectionStatusLabel.Text = e.Status;
            
            if (e.IsConnected)
            {
                connectionStatusLabel.ForeColor = Color.Green;
                _notifyIcon.Icon = Properties.Resources.ConnectedIcon;
                
                // Enable controls
                companyComboBox.Enabled = true;
                refreshCompaniesButton.Enabled = true;
                autoSyncCheckBox.Enabled = true;
                
                if (!string.IsNullOrEmpty(_connectorService.SelectedCompany))
                {
                    syncNowButton.Enabled = true;
                }
            }
            else
            {
                connectionStatusLabel.ForeColor = Color.Red;
                _notifyIcon.Icon = Properties.Resources.DisconnectedIcon;
                
                // Disable controls
                companyComboBox.Enabled = false;
                refreshCompaniesButton.Enabled = false;
                syncNowButton.Enabled = false;
                autoSyncCheckBox.Enabled = false;
            }

            if (!string.IsNullOrEmpty(e.Error))
            {
                statusLabel.Text = $"Error: {e.Error}";
            }
        }

        private void ConnectorService_SyncStatusChanged(object sender, SyncStatusChangedEventArgs e)
        {
            if (InvokeRequired)
            {
                Invoke(new Action(() => ConnectorService_SyncStatusChanged(sender, e)));
                return;
            }

            statusLabel.Text = e.Status;
            
            // Update tray icon based on sync status
            if (e.Status.Contains("Syncing"))
            {
                _notifyIcon.Icon = Properties.Resources.SyncingIcon;
            }
            else if (_connectorService.IsConnected)
            {
                _notifyIcon.Icon = Properties.Resources.ConnectedIcon;
            }
        }

        private void ConnectorService_SyncCompleted(object sender, SyncCompletedEventArgs e)
        {
            if (InvokeRequired)
            {
                Invoke(new Action(() => ConnectorService_SyncCompleted(sender, e)));
                return;
            }

            if (e.Success)
            {
                lastSyncLabel.Text = $"Last sync: {DateTime.Now:yyyy-MM-dd HH:mm}";
                _lastSyncTime = DateTime.Now;
                
                _notifyIcon.ShowBalloonTip(3000, "Sync Complete", 
                    e.Message, ToolTipIcon.Info);
            }
            else
            {
                _notifyIcon.ShowBalloonTip(5000, "Sync Failed", 
                    e.Message, ToolTipIcon.Error);
            }
        }

        #endregion

        #region UI Helpers

        private void UpdateCompanyList(List<string> companies)
        {
            companyComboBox.Items.Clear();
            
            if (companies != null && companies.Count > 0)
            {
                companyComboBox.Items.AddRange(companies.ToArray());
                companyComboBox.SelectedIndex = 0;
            }
        }

        private void UpdateUIState(bool isConnecting = false)
        {
            autoConnectButton.Enabled = !isConnecting;
            manualConnectButton.Enabled = !isConnecting;
            tallyUrlTextBox.Enabled = !isConnecting;
            refreshCompaniesButton.Enabled = !isConnecting && _connectorService.IsConnected;
            
            if (!isConnecting)
            {
                companyComboBox.Enabled = _connectorService.IsConnected;
                syncNowButton.Enabled = _connectorService.IsConnected && !string.IsNullOrEmpty(_connectorService.SelectedCompany);
                autoSyncCheckBox.Enabled = _connectorService.IsConnected;
            }
        }

        #endregion

        private void ExitApplication()
        {
            _logger.LogInfo("User requested application exit");
            Application.Exit();
        }
    }
}