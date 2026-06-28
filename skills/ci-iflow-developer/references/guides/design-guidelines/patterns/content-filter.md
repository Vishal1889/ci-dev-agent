# Content Filter

The Content Filter pattern removes unwanted data from a message, reducing it to only the fields or elements needed by the downstream consumer. SAP CPI offers two approaches: using the built-in Filter flow step with XPath, or using a Message Mapping to select only desired fields. Both produce the same result (a reduced message) but differ in flexibility and maintenance characteristics. Use the Filter step for simple node extraction; use Message Mapping when you need field-level selection, renaming, or structural transformation during the reduction.

## Variant Matrix

| Variant | Mechanism | Best For |
|---|---|---|
| Filter Step | XPath expression extracts a subtree from the message | Extracting a specific repeating node or subtree without structural changes |
| Message Mapping | Mapping definition selects and maps only desired fields | Field-level filtering, renaming, restructuring, or combining filter with transformation |

## Variant Details

### Filter Step
Flow: Sender (HTTPS) -> Start -> Filter (XPath) -> Combine all pieces -> Keep order header -> End -> Receiver (ProcessDirect)

The Filter step (`activityType=Filter`) uses an XPath expression (`wrapContent` property) to select a specific node from the message. Only the matched subtree is retained; everything else is discarded. The result may need additional steps to reconstruct the surrounding document structure. In the example, after filtering for item nodes, additional Content Modifier steps reconstruct the full order document by re-adding the header.

### Message Mapping
Flow: Sender (HTTPS) -> Start -> Message Mapping -> Content Modifier (monitoring) -> End -> Receiver (ProcessDirect)

A message mapping definition explicitly maps only the desired source fields to the target structure. Unmapped fields are automatically excluded. This approach provides fine-grained control: you can filter at the field level, rename elements, apply functions, and restructure the output simultaneously.

## Groovy Script Patterns

Both variants include the same generic logging utility (attaches payload as monitoring attachment):

```groovy
def label = message.getProperties().get("label") ?: "payload"
def body = message.getBody(java.lang.String) as String
messageLogFactory.getMessageLog(message).addAttachmentAsString(label, body, "text/plain")
```

## Known Gotchas

- The Filter step returns only the matched node(s). If the XPath matches multiple nodes, they are returned as a multimap-wrapped collection. You need a subsequent step to handle the wrapper if you expect a single document.
- The Filter step's XPath must match at least one node or the step produces an empty body, which may cause downstream failures without a clear error message.
- Message Mapping is more maintainable when the source schema changes frequently: you only need to update the mapping, not reconstruct document fragments with Content Modifiers.
- Filter step is significantly more performant than Message Mapping for large messages when you only need a subtree extraction, since it avoids full XML parsing and mapping overhead.
