using System.Text.Json;
using AICFO.Connector.Shared.Models;

namespace AICFO.Connector.Shared.Services;

public interface IConfigStore
{
    ConnectorConfig? Load();
    void Save(ConnectorConfig config);
}

public sealed class ConfigStore : IConfigStore
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = null,
        WriteIndented = true
    };

    /// <summary>Optional callback for corruption warning (e.g. set by Tray to log to Serilog).</summary>
    public static Action<string>? LogWarning { get; set; }

    /// <summary>Load from a specific path. Used by tests and by Load(). Returns default config if file missing or corrupt.</summary>
    public static ConnectorConfig LoadFromPath(string path, Action<string>? onCorrupt = null)
    {
        if (!File.Exists(path))
            return ConnectorConfig.Default();

        string json;
        try
        {
            json = File.ReadAllText(path);
        }
        catch (Exception ex)
        {
            RenameCorrupt(path, onCorrupt, ex.Message);
            return ConnectorConfig.Default();
        }

        if (string.IsNullOrEmpty(json) || json.Contains('\0'))
        {
            RenameCorrupt(path, onCorrupt, "File empty or contains null bytes");
            return ConnectorConfig.Default();
        }

        try
        {
            var config = JsonSerializer.Deserialize<ConnectorConfig>(json, JsonOptions);
            if (config is null)
            {
                RenameCorrupt(path, onCorrupt, "Deserialize returned null");
                return ConnectorConfig.Default();
            }
            config.EnsureCompatibility();
            return config;
        }
        catch (JsonException ex)
        {
            RenameCorrupt(path, onCorrupt, ex.Message);
            return ConnectorConfig.Default();
        }
    }

    private static void RenameCorrupt(string path, Action<string>? onCorrupt, string reason)
    {
        try
        {
            var corruptPath = path + ".corrupt-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss") + ".json";
            File.Move(path, corruptPath);
            var message = $"Config file corrupt or invalid; renamed to {Path.GetFileName(corruptPath)}. Reason: {reason}";
            onCorrupt?.Invoke(message);
            LogWarning?.Invoke(message);
        }
        catch
        {
            try
            {
                File.Delete(path);
            }
            catch { /* ignore */ }
            var fallbackMsg = "Config file corrupt; removed. Using defaults.";
            onCorrupt?.Invoke(fallbackMsg);
            LogWarning?.Invoke(fallbackMsg);
        }
    }

    public ConnectorConfig? Load()
    {
        return LoadFromPath(ConnectorPaths.ConfigFile, LogWarning);
    }

    public void Save(ConnectorConfig config)
    {
        config.Validate();
        Directory.CreateDirectory(ConnectorPaths.ConfigDirectory);
        Directory.CreateDirectory(ConnectorPaths.LogsDirectory);

        var json = JsonSerializer.Serialize(config, JsonOptions);
        var path = ConnectorPaths.ConfigFile;
        var tmpPath = path + ".tmp";

        try
        {
            File.WriteAllText(tmpPath, json);
            File.Replace(tmpPath, path, destinationBackupFileName: null);
        }
        finally
        {
            try { if (File.Exists(tmpPath)) File.Delete(tmpPath); } catch { /* ignore */ }
        }
    }
}
