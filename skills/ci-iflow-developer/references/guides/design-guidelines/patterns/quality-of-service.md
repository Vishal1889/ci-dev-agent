# Quality of Service

Quality of Service (QoS) in SAP CPI governs delivery guarantees for messages. The right QoS level depends on whether the sender retries, whether the receiver is idempotent, and whether message ordering matters. Choosing incorrectly causes either duplicate processing (if you assume idempotency that doesn't exist) or message loss (if you assume retry that doesn't happen). The scenarios below systematically cover the combinations of sender retry capability, receiver idempotency, JMS-based decoupling, and splitter interactions. Reference template `10-idempotent-looping-process-call.iflw` for the idempotent process call pattern used in several scenarios.

## QoS Levels

| Level | Guarantee | Mechanism |
|---|---|---|
| Best Effort | No guarantee; message may be lost or duplicated | No persistence, no retry |
| At-Least-Once (ALO) | Message delivered at least once; duplicates possible | Sender retry + persisted processing |
| Exactly-Once (EO) | Message delivered exactly once | Idempotent receiver or duplicate detection via data store |
| Exactly-Once In-Order (EOIO) | EO + strict sequence preservation | JMS exclusive queues with JMSXGroupID |

## Scenario Matrix

| Scenario | Description | Sender | Receiver | JMS? | Idempotent? | Key Feature |
|---|---|---|---|---|---|---|
| 01 | Sender retry + idempotent receiver (SAP RM) | SOAP (SAP RM) | SOAP (SAP RM) | No | Receiver-side | Simplest EO: rely on receiver's built-in idempotency |
| 01a | Sender retry + idempotent IDoc receiver | SOAP (SAP RM) | IDoc | No | Receiver-side | IDoc adapter handles duplicate suppression |
| 01b | Sender retry + idempotent XI receiver | SOAP (SAP RM) | XI | No | Receiver-side | XI QualityOfService property enables EO |
| 02 | Sender retry + idempotent receiver based on payload | SOAP (SAP RM) | SOAP (SAP RM) | No | Payload-based | Duplicate detection using payload content hash instead of message ID |
| 02a | Payload-based idempotent IDoc receiver | SOAP (SAP RM) | IDoc | No | Payload-based | IDoc with payload-based dedup |
| 02b | Payload-based idempotent XI receiver | SOAP (SAP RM) | XI | No | Payload-based | XI with payload-based dedup |
| 03 | Retry via JMS with SAP RM receiver | SOAP | SOAP (SAP RM) | Yes | Receiver-side | JMS queue decouples sender from receiver; retry on JMS consumer |
| 03a | Retry via data store (alternative to JMS) | SOAP | SOAP (SAP RM) | No (DataStore) | Receiver-side | Data Store-based retry instead of JMS |
| 03b | Retry via JMS with IDoc receiver | SOAP | IDoc | Yes | Receiver-side | JMS-decoupled with IDoc receiver |
| 03c | Retry via JMS with XI receiver | SOAP | XI | Yes | Receiver-side | JMS-decoupled with XI receiver |
| 04 | Sender retry + splitter + idempotent receiver | SOAP (SAP RM) | SOAP (SAP RM) | No | Receiver-side | Splitter before delivery; each split handled idempotently |
| 04a | AS2 sender + idempotent receiver | AS2 | SOAP (SAP RM) | No | Receiver-side | AS2 sender with QualityOfService property |
| 04b | Sender retry + splitter + multiple receivers | SOAP (SAP RM) | SOAP (SAP RM) | No | Receiver-side | Split to multiple receiver endpoints (e.g., Hardware, Software) |
| 05 | XI sender + non-idempotent receiver | SOAP (XI) | DataStore | No | CPI-side | `QualityOfService_inbound=RealExactlyOnce`; CPI handles dedup via data store |
| 05a | Idempotent local integration process at receiver | SOAP | SOAP (SAP RM) | No | LIP-based | Local Integration Process with idempotent process call wraps receiver |
| 06 | Side effects with JMS retry | SOAP | SOAP (SAP RM) | Yes | Receiver-side | JMS decoupling when processing has side effects (e.g., database writes) |
| 06a | Idempotent LIP for side effects | SOAP | SOAP (SAP RM) | No | LIP-based | Idempotent Local Integration Process prevents duplicate side effects |
| 07 | Idempotent LIP to avoid duplicates in aggregates | SOAP (SAP RM) | SOAP (SAP RM) | No | LIP-based | Idempotent process call before Aggregator prevents duplicate items |

## Scenario Details

### Scenarios 01/01a/01b: Sender Retry + Idempotent Receiver
The sender (SOAP with SAP RM protocol) automatically retries on failure. The receiver is natively idempotent: SAP RM receivers deduplicate by message ID, IDoc adapters suppress duplicates, and XI adapters use the QualityOfService property. This is the simplest EO pattern because both endpoints handle their part. No CPI-level duplicate detection is needed. Sub-variants differ only in the receiver adapter type (SAP RM, IDoc, XI).

### Scenarios 02/02a/02b: Payload-Based Idempotency
Same as 01 variants, but duplicate detection is based on a hash of the message payload rather than the sender-assigned message ID. Use this when the sender does not assign stable message IDs across retries (i.e., each retry generates a new ID). The receiver or CPI must compute a content-based fingerprint to detect duplicates.

