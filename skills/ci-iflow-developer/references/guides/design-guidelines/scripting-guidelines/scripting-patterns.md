# Groovy Scripting API Patterns

CPI Groovy scripts extend iFlow processing by accessing platform APIs not reachable through standard flow steps. Each pattern below addresses a specific runtime API: reading/writing headers and properties inside message mappings (MappingContext), logging payloads and custom headers to the Message Processing Log, parsing JSON payloads, extracting URL path segments and query parameters from inbound HTTP requests, reading credentials from Secure Store, and performing value mapping lookups. Scripts execute in a Groovy sandbox with access to `message` (the pipeline Message object) and implicit bindings like `messageLogFactory`. All functions must accept and return a `Message` object (or use `MappingContext` for UDF variants). Prefer the Script Collection artifact pattern over embedding scripts directly in iFlows for reusability.

## MappingContext Functions (UDF in Message Mapping)

Use `MappingContext` to read/write headers and exchange properties from within User-Defined Functions in a Message Mapping step. The MappingContext parameter must be the last parameter in the function signature.

```groovy
import com.sap.it.api.mapping.MappingContext

def String getheader(String header_name, MappingContext context) {
    return context.getHeader(header_name)
}

def String getProperty(String property_name, MappingContext context) {
    return context.getProperty(property_name)
}

def String setHeader(String header_name, String header_value, MappingContext context) {
    context.setHeader(header_name, header_value)
    return header_value
}

def String setProperty(String property_name, String property_value, MappingContext context) {
    context.setProperty(property_name, property_value)
    return property_value
}
```

For multi-value output, use `Output` parameter: `def void func(String[] inputs, Output output, MappingContext context)` and call `output.addValue(val)`.

## MPL Attachment Logging

Attach the current message body (or any string) to the Message Processing Log for monitoring/debugging. The `messageLogFactory` is an implicit binding available in all Groovy script steps.

```groovy
def Message payloadLogger(Message message) {
    def body = message.getBody(java.lang.String)
    def messageLog = messageLogFactory.getMessageLog(message)
    if (messageLog != null) {
        messageLog.addAttachmentAsString('Payload', body, 'text/plain')
    }
    return message
}
```

The third parameter is the MIME type. Always null-check `messageLog` as it can be null when trace logging is disabled.

## MPL Custom Header Properties

Set custom header properties on the MPL entry that appear as searchable/filterable columns in the Integration Suite monitoring UI. Useful for correlating messages by business identifiers like PO number.

```groovy
def Message setCustomHeader(Message message) {
    def messageLog = messageLogFactory.getMessageLog(message)
    if (messageLog != null) {
        def po_number = message.getHeaders().get("po_number")
        if (po_number != null) {
            messageLog.addCustomHeaderProperty("po_number", po_number)
        }
    }
    return message
}
```

Standard MPL headers (SAP_Sender, SAP_Receiver, SAP_MessageType, SAP_ApplicationID) can be set via Content Modifier without scripting. Use `setStringProperty` for MPL log properties; use `addCustomHeaderProperty` for searchable custom headers.

## Parse JSON

Use `groovy.json.JsonSlurper` to parse JSON payloads and extract fields into exchange properties for downstream use (e.g., dynamic OData resource paths).

```groovy
import groovy.json.JsonSlurper

def Message parseJsonMessage(Message message) {
    def json = message.getBody(java.io.Reader)
    def data = new JsonSlurper().parse(json)

    message.setProperty("service", data.query.service)
    message.setProperty("resource", data.query.entity.name)
    message.setProperty("id", data.query.entity.id)

    def fields = data.query.entity.fields.collect { it.name }.join(",")
    message.setProperty("fields", fields)

    return message
}
```

Use `getBody(java.io.Reader)` for streaming parse rather than `getBody(String)` for large payloads.

## Read URL Query Parameters

Extract query string parameters from inbound HTTP requests via the `CamelHttpQuery` header. Useful for building dynamic OData calls based on sender-provided query parameters.

