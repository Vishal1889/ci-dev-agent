# Externalize Volatile Configurations

Use `parameters.prop` to externalize values that change across environments or are updated frequently without requiring a redeployment of the integration flow artifact. Typical candidates: endpoint URLs, credential aliases, file paths, sender adapter addresses, and any value that differs between dev/test/prod. The `{{paramName}}` placeholder syntax in adapter properties references externalized parameters. After deployment, these values can be changed at runtime via the Integration Suite's "Configure" dialog without touching the iFlow design.

## Flow Structure

Simple single-process flow:
- Sender (HTTPS, address = `{{sender_address}}`) -> Integration Process
- Content Enricher: queries OData receiver (address = `{{inventory_address}}`, resource `ProductCategories`) to enrich the inbound payload
- End -> ProcessDirect to Generic Receiver

The key teaching point is that both the sender adapter's `urlPath` and the receiver adapter's `address` use externalized parameters rather than hardcoded values.

## Parameters

| Key | Purpose | Example |
|---|---|---|
| `sender_address` | HTTPS sender endpoint path | `/Externalize_Volatile_Configurations` |
| `inventory_address` | OData service base URL for product categories | `https://...espm.svc` |

## Known Gotchas

- The `{{paramName}}` syntax only works in adapter property fields that support externalization. Not all fields support it; check the adapter documentation.
- Parameter names are case-sensitive and must exactly match between `parameters.prop` and the `{{placeholder}}` in the iFlow.
- After changing externalized parameters at runtime, the iFlow must be **restarted** (undeployed and redeployed, or via the restart action) for changes to take effect. There is no hot-reload.
- Do NOT externalize values that contain backslashes or special characters without proper escaping in the `.prop` file format (Java Properties format uses `\` as escape character; e.g., `:` must be escaped as `\:`).
- Avoid externalizing values that rarely change (e.g., XPath expressions, static content types). Over-externalizing obscures the flow logic and makes the Configure dialog unwieldy.
