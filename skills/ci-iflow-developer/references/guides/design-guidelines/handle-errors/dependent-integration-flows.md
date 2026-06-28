# Dependent Integration Flows Error Handling

When a parent iFlow calls a child iFlow via ProcessDirect, exceptions in the child do not automatically propagate as typed errors to the parent. Instead, the child must catch its own exceptions in an Exception Subprocess, set a signal header (e.g., `error_occured=true`), replace the body with an error description, and end with a **Message End Event** so it returns normally. The parent then reads the signal header after the Gather step and routes to success or error handling accordingly. This pattern is essential when the parent uses Splitter-Gather because an uncaught child exception would abort the entire split sequence.

There are two architecture options demonstrated: a **multi-artifact** approach (separate Parent and Child iFlow artifacts connected via ProcessDirect at `/HandleErrors/parent2child`) and a **single-artifact** approach (both Parent Integration Process and Child Integration Process in one iFlow, still connected via ProcessDirect). The single-artifact variant is simpler to deploy but limits reuse of the child flow.

## Flow Structure

**Parent iFlow** (multi-artifact or parent process):
- Sender (HTTPS) -> Start -> General Splitter (XPath `//category`) -> Request Reply to Child (ProcessDirect) -> Content Modifier (store `error_occured` header as property) -> Gather (concatenate PlainText) -> Router -> [success path] Content Modifier -> End (MessageEndEvent) -> GenericReceiverSuccess | [error path] Content Modifier -> End (MessageEndEvent) -> GenericReceiverError

**Child iFlow** (multi-artifact or child process):
- Parent (ProcessDirect sender at `/HandleErrors/parent2child`) -> Start -> Content Modifier (store category as property) -> Request Reply to WebShop (OData) -> Content Modifier (count products via XPath `count(//Product)`) -> Router -> [products found: default] Content Modifier (build success body) -> End (MessageEndEvent) | [no products: `${property.NoOfProducts} = '0'`] Error End Event
- **Exception Subprocess**: Error Start -> Content Modifier (set header `error_occured=true`, body = error text) -> End (MessageEndEvent)

**Single-artifact variant** (Child Integration Process):
- Same child logic but uses a Router with condition `${header.exception_in_subprocess} = 'true'` -> Error End Event to re-throw, or default -> Content Modifier (success message) -> End (MessageEndEvent)
- Exception Subprocess catches errors and creates a message with error headers

## Key Mechanisms

- **Header-based error signaling**: The child's Exception Subprocess sets `error_occured=true` as a header. The iFlow's `allowedHeaderList` includes this header to allow it to pass through ProcessDirect boundaries.
- **Property persistence across ProcessDirect**: The parent stores the header value into a property via Content Modifier (`header:error_occured` -> property `error_occured`) because headers may be lost after Gather.
- **Router condition in parent**: `${property.error_occured} = 'true'` routes to the error branch after Gather.
- **Splitter config**: General Splitter with XPath, StopOnException=true, sequential processing. The Gather uses concatenate strategy with PlainText message type.

## Known Gotchas
- The `allowedHeaderList` on both parent and child iFlows must include the error signal header, otherwise it is silently dropped at the ProcessDirect boundary.
- If the child ends with an Error End Event instead of a Message End Event in the Exception Subprocess, the exception propagates up to the parent and causes the entire Splitter-Gather to fail (which may be desired in the single-artifact variant but not in the multi-artifact variant).
- The child uses a Router with an Error End Event for the "no products" case -- this is intentional to trigger the Exception Subprocess so the error header gets set, rather than just returning empty results silently.
