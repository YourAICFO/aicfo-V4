namespace AICFO.Connector.Shared.Services;

public static class ConnectorPaths
{
    public const string ProgramDataRoot = @"C:\ProgramData\AICFO";
    public const string ConfigDirectory = @"C:\ProgramData\AICFO\config";
    public const string LogsDirectory = @"C:\ProgramData\AICFO\logs";
    public const string ConfigFile = @"C:\ProgramData\AICFO\config\config.json";
    public const string DeviceIdFile = @"C:\ProgramData\AICFO\config\device_id.txt";
    public const string CredentialPrefix = "AICFO_CONNECTOR_TOKEN_";
    public const string SyncNowPipeName = "AICFOConnectorSyncNow";
}
