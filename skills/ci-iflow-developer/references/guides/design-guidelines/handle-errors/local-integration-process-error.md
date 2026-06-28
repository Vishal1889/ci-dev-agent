# Local Integration Process Error Handling

A Local Integration Process (subprocess) provides a scoped error-handling boundary within a single iFlow. The main Integration Process calls the Local Integration Process via a Process Call step. The Local Integration Process has its own Exception Subprocess that catches errors occurring within its scope. This pattern demonstrates how the Exception Subprocess end event type determines whether the error stays contained within the local process or propagates back to the main process.

## Flow Structure

**Main Integration Process**:
Sender (HTTPS at `/HandleErrors/DependentFlowsSimple`) -> Start -> Request Reply to Child (ProcessDirect at `/HandleErrors/DependentFlowsSimple/parent2child`) -> End (MessageEndEvent) -> GenericReceiver (ProcessDirect)

**Child Integration Process** (in same or separate iFlow):
Parent (ProcessDirect sender) -> Start -> Router:
- **Success** (default): Content Modifier ("Create success message", sets header `receiver=Success`, `context=HandlingErrors-DependentFlowsSimple`) -> End (MessageEndEvent)
- **Exception** (`${header.exception_in_subprocess} = 'true'`): Error End Event -- re-throws to trigger Exception Subprocess

**Exception Subprocess** (within Child Integration Process):
Error Start -> Content Modifier ("Create exception message", sets header `receiver=Error`, `context=HandlingErrors-DependentFlowsSimple`, body = "Error: Message processing failed.") -> End (MessageEndEvent)

The Exception Subprocess ends with a **Message End Event**, which means it swallows the exception and returns normally to the parent. The parent receives the error message body but its own processing continues without interruption. The `allowedHeaderList` includes `exception_in_subprocess` to pass the trigger header through ProcessDirect.

## Known Gotchas
- The Local Integration Process in this example uses a Message End Event in the Exception Subprocess, so errors are caught and transformed into normal responses. If you need the parent to detect the error, use the header-signaling pattern (set a flag header like `error_occured=true` before the Message End Event).
- The Router condition `${header.exception_in_subprocess} = 'true'` combined with Error End Event is used to deliberately trigger the Exception Subprocess for demonstration. In production, the Exception Subprocess catches real runtime errors from external calls.
- Process Call vs. Request Reply via ProcessDirect: The single-artifact variant here uses two processes within one iFlow. The multi-artifact variant uses separate iFlows connected via ProcessDirect adapter.
