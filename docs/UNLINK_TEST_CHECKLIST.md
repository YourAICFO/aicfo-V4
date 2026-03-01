# Unlink company – test checklist

## IDs used end-to-end

| Layer    | ID type    | Where used |
|----------|------------|------------|
| Backend  | `ConnectorCompanyLink.id` (UUID) | DB primary key; API `POST /device/links/:id/unlink` uses this as `:id` |
| Connector| `mapping.LinkId` | Set when linking from backend response `link.Id`; sent to unlink API |
| Connector| `mapping.Id` | Local mapping id (guid); used in config.json and for token store keys |
| Web      | `companyId` | Selected company; status/v1 returns `links[]` for that company |

Same value flows: **linkId** (backend link record id) = **mapping.LinkId** in tray = **:id** in unlink URL.

## Manual test

1. **Link**
   - In connector tray: login, select web company + Tally company, click Link.
   - Confirm config.json has a mapping with `linkId` and status/v1 returns `links.length >= 1` for that company.
   - Web: Connector Setup shows “Linked to Tally: …” and step completed.

2. **Unlink from tray**
   - In tray: select the mapping, click “Unlink Mapping”, confirm Yes.
   - Backend: check logs for `[connector] Unlink: linkId=... companyId=... userId=...`.
   - Tray: mapping disappears from list; config.json no longer contains that mapping; tray log “[INF] Unlinked locally: mappingId=...”.
   - Web: switch to another tab and back (or click “Check Connection”). Connector Setup should show “Not linked” and “Link Company” step not completed (no hard reload).

3. **Sync/heartbeat stopped**
   - After unlink, run sync/heartbeat from tray or wait for service. That mapping must not be included (service reads config from file; mapping is gone).

4. **Re-link**
   - Link again from tray. Web status should show “Linked” again after refocus/refresh.

## Integration test (optional)

- Backend: call `POST /api/connector/device/links/:id/unlink` with valid device token and link id; assert 200 and `isActive: false`; assert GET status/v1 for that company has no active link for that id.
- Connector: unit test that RemoveSelectedMappingAsync removes mapping from config and calls UnlinkDeviceLinkAsync with mapping.LinkId.
