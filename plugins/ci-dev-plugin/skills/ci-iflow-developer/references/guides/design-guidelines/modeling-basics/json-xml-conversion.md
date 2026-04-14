# JSON to XML and XML to JSON Conversion

CPI provides built-in converter steps for JSON-to-XML and XML-to-JSON transformation. Additionally, Message Mapping can be used for XML-to-JSON conversion when more control over the output structure is needed. These patterns are commonly used when bridging REST/JSON APIs with XML-based backend systems.

## Variant Matrix

| Variant | Mechanism | Use Case |
|---------|-----------|----------|
| JSON to XML Converter + XML to JSON Converter | Built-in converter flow steps | Round-trip conversion; quick prototyping |
| XML to JSON via Message Mapping | Message Mapping with JSON output type | Precise control over JSON structure, field selection, renaming |

## Flow Structure

**Converter steps variant**: Sender (HTTPS) -> Start -> JSON to XML Converter -> Content Enricher (Request Reply to WebShop OData) -> Message Mapping -> XML to JSON Converter -> End -> Receiver (ProcessDirect)

**Message Mapping variant**: Sender (HTTPS) -> Start -> Content Modifier ("Define content type", sets `content-type: application/json`) -> Message Mapping (XML to JSON output) -> End -> Receiver (ProcessDirect)

The Message Mapping variant uses Groovy UDFs with `MappingContext` to access headers and properties during the mapping, following the same pattern as the access-headers-properties guide.

## Parameters

| Key | Purpose | Example |
|-----|---------|---------|
| `Address` | WebShop OData URL (converter variant) | `https://refapp-espm-ui-cf.cfapps.eu10.hana.ondemand.com/espm-cloud-web/espm.svc` |

## Known Gotchas
- The JSON to XML Converter wraps JSON arrays in a default root element. If the downstream XML processing expects a specific root element name, configure the converter's "JSON Prefix" and "JSON Root Element" settings.
- The XML to JSON Converter may produce unexpected output for mixed-content XML or attributes. Attributes become JSON properties with an `@` prefix by default.
- When using Message Mapping for XML-to-JSON, set the output message type to JSON format in the mapping definition. The Content Modifier must set `content-type: application/json` before the end event for the receiver to interpret the response correctly.
- The built-in converters handle simple structures well but struggle with complex nested XML that has namespace prefixes. For such cases, prefer Message Mapping or XSLT.
