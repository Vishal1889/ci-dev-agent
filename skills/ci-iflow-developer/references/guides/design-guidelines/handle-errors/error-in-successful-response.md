# Error in Successful Response

Some backend systems return HTTP 200 responses that contain error information embedded in the response payload (e.g., error log records in an XML wrapper). This pattern detects such embedded errors by checking the response XML structure with an XPath condition in a Router, then branches to either normal processing or error handling. The iFlow uses a two-process architecture: a main Integration Process that handles the routing logic, and a second Integration Process that simulates the WebShop with modified responses containing log records.

## Flow Structure

**Main Integration Process** (Handle errors in successful response):
Sender (HTTPS at `/HandleErrors/ErrorInSuccessfulResponse`) -> Start -> Request Reply to MockedWebShop (ProcessDirect) -> Router ("Any error log?"):
- **Yes** (XPath: `/Products/Log/Record/Severity = 'Error'`): Filter (XPath String: `/Products/Log/Record/Message`) -> Groovy Script (attach error info to MPL) -> Error End Event
- **No** (default): Filter (XPath Node: `/Products/Product`) -> End (MessageEndEvent)

**Simulating Integration Process** (web shop with modified response):
Sender1 (ProcessDirect at `/HandleErrors/ErrorInSuccessfulResponse/MockedWebShop`) -> Start -> Request Reply to WebShop (OData, query products by `${header.productId}`) -> Router ("Product exist?"):
- **Yes** (XPath: `boolean(//Product)`): Content Modifier (build XML with Product node + Info/Warning log records) -> End
- **No** (default): Content Modifier (build XML with Error log record, message = "product does not exist") -> End

## Groovy Script Patterns

The `payloadlogger.groovy` script attaches the error message body to the MPL as an attachment for diagnostic visibility:
```groovy
def messageLog = messageLogFactory.getMessageLog(message)
if (messageLog != null) {
    messageLog.addAttachmentAsString('Additional information', body, 'text/plain')
}
```

## Parameters

| Key | Purpose | Example |
|-----|---------|---------|
| `address` | WebShop OData service URL | `https://refapp-espm-ui-cf.cfapps.eu10.hana.ondemand.com/espm-cloud-web/espm.svc` |

## Known Gotchas
- The XPath condition `/Products/Log/Record/Severity = 'Error'` checks for the literal string `Error` in the Severity element. If the backend uses different casing or error codes, the condition must be adapted.
- The Filter step on the error path uses XPath String type (not Node), which extracts just the text content of the Message element -- suitable for logging but loses XML structure.
- The Error End Event on the error path causes the MPL to show FAILED status, which is the desired behavior to flag that an embedded error was detected even though the HTTP call itself succeeded.
