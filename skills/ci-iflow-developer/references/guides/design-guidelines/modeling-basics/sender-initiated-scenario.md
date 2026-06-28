# Sender-Initiated Scenario with External Data Source and Receiver

This pattern demonstrates a sender-initiated (synchronous, request-response) integration scenario where the sender triggers the flow via HTTPS, the flow enriches the message by fetching data from an external system (WebShop OData), and returns the result to the sender. This is the fundamental building block for synchronous API-style integrations.

## Flow Structure

Sender (HTTPS) -> Start -> Content Modifier ("Define property" -- stores request parameters) -> JSON to XML Converter -> Request Reply to WebShop (OData, queries product data using property values) -> End -> Receiver (ProcessDirect)

The flow receives a JSON request from the sender, converts it to XML for the OData call, fetches product data from the external WebShop, and returns the result.

## Parameters

| Key | Purpose | Example |
|-----|---------|---------|
| `Address` | WebShop OData service URL | `https://refapp-espm-ui-cf.cfapps.eu10.hana.ondemand.com/espm-cloud-web/espm.svc` |

## Known Gotchas
- In a sender-initiated scenario, the sender waits for the response. Long-running external calls may cause timeouts. Configure the HTTPS sender adapter's timeout and the OData receiver adapter's timeout appropriately.
- The `returnExceptionToSender` iFlow property controls whether exceptions are returned as HTTP error responses to the sender or handled silently. Set to `true` for API scenarios where the caller needs error details.
