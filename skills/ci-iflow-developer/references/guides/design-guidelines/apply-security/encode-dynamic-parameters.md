# Encode Dynamic Parameters

When dynamic header or property values are injected into OData query options or URL paths, they must be URL-encoded to prevent injection attacks and malformed requests. Without encoding, a header value containing characters like `&`, `=`, or spaces would corrupt the query string or enable parameter injection. This pattern uses a Groovy script to encode user-supplied values before they reach the adapter configuration.

## Groovy Script Pattern

```groovy
import java.nio.charset.StandardCharsets

def Message processData(Message message) {
    def map = message.getHeaders()
    def rating = map.get("rating")
    if (rating != null) {
        rating = URLEncoder.encode(rating, StandardCharsets.UTF_8.name())
        message.setHeader("rating", rating)
    }
    return message
}
```

Place this script step before any adapter or Content Enricher that interpolates the header into a query string (e.g., OData query option `$filter=Rating le ${header.rating}`).

## Flow Structure

Sender --> [HTTPS] --> Start --> Groovy Script (encode header) --> Content Enricher with Lookup (OData query using encoded header) --> End --> [ProcessDirect] --> GenericReceiver

## Parameters

| Key | Purpose | Example |
|---|---|---|
| `WebShopAddress` | OData service base URL | `https://refapp-espm-ui-cf.cfapps.eu10.hana.ondemand.com/espm-cloud-web/espm.svc` |

## Known Gotchas
- Always encode BEFORE the value is interpolated into the query; encoding after interpolation would encode the structural `&` and `=` characters too
- The `rating` header must be listed in `allowedHeaderList` on the iFlow to survive from sender to integration process
- OData `$filter` expressions with dynamic values are the most common injection vector in CPI
