# Content Enricher

The Content Enricher pattern augments an incoming message with additional data retrieved from an external system. In SAP CPI, this is implemented using the Content Enricher flow step (Poll Enrich variant), which performs an external lookup and merges the response data into the original message using key-based correlation. The enrichment happens inline: the step takes the original message, calls an external receiver adapter, and joins the result back based on matching key fields. After enrichment, a message mapping typically removes the temporary comparison fields that were added during the merge. Reference template `09-poll-enrich.iflw` for the base structure.

## Flow Structure

Structural base: template `09-poll-enrich.iflw`. Customizations:
- Content Enricher step uses `xmlLookupAggregation` enrichment type with OData receiver adapter
- Message Mapping step follows to clean up comparison fields

Sender (HTTPS) -> Start -> Content Enricher (OData lookup) -> Message Mapping (remove comparison field) -> Content Modifier (monitoring) -> End -> Receiver (ProcessDirect)

The Content Enricher step (`contentEnricherWithLookup` activity type) is a service task connected to an external receiver participant. The receiver adapter (OData V2 in this example) fetches the lookup data. The step merges results based on:
- `originalMessageNodePath`: where in the original message to enrich (e.g., `PurchaseOrder/Items`)
- `originalMessageKeyElement`: the key field in the original message (e.g., `Item/Category`)
- `resourceMessageNodePath`: the root node of the lookup response (e.g., `ProductCategory`)
- `resourceMessageKeyElement`: the key field in the lookup response (e.g., `Category`)

## Parameters

| Key | Purpose | Example |
|---|---|---|
| WebShopAddress | External OData service URL for lookups | `https://...espm.svc` |

## Known Gotchas

- The Content Enricher step adds ALL fields from the resource message into the original message node. If the lookup returns fields you do not want in the output, you must add a mapping step afterward to strip them.
- Key field matching is exact string comparison. If the original message has `Category = "Notebooks"` but the lookup returns `Category = "notebooks"`, no match occurs and no enrichment happens, with no error raised.
- The Content Enricher step is a synchronous Request-Reply pattern under the hood. If the external system is slow or unavailable, the entire iFlow processing blocks. Configure appropriate `receiveTimeOut` on the receiver adapter.
- When using `xmlLookupAggregation`, the original and resource messages must both be XML. For non-XML payloads, use a Groovy script enrichment approach instead.
- The enrichment merges at the node level specified by `originalMessageNodePath`. If you specify the wrong path, fields get inserted at the wrong hierarchy level, producing structurally valid but semantically wrong XML.
