# Message Splitter

The Message Splitter pattern breaks a single composite message into individual messages, each processed independently. SAP CPI provides three splitter types with different trade-offs in streaming support, parallel processing, and output structure. Use General Splitter for XPath-based splits with parallel processing and Gather support. Use Iterating Splitter for simpler sequential processing without Gather. Use Message Mapping when the split logic requires structural transformation or when you need to create output messages with a different schema than the input nodes. Reference template `06-splitter-lip-process-call.iflw` for the base splitter + local integration process structure.

## Variant Matrix

| Variant | Splitter Type | Parallel | Streaming | Gather Support | Output Structure |
|---|---|---|---|---|---|
| General Splitter | `GeneralSplitter` | Yes (configurable threads) | Yes | Yes | Each split message contains only the matched XPath node |
| Iterating Splitter | `IteratingSplitter` | No | Yes | No | Each split message is the complete parent with one child element |
| Message Mapping | `MappingSplitter` | No | No | No | Each split message has the structure defined by the target mapping |

## Variant Details

### General Splitter
Flow: Sender (HTTPS) -> Start -> General Splitter -> Content Modifier (monitoring) -> End -> Receiver (ProcessDirect)

Configuration:
- `splitExprValue`: XPath expression defining split points (e.g., `/ns0:PurchaseOrder/Items/Item`)
- `ParallelProcessing`: `true` for concurrent processing of split messages
- `SplitterThreads`: number of parallel threads (e.g., 10)
- `Streaming`: `true` for memory-efficient processing of large messages
- `StopOnExecution` (stop on exception): `true` to halt on first error
- `grouping`: number of items per split message (1 = one item per message)
- `timeOut`: timeout in seconds for parallel processing (e.g., 300)

### Iterating Splitter
Flow: Sender (HTTPS) -> Start -> Iterating Splitter -> Content Modifier (monitoring) -> End -> Receiver (ProcessDirect)

Configuration:
- `splitExprValue`: XPath expression (e.g., `/ns0:PurchaseOrder/Items/Item`)
- `Streaming`: `true`
- `StopOnExecution`: `true`
- Always sequential processing; no parallel threads or timeout configuration

### Message Mapping
Flow: Sender (HTTPS) -> Start -> Message Mapping (split) -> Content Modifier (monitoring) -> End -> Receiver (ProcessDirect)

The message mapping is configured with `mappingType=MessageMapping` and produces multiple output messages. The mapping definition controls which fields from the source appear in each split output and can restructure the output schema entirely.

## Known Gotchas

- **General Splitter with parallel processing**: the order of split messages is NOT guaranteed. If downstream processing is order-sensitive, set `ParallelProcessing=false` or use the Iterating Splitter.
- **General Splitter output**: each split message contains ONLY the matched XPath node (e.g., a single `<Item>` element), not the parent document structure. If the receiver expects the full document with one item, you need a Content Modifier or mapping to re-wrap.
- **Iterating Splitter output**: preserves the parent document structure and includes one child element per split. This means each split message is larger but structurally complete.
- **Streaming**: when enabled, the splitter does not load the entire message into memory. This is essential for large messages (>100MB) but incompatible with steps that require random access to the full message before the split.
- **Gather compatibility**: only the General Splitter supports a downstream Gather step. If you need to recombine split messages after per-item processing, you must use General Splitter (as in the Composed Message Processor pattern).
- **Message Mapping splitter**: the most flexible but also the slowest option since it requires full XML parsing and mapping execution per output message.
