namespace AICFO.Connector.Shared.Models;

/// <summary>Result of Tally reachability check. If GET / returns "TallyPrime Server is Running", server is reachable even if POST fails.</summary>
public sealed record TallyReachabilityResult(
    bool IsReachable,
    string? UnreachableReason,
    string? ApiRequestFailure
);
