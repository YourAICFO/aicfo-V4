using System.Security.Cryptography;

namespace AICFO.Connector.Shared.Services;

/// <summary>
/// Stores mapping tokens in files under ProgramData using DPAPI (LocalMachine scope)
/// so the Windows Service (LocalSystem) can read tokens saved by the Tray (user).
/// Credential Manager with LocalComputer persistence may not be visible across user vs LocalSystem on some setups.
/// </summary>
public interface ITokenFileStore
{
    void WriteMappingToken(string mappingId, string token);
    string? ReadMappingToken(string mappingId);
}

public sealed class TokenFileStore : ITokenFileStore
{
    private static string TokensDirectory => Path.Combine(ConnectorPaths.ConfigDirectory, "tokens");

    private static string GetFilePath(string mappingId)
    {
        var safeId = string.Join("_", (mappingId ?? "").Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries));
        if (string.IsNullOrEmpty(safeId)) safeId = "default";
        return Path.Combine(TokensDirectory, safeId + ".token");
    }

    public void WriteMappingToken(string mappingId, string token)
    {
        if (string.IsNullOrWhiteSpace(mappingId) || string.IsNullOrWhiteSpace(token)) return;
        try
        {
            Directory.CreateDirectory(TokensDirectory);
            var path = GetFilePath(mappingId);
            var plain = System.Text.Encoding.UTF8.GetBytes(token);
            var encrypted = ProtectedData.Protect(plain, null, DataProtectionScope.LocalMachine);
            File.WriteAllBytes(path, encrypted);
        }
        catch
        {
            // Non-fatal; Credential Manager may still work for Service
        }
    }

    public string? ReadMappingToken(string mappingId)
    {
        if (string.IsNullOrWhiteSpace(mappingId)) return null;
        try
        {
            var path = GetFilePath(mappingId);
            if (!File.Exists(path)) return null;
            var encrypted = File.ReadAllBytes(path);
            var plain = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.LocalMachine);
            return System.Text.Encoding.UTF8.GetString(plain);
        }
        catch
        {
            return null;
        }
    }
}
