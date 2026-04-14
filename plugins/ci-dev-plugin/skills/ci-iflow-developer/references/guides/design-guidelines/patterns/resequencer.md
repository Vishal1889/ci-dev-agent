# Resequencer

The Resequencer pattern reassembles messages that arrive out of order into the correct sequence before forwarding them. In SAP CPI, this is implemented by combining a General Splitter (to separate incoming items), an Aggregator step with the `sap-sequenced-id-list` algorithm (which enforces sequence ordering), and a Filter step to unwrap the multimap output. The Aggregator's sequence expression determines the correct order, while the correlation expression groups related messages. Messages are held in a data store until either all expected messages arrive in order or the timeout expires.

## Flow Structure

Sender (HTTPS) -> Start -> General Splitter -> Aggregator (sequenced) -> Filter (remove multimap wrapper) -> Content Modifier (monitoring) -> End -> Receiver (ProcessDirect)

Key difference from the basic Aggregator pattern: the Aggregator here uses `aggregationAlgorithm=sap-sequenced-id-list` instead of `sap-id-list`, and specifies a `messageSequenceExpression` that defines the ordering criterion.

## Key Configuration

| Property | Value | Purpose |
|---|---|---|
| aggregationAlgorithm | `sap-sequenced-id-list` | Enforces sequence ordering during aggregation |
| correlationExpression | `//@PurchaseOrderNumber` | Groups related messages |
| messageSequenceExpression | `//@ItemNumber` | Defines the sequence order within correlated messages |
| lastMessageCondition | `0` | No explicit last-message indicator; relies on timeout |
| datastoreName | `Aggregator-Resequencer` | Persistence store name (must be unique per scenario) |
| timeout | `2` | Minutes to wait for missing sequence numbers |
| incomingFormat | `XML_SAME_FORMAT` | All messages share the same XML schema |

## Known Gotchas

- The `sap-sequenced-id-list` algorithm holds messages until the complete sequence is available OR the timeout expires. If sequence numbers have gaps (e.g., message 3 never arrives), the aggregate is released on timeout with the gap, potentially producing an incomplete result.
- `lastMessageCondition=0` means there is no explicit last-message signal. The Aggregator relies entirely on the timeout to determine when the sequence is complete. This adds latency equal to the timeout value for every message group.
- The General Splitter before the Aggregator is required when the incoming message contains multiple items that need individual resequencing. If messages already arrive as individual items, the splitter is unnecessary.
- The `datastoreName` must be unique. If another iFlow uses the same data store name with a different aggregation algorithm, data corruption occurs.
- Sequence numbers must be monotonically increasing integers or strings that sort correctly. Non-numeric sequence expressions may produce unexpected ordering.
