# Expose Endpoint for Scheduled Flow

When an integration flow is normally timer-triggered (scheduled), add a second Integration Process with an HTTPS sender endpoint to allow on-demand triggering. This pattern enables testing, ad-hoc runs, and operational flexibility without changing the timer schedule. Both entry points share the same core logic via a Local Integration Process (Process Call), avoiding duplication. The HTTPS-triggered process can accept filter parameters (e.g., an `Id` header) for targeted runs, while the timer-triggered process runs with broader defaults (e.g., no filter, receiver="all").

## Flow Structure

Three processes in a single iFlow:

**1. "Integration Process - Message triggered exchange of data"** (HTTPS sender):
- Sender (HTTPS, `/PreserveReadability/ExposeEndpointForScheduledFlow`) -> Start
- Content Modifier "Define filter": property `FilterString` = `$filter=Id eq ${header.Id}` (uses inbound header)
- Process Call -> Local Integration Process
- Content Modifier "Define particular receiver id": header `receiver` = `${header.Id}`
- End -> ProcessDirect to Generic Receiver

**2. "Integration Process - Timer triggered exchange of data"** (Timer sender):
- Start Timer (fireNow=true) -> Start
- Content Modifier "Define filter": property `FilterString` = empty (no filter, fetch all)
- Process Call -> Local Integration Process
- Content Modifier "Define receiver id all": header `receiver` = `all`
- End -> ProcessDirect to Generic Receiver

**3. "Local Integration Process with integration logic"** (shared):
- Start -> Request-Reply to OData receiver (query `ProductTexts` with `${property.FilterString}`)
- XML to CSV Converter (XPath `ProductTexts/ProductText`, separator `;`)
- Content Modifier: sets header `context=PreserveReadability-Endpoint4Scheduled`, `Content-Type=text/csv`
- End

## Parameters

| Key | Purpose | Example |
|---|---|---|
| `Address` | OData service URL | `https://...espm.svc` |

## Known Gotchas

- The `allowedHeaderList` must include `Id` so the HTTPS-triggered process can receive the filter parameter from the caller.
- The timer is set to `fireNow=true` with `triggerType=simple` and `noOfSchedules=1`, meaning it fires once on deployment. In production, configure a proper cron schedule; otherwise it runs every time the artifact is redeployed.
- Both processes share the same `FilterString` property name. The Local Integration Process is stateless with respect to which caller invoked it, so the property must be set before the Process Call.
- If the OData `$filter` expression in the HTTPS path is not URL-encoded, special characters in the `Id` header value may break the query.
