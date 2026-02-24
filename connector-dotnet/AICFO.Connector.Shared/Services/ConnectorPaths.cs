namespace AICFO.Connector.Shared.Services;

public static class ConnectorPaths
{
    public const string ProgramDataRoot = @"C:\ProgramData\AICFO";
    public const string ConfigDirectory = @"C:\ProgramData\AICFO\config";
    public const string LogsDirectory = @"C:\ProgramData\AICFO\logs";
    public const string ConfigFile = @"C:\ProgramData\AICFO\config\config.json";
    public const string DeviceIdFile = @"C:\ProgramData\AICFO\config\device_id.txt";
    public static string DiscoveryCacheFile => Path.Combine(ConfigDirectory, "discovery_cache.json");
    public const string CredentialPrefix = "AICFO_CONNECTOR_TOKEN_";
    public const string SyncNowPipeName = "AICFOConnectorSyncNow";

    /// <summary>User-writable log directory (e.g. %LOCALAPPDATA%\AICFO\Logs). Use for tray startup logging when ProgramData may be inaccessible.</summary>
    public static string UserLogsDirectory
    {
        get
        {
            var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            return Path.Combine(localAppData, "AICFO", "Logs");
        }
    }

    /// <summary>User-writable path for bootstrap/startup log. Ensures we have a log even if ProgramData is not writable.</summary>
    public static string BootstrapLogFile => Path.Combine(UserLogsDirectory, "connector.log");
}
