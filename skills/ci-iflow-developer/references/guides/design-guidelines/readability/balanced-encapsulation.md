# Balanced Encapsulation

When an integration flow grows beyond a manageable number of steps, split it into a **main orchestration flow** and one or more **sub-flows** connected via ProcessDirect adapters. This pattern keeps each flow focused on a single responsibility and visually navigable. The main flow handles inbound reception, shared preprocessing (e.g., data retrieval, header encoding), and routing decisions; sub-flows encapsulate branch-specific logic. Decompose when a single flow would exceed roughly 10-15 steps or when distinct processing branches have independent lifecycles (different owners, different change cadences). Do NOT over-decompose: if a branch is only 2-3 trivial steps, keep it inline. Each sub-flow adds deployment and monitoring overhead, so the trade-off is readability versus operational complexity.

## Flow Structure

**Main flow** ("Apply Balanced Encapsulation"):
- Sender (HTTPS, `/ApplyBalancedEncapsulation`) -> Integration Process
- Steps: Groovy "Encode header" -> Request-Reply to OData receiver (read product details) -> Content Modifier "Define property for price" (XPath `//Price` -> property `Price`) -> Router
- Router branches on `${property.Price} > '500'`:
  - **High price**: Send via ProcessDirect to `/HighPrice` receiver -> End
  - **Low price** (default): Send via ProcessDirect to `/LowPrice` receiver -> End

**Sub-flow "Process High Price Items":**
- Sender (ProcessDirect, `/HighPrice`) -> Integration Process "Handle High Price Items"
- Content Modifier: sets header `receiver=HighPrice`, `context=PreserveReadability-Encapsulation`, extracts properties (Comment, CreationDate, Rating, ProductId via XPath)
- End -> ProcessDirect to Generic Receiver

**Sub-flow "Process Low Price Items":**
- Sender (ProcessDirect, `/LowPrice`) -> Integration Process "Handle Low Price Items"
- Content Modifier: sets header `receiver=LowPrice`, `context=PreserveReadability-Encapsulation`
- End -> ProcessDirect to Generic Receiver

## Variant Matrix

| Variant | Key Difference |
|---|---|
| Main flow | Receives HTTPS, queries OData, routes by price threshold |
| Process High Price Items | ProcessDirect sub-flow, extracts detailed product properties |
| Process Low Price Items | ProcessDirect sub-flow, minimal processing (headers only) |

## Groovy Script Patterns

The main flow includes a header-encoding script. It URL-encodes a header value before using it as an OData query parameter:

```groovy
import java.nio.charset.StandardCharsets

def Message processData(Message message) {
    def map = message.getHeaders()
    def rating = map.get("rating")
    if (rating != null) {
        rating = URLEncoder.encode(rating, StandardCharsets.UTF_8.name())
        message.setHeader("productId", productId)
    }
    return message
}
```

The remaining scripts (script1-4) demonstrate MPL logging patterns: `setStringProperty`, `addCustomHeaderProperty`, and `addAttachmentAsString`. These are utility patterns for adding monitoring data and are not central to the encapsulation design.

## Parameters

| Key | Purpose | Example |
|---|---|---|
| `address` | OData service URL for product lookup | `https://...espm.svc` |

## Known Gotchas

- The Router condition uses string comparison (`${property.Price} > '500'`); ensure the XPath-extracted Price is numeric or the comparison may produce unexpected results with alphabetical ordering.
- ProcessDirect addresses (`/HighPrice`, `/LowPrice`) must exactly match between the main flow's receiver channel and the sub-flow's sender channel. A mismatch silently fails at deploy time with no build error.
- Sub-flows must be deployed to the **same tenant** as the main flow; ProcessDirect does not work cross-tenant.
- The `allowedHeaderList` on sub-flows must include any headers the sub-flow needs from the caller (e.g., the low-price sub-flow allows `context`).
