using CredentialManagement;

namespace AICFO.Connector.Shared.Services;

public interface ICredentialStore
{
    void SaveConnectorToken(string companyId, string token);
    string? LoadConnectorToken(string companyId);
    void DeleteConnectorToken(string companyId);
    void SaveMappingToken(string mappingId, string token);
    string? LoadMappingToken(string mappingId);
    void DeleteMappingToken(string mappingId);
}

public sealed class CredentialStore : ICredentialStore
{
    private static string CompanyTarget(string companyId) => $"{ConnectorPaths.CredentialPrefix}{companyId}";
    private static string MappingTarget(string mappingId) => $"{ConnectorPaths.CredentialPrefix}MAPPING_{mappingId}";

    private static Credential BuildCredential(string target) => new()
    {
        Target = target,
        Username = "connector_token",
        Type = CredentialType.Generic,
        PersistanceType = PersistanceType.LocalComputer
    };

    public void SaveConnectorToken(string companyId, string token)
    {
        var credential = BuildCredential(CompanyTarget(companyId));
        credential.Password = token;

        if (!credential.Save())
        {
            throw new InvalidOperationException("Failed to store connector token in Windows Credential Manager.");
        }
    }

    public string? LoadConnectorToken(string companyId)
    {
        var credential = BuildCredential(CompanyTarget(companyId));
        return credential.Load() ? credential.Password : null;
    }

    public void DeleteConnectorToken(string companyId)
    {
        var credential = BuildCredential(CompanyTarget(companyId));
        credential.Delete();
    }

    public void SaveMappingToken(string mappingId, string token)
    {
        var credential = BuildCredential(MappingTarget(mappingId));
        credential.Password = token;
        if (!credential.Save())
        {
            throw new InvalidOperationException("Failed to store mapping token in Windows Credential Manager.");
        }
    }

    public string? LoadMappingToken(string mappingId)
    {
        var credential = BuildCredential(MappingTarget(mappingId));
        return credential.Load() ? credential.Password : null;
    }

    public void DeleteMappingToken(string mappingId)
    {
        var credential = BuildCredential(MappingTarget(mappingId));
        credential.Delete();
    }
}