```groovy
import java.nio.charset.Charset

Message extractUrlGetParameters(Message message) {
    String httpQuery = message.getHeader('CamelHttpQuery', String)
    if (httpQuery) {
        Map<String, String> queryParameters = URLDecoder.decode(httpQuery, Charset.defaultCharset().name())
            .replace("\$", "")
            .tokenize('&')
            .collectEntries { it.tokenize('=') }
        message.setProperties(queryParameters)
    }
    return message
}
```

The `$` removal handles OData system query options (`$top`, `$skip`). Parameters are set as exchange properties for use in adapter configuration via `${property.top}`.

## Read URL Path Segments

Extract path segments from the inbound HTTP URL via the `CamelHttpUrl` header. Requires the HTTPS sender adapter endpoint to use a wildcard path (e.g., `/path/*`).

```groovy
def Message extractUrlPath(Message message) {
    def url = message.getHeaders().get("CamelHttpUrl")
    String[] vUrl = url.split('/')
    int size = vUrl.length

    message.setProperty("service", vUrl[size - 3])
    message.setProperty("resource", vUrl[size - 2])
    message.setProperty("id", vUrl[size - 1])
    return message
}
```

The split-from-end approach makes the script independent of the runtime host prefix. Configure the sender HTTPS adapter urlPath with trailing `/*` to capture path segments.

## Security Material (Secure Store)

Read credentials deployed as "Secure Parameter" artifacts in the tenant keystore via `ITApiFactory.getService(SecureStoreService)`. Common use case: injecting API keys as headers for outbound calls.

```groovy
import com.sap.it.api.ITApiFactory
import com.sap.it.api.securestore.SecureStoreService
import com.sap.it.api.securestore.UserCredential
import com.sap.it.api.securestore.exception.SecureStoreException

def Message accessSecurityMaterial(Message message) {
    def apikey_alias = message.getProperty("ApiKeyAlias")
    def secureStorageService = ITApiFactory.getService(SecureStoreService.class, null)
    try {
        def secureParameter = secureStorageService.getUserCredential(apikey_alias)
        def apikey = secureParameter.getPassword().toString()
        message.setHeader("api-key", apikey)
    } catch (Exception e) {
        throw new SecureStoreException("Secure Parameter not available")
    }
    return message
}
```

The alias name is typically passed via an externalized parameter (e.g., `{{ApiKey as Secure Parameter}}`). `getUserCredential` returns a `UserCredential` whose `getPassword()` returns the secret value.

## Value Mapping API

Look up value mappings deployed in the tenant via `ITApiFactory.getService(ValueMappingApi)`. Maps identifiers between agency/schema pairs (e.g., CompanyA ID to CompanyB ProductCode).

```groovy
import com.sap.it.api.ITApiFactory
import com.sap.it.api.mapping.ValueMappingApi

def Message readValueMapping(Message message) {
    def productId = message.getProperties().get("id")
    def valueMapApi = ITApiFactory.getService(ValueMappingApi.class, null)
    def productCode = valueMapApi.getMappedValue(
        'CompanyA', 'ID', productId,
        'CompanyB', 'ProductCode'
    )
    message.setProperty("productCode", productCode)
    return message
}
```

Signature: `getMappedValue(sourceAgency, sourceSchema, sourceValue, targetAgency, targetSchema)`. Returns null if no mapping is found; add null handling if the mapping is optional.

## Known Gotchas
- `messageLogFactory.getMessageLog()` returns null when MPL logging level is below "All events" -- always null-check
- `MappingContext` must be the last parameter in UDF signatures or the mapping framework will not inject it
- `CamelHttpQuery` is URL-encoded; decode before parsing to avoid broken parameter values
- `SecureStoreService.getUserCredential()` throws if the alias does not exist in the tenant; wrap in try/catch and throw a descriptive error
- Value mapping `getMappedValue` silently returns null for missing entries rather than throwing
