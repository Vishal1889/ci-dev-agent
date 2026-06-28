# Data Store Operations and Persist Step

CPI provides two mechanisms for persisting message data: **Data Store operations** (SELECT, GET, WRITE, DELETE) for explicit CRUD access to a key-value store, and the **Persist step** for automatically saving the message payload at a specific point in the flow for monitoring/debugging purposes. Data Store operations are used for business data persistence (caching, decoupling, idempotency), while the Persist step is used for operational visibility.

## Variant Matrix

| Variant | Mechanism | Use Case |
|---------|-----------|----------|
| Data Store - WRITE | Data Store Write step | Store message payload with a key for later retrieval |
| Data Store - GET | Data Store Get step | Retrieve a single entry by key |
| Data Store - SELECT | Data Store Select step | Retrieve multiple entries, optionally with filter |
| Data Store - DELETE | Data Store Delete step | Remove an entry by key |
| Persist Step | Persist flow step | Save message snapshot to MPL for monitoring; does not affect flow logic |

## Flow Structure

**Data Store Operations** (4 separate integration processes in one iFlow):
- **WRITE**: Sender (HTTPS) -> Start -> Request Reply to WebShop (OData) -> Data Store Write -> End
- **GET**: Sender (HTTPS) -> Start -> Data Store Get -> Content Modifier ("Define message body") -> End
- **SELECT**: Sender (HTTPS) -> Start -> Data Store Select -> Filter -> Content Modifier ("Define message body") -> End
- **DELETE**: Sender (HTTPS) -> Start -> Data Store Delete -> Content Modifier -> End

**Persist Step**: Sender (HTTPS) -> Start -> Content Modifier ("Store product identifier as property") -> Persist ("Persist inbound message") -> Request Reply to WebShop (OData) -> Persist ("Persist outbound message") -> Content Modifier ("Define response message") -> End

## Parameters

| Key | Purpose | Example |
|-----|---------|---------|
| `Address` | WebShop OData URL | `https://refapp-espm-ui-cf.cfapps.eu10.hana.ondemand.com/espm-cloud-web/espm.svc` |

## Known Gotchas
- Data Store entries have a configurable retention period (default: 90 days). Entries are automatically deleted after expiration. For permanent storage, use an external database.
- The Data Store key must be unique within a Data Store name. Writing with an existing key overwrites the previous entry. Use this for upsert semantics or combine with GET to implement idempotency checks.
- The Persist step saves the message body, headers, and properties at that point in the flow. It does not affect message processing -- the flow continues normally. Persisted messages are visible in the MPL under "Message Content."
- Data Store SELECT returns entries as an XML structure containing multiple entries. Use a Filter or Splitter step to process individual entries.
- Data Store operations count against the tenant's database storage quota. Monitor usage when storing large or many messages.
- The Persist step is useful for debugging but adds I/O overhead. Remove or disable it in production flows unless monitoring is explicitly required.
