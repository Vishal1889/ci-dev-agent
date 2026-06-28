# Restrict HTTP Method

This pattern demonstrates how to handle different HTTP methods (GET, POST, PUT, DELETE) within a single HTTPS sender endpoint. The iFlow uses a Router to check the `CamelHttpMethod` header and branches to method-specific processing. Each HTTP method is handled by a separate Local Integration Process, allowing clean separation of CRUD operations behind a single URL path.

## Flow Structure

Sender (HTTPS) -> Start -> Router (checks `CamelHttpMethod`):
- **Handle GET**: Local Integration Process for read operations
- **Handle POST**: Local Integration Process for create operations  
- **Handle DELETE**: Local Integration Process for delete operations -> Groovy Script ("read Url Path" -- extracts resource ID from URL) -> Content Modifier ("DELETE response") -> Data Store Delete
- **Handle not allowed methods** (default): Returns error response for unsupported methods

## Groovy Script Patterns

The `ReadIdFromURLPath.groovy` script extracts a resource ID from the last segment of the request URL path:
```groovy
def url = message.getHeaders().get("CamelHttpUrl")
String[] vUrl = url.split('/')
message.setProperty('productId', vUrl[vUrl.length - 1])
```
This pattern is useful for RESTful URL patterns like `/api/products/123` where the ID is the last path segment.

## Known Gotchas
- The `CamelHttpMethod` header is automatically set by the HTTPS sender adapter and contains the HTTP method (GET, POST, PUT, DELETE, etc.) as a string.
- The Router must check for each supported method explicitly. The default route should return an appropriate error (e.g., 405 Method Not Allowed) for unsupported methods.
- URL path parsing via `CamelHttpUrl.split('/')` is fragile if the URL contains query parameters. Strip query parameters first using `url.split('\\?')[0]` before splitting by path separators.
- When using the HTTPS sender adapter, the `urlPath` property defines the base path. The actual request URL may include additional path segments and query parameters that are accessible via `CamelHttpUrl` and `CamelHttpQuery` headers.
