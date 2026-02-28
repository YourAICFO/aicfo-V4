using System.Text;
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
    private readonly string _configFilePath;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = null,
        WriteIndented = true
    };

    private static readonly UTF8Encoding Utf8NoBom = new(false);

    /// <summary>Optional callback for corruption warning (e.g. set by Tray to log to Serilog).</summary>
    public static Action<string>? LogWarning { get; set; }

    /// <summary>Uses default path (ConnectorPaths.ConfigFile).</summary>
    public ConfigStore() : this(ConnectorPaths.ConfigFile) { }

    /// <summary>Uses the given path (for tests or custom install).</summary>
    public ConfigStore(string configFilePath)
    {
        _configFilePath = configFilePath ?? ConnectorPaths.ConfigFile;
    }

    /// <summary>Load from a specific path. Returns default config if file missing or corrupt. Never throws.</summary>
    public static ConnectorConfig LoadFromPath(string path, Action<string>? onCorrupt = null)
    {
        if (!File.Exists(path))
            return ConnectorConfig.Default();

        byte[] bytes;
        try
        {
            bytes = File.ReadAllBytes(path);
        }
        catch (Exception ex)
        {
            RenameCorrupt(path, onCorrupt, ex.Message);
            return ConnectorConfig.Default();
        }

        if (bytes.Length == 0)
        {
            RenameCorrupt(path, onCorrupt, "Empty file");
            return ConnectorConfig.Default();
        }

        if (bytes[0] == 0x00)
        {
            RenameCorrupt(path, onCorrupt, "File begins with null byte (corrupt or binary)");
            return ConnectorConfig.Default();
        }

        int i = 0;
        while (i < bytes.Length && (bytes[i] == 0x20 || bytes[i] == 0x09 || bytes[i] == 0x0A || bytes[i] == 0x0D || bytes[i] == 0x00))
            i++;
        if (i >= bytes.Length)
        {
            RenameCorrupt(path, onCorrupt, "File is empty or only whitespace/null");
            return ConnectorConfig.Default();
        }
        bytes = bytes.AsSpan(i).ToArray();

        int nullCount = 0;
        foreach (var b in bytes)
        {
            if (b == 0x00) nullCount++;
        }
        if (nullCount > 0)
        {
            RenameCorrupt(path, onCorrupt, "File contains null bytes (possibly UTF-16 or corrupt)");
            return ConnectorConfig.Default();
        }

        string json;
        try
        {
            json = Utf8NoBom.GetString(bytes);
        }
        catch (Exception ex)
        {
            RenameCorrupt(path, onCorrupt, "Invalid UTF-8: " + ex.Message);
            return ConnectorConfig.Default();
        }

        if (string.IsNullOrWhiteSpace(json))
        {
            RenameCorrupt(path, onCorrupt, "Decoded content empty or whitespace");
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
            var corruptPath = path + ".bad-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");
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
        return LoadFromPath(_configFilePath, LogWarning);
    }

    public void Save(ConnectorConfig config)
    {
        config.Validate();
        EnsureConfigDirectoriesExist(_configFilePath);

        var path = _configFilePath;
        var tmpPath = path + ".tmp";

        try
        {
            var json = JsonSerializer.Serialize(config, JsonOptions);
            var bytes = Utf8NoBom.GetBytes(json);
            File.WriteAllBytes(tmpPath, bytes);

            if (File.Exists(path))
                File.Delete(path);
            File.Move(tmpPath, path);
        }
        finally
        {
            try { if (File.Exists(tmpPath)) File.Delete(tmpPath); } catch { /* ignore */ }
        }
    }

    /// <summary>Ensures config directory for the given path and ProgramData logs directory exist. Call before any file write.</summary>
    public static void EnsureConfigDirectoriesExist(string? configFilePath = null)
    {
        var configDir = string.IsNullOrEmpty(configFilePath) ? ConnectorPaths.ConfigDirectory : Path.GetDirectoryName(configFilePath)!;
        if (!string.IsNullOrEmpty(configDir))
            Directory.CreateDirectory(configDir);
        Directory.CreateDirectory(ConnectorPaths.ProgramDataRoot);
        Directory.CreateDirectory(ConnectorPaths.ConfigDirectory);
        Directory.CreateDirectory(ConnectorPaths.LogsDirectory);
    }
}
