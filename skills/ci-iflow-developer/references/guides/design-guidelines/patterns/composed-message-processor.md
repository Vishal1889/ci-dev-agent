# Composed Message Processor

The Composed Message Processor pattern splits an incoming message into individual items, routes each item to the appropriate processing channel based on content, processes each item independently (e.g., enriching with external data), and then re-aggregates the results into a single output message. This is a compound pattern combining Splitter, Router, per-item Content Enricher, and Gather. Use it when different items within a single message require different processing logic (different external lookups, different transformation rules) but must be delivered as one consolidated result.

## Flow Structure

Sender (HTTPS) -> Start -> General Splitter (XPath on items, parallel=true) -> Router (content-based on Item/Category) -> [Route per category to Content Enricher step with external OData lookup] -> Gather (XPath merge on items) -> Message Mapping (cleanup) -> Content Modifier (monitoring) -> End -> Receiver (ProcessDirect)

Key structural elements:
- **General Splitter**: splits `/ns0:PurchaseOrder/Items/Item` with parallel processing (10 threads), streaming enabled, stop-on-exception true
- **Exclusive Gateway (Router)**: routes each split item by category (e.g., `Category = 'Notebooks'`, `Category = 'Software'`, default route)
- **Content Enricher steps**: each route calls an external OData receiver to look up category details (XML Lookup Aggregation enrichment type), keying original `Item/Category` against resource `Category`
- **Gather step**: recombines all enriched items using `xpath-merge-strategy` on `/ns0:PurchaseOrder/Items/Item`, same XML format
- **Message Mapping**: removes comparison fields added during enrichment

## Parameters

| Key | Purpose | Example |
|---|---|---|
| WebShopAddress | OData service URL for product category lookups | `https://...espm.svc` |

## Known Gotchas

- The Gather step must receive output from ALL router branches. If a route has no matching condition and no default, the Gather will hang waiting for missing branches. Always configure a default route.
- Parallel processing in the General Splitter combined with the Gather requires that the Gather's `sourceXPath` matches exactly what the splitter produces. Mismatched XPaths cause silent data loss in the merged output.
- Each Content Enricher step independently calls the external system. For high-cardinality splits (many items), this creates N external calls. Consider whether a single bulk lookup is more efficient.
- The enrichment type `xmlLookupAggregation` merges the lookup result into the original message node. The key elements (`originalMessageKeyElement`, `resourceMessageKeyElement`) must match exactly or enrichment silently produces empty results.
- The mapping step after Gather is important: Content Enricher adds comparison/key fields from the resource message that typically should not appear in the final output.
