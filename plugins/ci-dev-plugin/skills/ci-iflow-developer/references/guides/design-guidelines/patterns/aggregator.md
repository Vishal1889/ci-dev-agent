# Aggregator

The Aggregator pattern collects individual related messages into a single combined message before forwarding them. It is required when multiple messages share a correlation key (e.g., the same purchase order number) and must be consolidated before further processing. The Aggregator step uses a data store to persist partial aggregates across multiple message deliveries. Messages are correlated using an XPath expression, and a last-message condition (also XPath) determines when the aggregate is complete. If the last-message condition is not met within the configured timeout (minutes), the aggregate is released with whatever messages have arrived. After aggregation, the output is wrapped in a multimap envelope that typically needs unwrapping via a Filter step or message mapping before sending downstream.

## Flow Structure

Sender (HTTPS) -> Start -> Aggregator -> Message Mapping (items to order) -> Filter (remove multimap wrapper) -> Content Modifier (monitoring context) -> End -> Receiver (ProcessDirect)

The flow is linear. The Aggregator step sits immediately after the start event and collects inbound messages. The subsequent mapping transforms the aggregated multimap structure into the target format. A Filter step with XPath extracts the merged document from the multimap wrapper.

## Groovy Script Patterns

The included script is a generic logging utility that attaches the message body as a text attachment for monitoring:

```groovy
def label = message.getProperties().get("label") ?: "payload"
def body = message.getBody(java.lang.String) as String
messageLogFactory.getMessageLog(message).addAttachmentAsString(label, body, "text/plain")
```

Use this pattern when you need payload visibility in the message monitor without modifying the message body.

## Key Configuration

| Property | Value | Purpose |
|---|---|---|
| aggregationAlgorithm | `sap-id-list` | Combines messages into multimap using SAP ID list strategy |
| correlationExpression | `//@PurchaseOrderNumber` | XPath to correlate related messages |
| lastMessageCondition | `ns0:Item/LastMessageIndicator='X'` | XPath condition signaling the final message in the aggregate |
| incomingFormat | `XML_SAME_FORMAT` | All incoming messages share the same XML schema |
| datastoreName | `Aggregator-EIP` | Persistence store for in-progress aggregates |
| timeout | `2` | Minutes to wait before releasing incomplete aggregate |

## Known Gotchas

- The Aggregator requires `transactionalHandling=Required` on the integration process to ensure data store consistency. Without it, partial aggregates can be lost on node failover.
- The output is always wrapped in a multimap envelope (`<multimap:Messages>`). You must add a Filter step or mapping to extract the actual document, or downstream processing will fail on unexpected root elements.
- The `lastMessageCondition` is evaluated per-message. If no message ever satisfies it, the aggregate is only released on timeout, which may cause unexpected delays.
- The `datastoreName` must be unique per aggregation scenario on the tenant. Reusing names across iFlows causes cross-contamination of aggregates.
- Namespace mappings (e.g., `xmlns:ns0=...`) must be declared at the iFlow collaboration level for XPath expressions in correlationExpression and lastMessageCondition to resolve.
