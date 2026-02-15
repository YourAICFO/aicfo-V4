using CredentialManagement;

namespace AICFO.Connector.Shared.Services;

public interface ICredentialStore
{
    void SaveConnectorToken(string companyId, string token);
    string? LoadConnectorToken(string companyId);
    void DeleteConnectorToken(string companyId);
}

public sealed class CredentialStore : ICredentialStore
{
    private static string Target(string companyId) => $"{ConnectorPaths.CredentialPrefix}{companyId}";

    public void SaveConnectorToken(string companyId, string token)
    {
        var credential = new Credential
        {
            Target = Target(companyId),
            Username = "connector_token",
            Password = token,
            Type = CredentialType.Generic,
            PersistanceType = PersistanceType.LocalComputer
        };

        if (!credential.Save())
        {
            throw new InvalidOperationException("Failed to store connector token in Windows Credential Manager.");
        }
    }

    public string? LoadConnectorToken(string companyId)
    {
        var credential = new Credential { Target = Target(companyId), Type = CredentialType.Generic };
        return credential.Load() ? credential.Password : null;
    }

    public void DeleteConnectorToken(string companyId)
    {
        var credential = new Credential { Target = Target(companyId), Type = CredentialType.Generic };
        credential.Delete();
    }
}
