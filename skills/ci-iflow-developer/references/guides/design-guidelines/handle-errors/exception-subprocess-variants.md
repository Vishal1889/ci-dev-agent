# Exception Subprocess End Event Variants

The Exception Subprocess is the primary mechanism for catching and handling exceptions within an Integration Process. The critical design decision is which **end event type** to use inside the Exception Subprocess, as each type produces fundamentally different runtime behavior for MPL status, caller notification, and escalation. All three variants share the same main flow structure: an HTTPS sender triggers a flow that calls a WebShop via OData, with a Groovy Script that conditionally simulates an error by setting a property that routes to a non-existent path.

## Variant Matrix

| Variant | End Event Type | MPL Status on Exception | Exception Propagated to Caller? | Use Case |
|---------|---------------|------------------------|-------------------------------|----------|
| Message End Event | `MessageEndEvent` | **COMPLETED** | No -- returns success response | Silently swallow exception; log it but do not fail the message |
| Error End Event | `ErrorEndEvent` | **FAILED** | Yes -- re-throws exception | Standard error handling: catch, enrich with diagnostic info, then re-throw |
| Escalation End Event | `EscalationEndEvent` | **ESCALATED** | No -- does not propagate | Flag for manual review; message is not failed but marked for attention |

## Flow Structure (shared across all three variants)

Sender (HTTPS) -> Start -> Groovy Script ("simulate an error" -- sets property `path` to `"XYZ"` when header `error=true`) -> Request Reply to WebShop (OData, query Products filtered by `productId`, with resource path including `${property.path}` which causes OData error when non-empty) -> End (MessageEndEvent)

**Exception Subprocess** (differs by variant):
- Error Start -> [variant-specific steps] -> [variant-specific End Event]

### Message End Event variant
Exception Subprocess: Error Start -> Content Modifier ("Create error message & custom status") -> End (MessageEndEvent)
- The Content Modifier creates a custom header for status tracking. The MessageEndEvent causes the subprocess to complete normally, so the main process ends with COMPLETED status.

### Error End Event variant  
Exception Subprocess: Error Start -> Groovy Script ("add additional information to MPL" -- attaches error details as MPL attachment) -> Error End Event
- The Groovy Script logs the error productId to the MPL. The Error End Event re-throws the exception, causing MPL FAILED status.

### Escalation End Event variant
Exception Subprocess: Error Start -> Groovy Script ("add additional information to MPL" -- attaches escalation info as MPL attachment) -> Escalation End Event
- Similar to Error End Event variant but uses Escalation End Event, which sets MPL to ESCALATED status without propagating the exception.

## Groovy Script Patterns

The error-simulation script (`script3.groovy`) reads a header to conditionally trigger an error:
```groovy
def error = message.getHeaders().get("error")
message.setProperty("path", "")
if (error.toBoolean()) {
    message.setProperty("path", "XYZ")
}
```
Setting property `path` to `"XYZ"` causes the OData request to target an invalid resource path, triggering an OData error.

The MPL attachment script (`script4.groovy`, used in Error End Event and Escalation End Event variants) logs error context:
```groovy
def productId = message.getHeaders().get("productId")
String body = "An error occured when calling the product catalog with productId equals " + productId
def messageLog = messageLogFactory.getMessageLog(message)
if (messageLog != null) {
    messageLog.addAttachmentAsString('Additional Information', body, 'text/plain')
}
```

## Known Gotchas
- **Message End Event swallows exceptions silently**: The MPL shows COMPLETED even though an error occurred. Use this only when the error is truly non-critical and you have alternative monitoring (e.g., custom headers, data store entries).
- **Error End Event in a child flow called via ProcessDirect**: The re-thrown exception propagates to the parent, which may be desirable or not depending on whether the parent has its own error handling.
- **Escalation End Event**: The ESCALATED MPL status is a distinct state from FAILED -- monitoring dashboards and alerting rules must be configured to watch for ESCALATED status separately.
- The error simulation mechanism (setting an OData resource path to an invalid value) is specific to these design guideline examples. In production, the Exception Subprocess would catch real runtime errors.
