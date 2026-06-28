# Access Headers and Properties in Mappings

Headers and exchange properties set earlier in the flow can be accessed within Message Mappings, XPath conditions, and XSLT Mappings. Each technique uses a different syntax. This is essential for parameterizing mappings dynamically based on runtime context without hardcoding values.

## Variant Matrix

| Technique | Access Syntax | Use Case |
|-----------|--------------|----------|
| Message Mapping (Groovy UDF) | `MappingContext.getProperty(name)` / `MappingContext.getHeader(name)` | Transform XML using dynamic values from headers/properties |
| XPath / Conditions | `$header.name` for headers, `${property.name}` for properties in Router conditions | Conditional routing based on header/property values |
| XSLT Mapping | `$exchange.property.name` in XSLT parameters | XML transformation with dynamic parameters |

## Flow Structure (common pattern)

Sender (HTTPS) -> Start -> Content Modifier ("Define Properties" -- sets headers and properties) -> Request Reply to WebShop (OData) -> [Mapping/Router step] -> End -> Receiver (ProcessDirect)

**Message Mapping variant**: Uses a Message Mapping step that calls Groovy UDFs to read properties and headers from the MappingContext.

**XPath/Conditions variant**: Uses a Router with XPath conditions like `/Products/Product[Category = $header.category]` and non-XML conditions like `${property.format} = 'JSON'` to branch the flow. Also demonstrates using `$header.name` in Filter XPath expressions.

**XSLT Mapping variant**: Uses an XSLT Mapping step where exchange properties are accessed as XSLT parameters via `$exchange.property.name` syntax.

## Groovy Script Patterns

The Groovy UDF script for Message Mapping (`myMappingFunctions.groovy`) provides helper functions to read headers and properties within mapping context:
```groovy
import com.sap.it.api.mapping.MappingContext

def String getProperty(String propertyName, MappingContext context) {
    return context.getProperty(propertyName)
}

def String getHeader(String headerName, MappingContext context) {
    return context.getHeader(headerName)
}
```
These functions are called as UDFs in the graphical Message Mapping editor, with the `MappingContext` automatically injected.

## Known Gotchas
- In XPath conditions, header access uses `$header.name` syntax (with dollar sign and dot), while property access in non-XML conditions uses `${property.name}` syntax (with curly braces). Mixing these syntaxes causes silent evaluation failures.
- `MappingContext` (import: `com.sap.it.api.mapping.MappingContext`) is only available inside Message Mapping Groovy UDFs, not in regular Groovy Script steps. Regular scripts use `message.getHeaders()` and `message.getProperties()` instead.
- XSLT parameter access with `$exchange.property.name` requires the property to be set before the XSLT Mapping step executes. Properties set inside the XSLT are not available.
- In Router XPath conditions, the `$header` prefix accesses CPI message headers, not HTTP headers. The headers must be in the `allowedHeaderList` to be available.
