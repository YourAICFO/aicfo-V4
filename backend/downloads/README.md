# AI CFO Connector Download Artifact

This folder is the backend-served download location for the **real Windows MSI** connector.

## Required file
- `AICFOConnectorSetup.msi`

The backend route `GET /download/connector` serves this file directly with:
- `Content-Disposition: attachment; filename="AICFOConnectorSetup.msi"`
- `Content-Type: application/octet-stream`

## Build and publish flow
1. Build MSI on Windows from `connector-dotnet`:
   - `cd connector-dotnet`
   - `./build.ps1 -Configuration Release`
2. Copy output MSI to this folder as:
   - `backend/downloads/AICFOConnectorSetup.msi`
3. Deploy backend.

## Important
- Do not place placeholder `.exe` or script files in this folder.
- Only ship a genuine MSI built from the .NET service/tray + WiX installer.