### Scenarios 03/03a/03b/03c: JMS or DataStore Retry Decoupling
When the sender does not natively retry (plain SOAP/HTTP without SAP RM), CPI must provide retry. Two approaches:
- **JMS (03, 03b, 03c)**: the inbound process writes to a JMS queue immediately (fast sender response). A separate JMS consumer process reads from the queue with automatic retry on failure. Two integration processes: "write to JMS queue" and "read from JMS queue".
- **DataStore (03a)**: uses a Data Store instead of JMS for persistence. The inbound process writes to a data store; a polling process reads and retries.

Sub-variants differ in receiver adapter: SAP RM (03), IDoc (03b), XI (03c).

### Scenarios 04/04a/04b: Splitter + Idempotent Receiver
When the incoming message must be split before delivery, each split message is delivered independently. The sender retries the entire original message, so CPI must ensure each split item is idempotently handled at the receiver. Scenario 04a uses AS2 sender instead of SOAP. Scenario 04b routes split items to different receivers based on content (e.g., Hardware vs Software categories).

### Scenario 05/05a: XI Sender / Non-Idempotent Receiver
When the receiver is NOT idempotent, CPI must perform duplicate detection. Scenario 05 uses `QualityOfService_inbound=RealExactlyOnce` with a DataStore-based receiver, where CPI's runtime handles dedup using the XI message ID. Scenario 05a wraps the receiver call in an idempotent Local Integration Process (LIP) that checks a data store for the message ID before processing.

### Scenarios 06/06a: Side Effects
When message processing has side effects (database writes, external API calls), JMS retry (06) or idempotent LIP (06a) prevents duplicate side effects. The idempotent LIP pattern (06a) wraps the entire processing logic in a Local Integration Process that first checks whether the message ID was already processed.

### Scenario 07: Aggregator Deduplication
When messages feed into an Aggregator, duplicate input messages would produce duplicate items in the aggregate. An idempotent LIP before the Aggregator step checks the message ID and discards duplicates before they enter the aggregation.

## EOIO Patterns

EOIO extends Exactly-Once with strict message ordering. Three EOIO artifacts cover the end-to-end pattern:

### EOIO in General
Two integration processes connected via JMS:
- **JMS Provider flow**: receives messages and writes to a JMS queue with `JMSXGroupID` header set from the message content. Messages with the same group ID are processed in order.
- **JMS Consumer flow**: reads from the JMS queue with exclusive access, ensuring ordered consumption. Uses `maxConcurrentConsumers=1` to prevent parallel consumption that would break ordering.

### EOIO SAP RM to XI
Sender uses SAP RM protocol (which supports QoS headers). The JMS Provider flow extracts the sequence ID from SAP RM headers and sets `JMSXGroupID`. The JMS Consumer flow delivers via XI adapter with `XI_EOIO` message protocol, which propagates the ordering guarantee to the XI receiver.

### EOIO XI to SAP RM
Sender uses XI protocol with `SapQualityOfService` and `SapQueueId` headers. The JMS Provider flow extracts these XI-specific headers to set `JMSXGroupID`. The JMS Consumer flow delivers via SOAP adapter with SAP RM protocol, preserving order.

Key EOIO properties:
- `JMSXGroupID`: JMS header that groups messages for ordered delivery
- Exclusive JMS queue consumption: `maxConcurrentConsumers=1`
- Allowed headers must include: `SapMessageIdEx`, `SapQualityOfService`, `SapQueueId`, `SapSender*`, `SapReceiver*`, `SapInterface*`

## Known Gotchas

- **Scenario 01 trap**: relying on receiver idempotency only works if the sender sends the SAME message ID on retry. If the sender generates a new ID per attempt, the receiver sees each retry as a new message. Use Scenario 02 (payload-based) in that case.
- **JMS queue limits**: each JMS-based scenario consumes tenant JMS queue capacity. CPI tenants have a finite number of JMS queues. Plan queue usage across all iFlows.
- **JMS retry count**: by default, JMS retry is infinite. Configure a dead-letter queue or max retry count to prevent poison messages from blocking the queue forever.
- **EOIO performance**: `maxConcurrentConsumers=1` means strictly serial processing. Throughput is limited to one message at a time per queue. If you need parallelism across different message groups, use separate JMS queues per group ID prefix.
- **DataStore vs JMS**: DataStore-based retry (03a) polls at intervals, introducing latency. JMS-based retry (03) is event-driven and lower-latency. Prefer JMS unless queue limits are a concern.
- **Idempotent LIP**: the idempotent Local Integration Process pattern (05a, 06a, 07) stores processed message IDs in a data store with a configurable expiration. If the expiration is too short, late retries will be processed as new messages. If too long, the data store grows unbounded.
- **Splitter + EO**: when a splitter produces N messages from one input, each split message gets a derived message ID. Ensure the idempotent receiver checks the derived ID (not the original) to detect duplicates at the split-message level.
- **XI QualityOfService_inbound=RealExactlyOnce**: this property is specific to XI/SOAP sender adapters. Setting it on other adapter types has no effect. The runtime uses the XI message ID (`SapMessageIdEx`) for dedup.
