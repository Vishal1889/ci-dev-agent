# Base64 Encoding and Decoding

The Base64 Encoder and Decoder are built-in flow steps that convert message body content to/from Base64 representation. The Encoder is useful when binary content needs to be embedded in XML or JSON payloads, or when an API expects Base64-encoded data. The Decoder reverses the process. Both operate on the entire message body.

## Variant Matrix

| Variant | Step | Direction |
|---------|------|-----------|
| Base64 Encoder | Base64 Encoder step | Binary/text body -> Base64 string |
| Base64 Decoder | Base64 Decoder step | Base64 string -> original binary/text body |

## Flow Structure

**Encoder**: Sender (HTTPS) -> Start -> Content Modifier -> Request Reply to WebShop (OData) -> Base64 Encoder -> Message Mapping (wraps encoded content) -> End -> Receiver (ProcessDirect)

**Decoder**: Sender (HTTPS) -> Start -> Content Modifier ("Define Properties") -> Base64 Decoder -> End -> Receiver (ProcessDirect)

## Groovy Script Patterns

The Encoder variant includes a Groovy UDF (`GetProperty.groovy`) for accessing properties within Message Mapping, using the same `MappingContext` pattern as the access-headers-properties guide:
```groovy
import com.sap.it.api.mapping.MappingContext

def String getProperty(String propertyName, MappingContext context) {
    return context.getProperty(propertyName)
}
```

## Known Gotchas
- The Base64 Encoder/Decoder steps operate on the entire message body. If you need to encode/decode only a portion of the payload, use a Groovy Script with `java.util.Base64` instead.
- After Base64 encoding, the body is a plain string. If the downstream step expects XML, wrap the encoded string in an XML element using a Content Modifier or Message Mapping.
- The Base64 Decoder expects the entire body to be valid Base64. If the body contains non-Base64 content (e.g., XML wrappers), extract the Base64 portion first.
