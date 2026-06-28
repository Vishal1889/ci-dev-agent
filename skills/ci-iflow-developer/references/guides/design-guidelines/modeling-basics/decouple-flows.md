# Decouple Flows

Decoupling sender and receiver processing into separate integration flows improves resilience, allows independent scaling, and enables retry without re-triggering the sender. CPI provides four decoupling strategies with different persistence, reliability, and latency characteristics. All four variants share a common pattern: a "write" or "sender" process that receives the message and persists/forwards it, and a "read" or "receiver" process that picks up the message and processes it.

## Variant Matrix

| Variant | Persistence | Coupling | Delivery | Use Case |
|---------|------------|---------|----------|----------|
| JMS Queue | JMS message broker | Asynchronous | At-least-once with JMS guarantee | High-reliability async processing with built-in retry |
| Data Store | CPI Data Store (DB) | Asynchronous | Polling-based, at-least-once | Async processing without JMS license; longer retention |
| Polling Consumer | Data Store + Timer | Asynchronous | Explicit polling via HTTPS trigger or Timer | External system controls when to fetch; request-response possible |
| Without Persistence | ProcessDirect / SOAP | Synchronous | Exactly-once (no retry) | Low-latency, no persistence overhead; sender/receiver tightly coupled at runtime |

## Flow Structure

**JMS Queue**: 
- Write process: Sender (HTTPS) -> Start -> End -> JMSReceiver (JMS adapter, sends to queue)
- Read process: SenderJMS (JMS adapter, reads from queue) -> Start -> Groovy Script ("Wait for 1 minute") -> Content Modifier ("Fetch product ID") -> Request Reply to WebShop (OData) -> Content Modifier ("Define context") -> End -> Receiver (ProcessDirect)

**Data Store**:
- Write process: Sender (HTTPS) -> Start -> Write (Data Store operation) -> End
- Read process: SenderDS (Data Store Select operation, Timer-triggered) -> Start -> Groovy Script ("Wait for 1 minute") -> Content Modifier ("Fetch product ID") -> Request Reply to WebShop (OData) -> Content Modifier ("Define context") -> End -> Receiver (ProcessDirect)

**Polling Consumer**:
- Write process: Sender (HTTPS) -> Start -> Write data (Data Store Write) -> End
- Poll/Read process: Sender1 (HTTPS, triggered externally or by Timer) -> Start -> Read from Data Store -> Content Modifier ("Fetch product ID") -> Request Reply to WebShop (OData) -> Write data (Data Store to store result) -> End -> Receiver

**Without Persistence**:
- Sender process: Sender (HTTPS) -> Start -> End -> Receiver1 (SOAP, synchronous call to receiver process)
- Receiver process: Sender1 (SOAP) -> Start -> Groovy Script ("Wait for 1 minute") -> Content Modifier ("Fetch product ID") -> Request Reply to WebShop (OData) -> Content Modifier ("Define context") -> End -> Receiver (ProcessDirect)

## Parameters

| Key | Purpose | Example |
|-----|---------|---------|
| `address` | WebShop OData service URL | `https://refapp-espm-ui-cf.cfapps.eu10.hana.ondemand.com/espm-cloud-web/espm.svc` |
| `credentials` | Credential name (Without Persistence variant, SOAP) | `iFlowDesignGuidelineUser` |

## Known Gotchas
- The JMS variant requires a JMS message broker (Enterprise license). The Data Store variant works with all CPI editions but has higher latency.
- The "Wait for 1 minute" Groovy Script (`Thread.sleep(60000)`) is used only for demonstration to simulate slow receiver processing. Do not use `Thread.sleep` in production -- it blocks the worker thread.
- Data Store-based decoupling requires explicit cleanup of processed entries. The Select operation with Delete-on-Completion flag handles this automatically.
- The "Without Persistence" variant using SOAP/ProcessDirect provides no retry capability. If the receiver fails, the sender must retry the entire message.
- JMS queues have retention limits and dead-letter queue configuration that affect retry behavior.
