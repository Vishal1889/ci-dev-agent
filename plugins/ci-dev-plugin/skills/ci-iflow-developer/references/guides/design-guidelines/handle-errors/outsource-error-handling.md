# Outsource Error Handling to Dedicated iFlow

When multiple iFlows share the same error-handling logic (e.g., sending error notifications, writing to an error log data store, creating incident tickets), you can externalize that logic into a dedicated Error Handling iFlow. The main iFlow's Exception Subprocess calls the Error Handling iFlow via ProcessDirect, delegating all error processing. This reduces duplication and centralizes error handling configuration. The pattern comes in two variants based on the Exception Subprocess end event type in the main iFlow.

## Variant Matrix

| Variant | Exception Subprocess End Event | MPL Status | Error Propagation |
|---------|-------------------------------|------------|-------------------|
| Error End Event | `ErrorEndEvent` | FAILED | Re-throws after calling error handler; main iFlow MPL shows FAILED |
| Message End Event | `MessageEndEvent` | COMPLETED | Swallows exception after calling error handler; main iFlow MPL shows COMPLETED |

## Flow Structure

**Main Integration Flow** (both variants share the same main path):
Start Timer -> Content Modifier ("Create property for productId") -> Request Reply to WebShop (OData) -> Content Modifier ("Create message body") -> End (MessageEndEvent) -> GenericReceiver (ProcessDirect)

**Exception Subprocess** (in main iFlow):
- **Error End Event variant**: Error Start -> Request Reply to ErrorHandlingFlow (ProcessDirect at `/HandleErrors/outsource/errorHandling`) -> Error End Event
- **Message End Event variant**: Error Start -> End (MessageEndEvent). Note: in the message end variant, the subprocess simply ends without calling the error handler -- the error is silently swallowed.

**Error Handling iFlow**:
Sender (ProcessDirect at `/HandleErrors/outsource/errorHandling`) -> Start -> Content Modifier ("Create error message body") -> Content Modifier ("Create receiver header") -> End (MessageEndEvent) -> GenericReceiver (ProcessDirect)

## Known Gotchas
- The Error Handling iFlow receives the message in the state it was when the exception occurred. Exchange properties set before the exception are available, but the body may contain the original payload or an error message depending on when the exception was thrown.
- In the Error End Event variant, the Error Handling iFlow executes first, then the Error End Event re-throws the exception. If the Error Handling iFlow itself fails, the original exception is masked by the new one.
- The Message End Event variant shown here simply swallows the exception without calling the error handler -- it serves as a contrast to the Error End Event variant. In practice, you would typically add a ProcessDirect call to the error handler before the Message End Event if you want both swallowed exceptions and centralized error logging.
- Timer-initiated flows cannot return exceptions to a sender, so the MPL status is the primary indicator of success or failure.
