# Do Not Throw Error on Failure

The HTTP and OData receiver adapters have a `throwExceptionOnFailure` property that controls whether HTTP error responses (4xx, 5xx) cause an exception or are returned as normal messages with the HTTP response code in `CamelHttpResponseCode` header. Setting this to `false` lets you inspect the response code in a Router and handle specific error conditions (400, 404, etc.) gracefully without triggering the exception handling machinery. This is useful when the caller needs structured error responses rather than generic MPL FAILED status.

## Flow Structure

Sender (HTTPS) -> Start -> Router ("throw exception on failure?"):
- **Yes branch** (`${header.throwExceptionOnFailure} = 'true'`): Request Reply to WebShop (HTTP adapter with `throwExceptionOnFailure=true`) -> End (MessageEndEvent). Any HTTP error causes an exception, caught by default error handling.
- **No branch** (default): Request Reply to WebShop (HTTP adapter with `throwExceptionOnFailure=false`) -> Router ("check response code"):
  - `${header.CamelHttpResponseCode} = '200'` -> End (MessageEndEvent) -- pass through successful response
  - `${header.CamelHttpResponseCode} = '404'` -> Content Modifier (set 404 response body, delete `CamelHttpResponseCode` header) -> End (MessageEndEvent)
  - `${header.CamelHttpResponseCode} = '400'` -> Content Modifier (set 400 response body, delete `CamelHttpResponseCode` header) -> End (MessageEndEvent)
  - **Default** (other codes) -> Error End Event -- unexpected codes still fail the MPL

## Parameters

| Key | Purpose | Example |
|-----|---------|---------|
| `credential` | Credential name for HTTP Basic auth to WebShop | `myCredential` |

## Known Gotchas
- When `throwExceptionOnFailure=false`, the `CamelHttpResponseCode` header contains the actual HTTP status code as a string. You must delete this header before returning to the sender, otherwise the iFlow returns that status code to the original caller.
- The `allowedHeaderList` must include `productIdentifier`, `host`, and `throwExceptionOnFailure` for the routing logic to work.
- The HTTP adapter with `throwExceptionOnFailure=false` still populates the message body with the error response from the backend -- this raw error body may not be suitable for returning to the caller, so the Content Modifier replaces it.
