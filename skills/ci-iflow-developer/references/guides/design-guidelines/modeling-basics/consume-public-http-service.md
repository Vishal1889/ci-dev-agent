# Consume Public HTTP Service With Query Parameters

This pattern demonstrates calling an external HTTP service with dynamic query parameters. The iFlow uses the HTTP receiver adapter with a URL that includes query parameters resolved from headers or properties at runtime. This is the basic building block for REST API consumption in CPI.

## Flow Structure

Sender (HTTPS) -> Start -> Request Reply to WebShop (HTTP adapter, GET method) -> End

The HTTP receiver adapter is configured with the target URL and query parameters. Headers like `productIdentifier` are passed through to the receiver via the `allowedRequestHeaders` adapter property.

## Known Gotchas
- The HTTP adapter's URL can contain dynamic expressions using `${header.name}` or `${property.name}` syntax for query parameter values.
- Set `throwExceptionOnFailure=true` (default) if you want HTTP errors to trigger exception handling. Set to `false` if you want to inspect the response code manually (see the do-not-throw-error-on-failure guide).
- The `allowedRequestHeaders` property on the HTTP adapter controls which CPI headers are forwarded as HTTP headers to the receiver. Use `*` to forward all, or specify individual header names.
