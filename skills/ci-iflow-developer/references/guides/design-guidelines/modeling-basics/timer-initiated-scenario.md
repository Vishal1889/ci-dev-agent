# Timer-Initiated Scenario

Timer-initiated scenarios run on a schedule without an external sender trigger. They are used for polling, batch processing, scheduled data synchronization, and periodic maintenance tasks. Two variants are shown: a simple timer that generates a message internally, and a timer that fetches data from an external source and sends it to a receiver.

## Variant Matrix

| Variant | External Data Source | Receiver | Use Case |
|---------|---------------------|----------|----------|
| Simple Timer | No | Data Store (internal) | Generate and store data on schedule |
| Timer with External Data Source and Receiver | Yes (WebShop OData) | ProcessDirect to external receiver | Periodic data fetch and forwarding |

## Flow Structure

**Simple Timer**: Start Timer -> Content Modifier ("Define message body" -- creates static or expression-based body) -> Write Data Store Entry -> End

**Timer with External Data Source and Receiver**: Start Timer -> Content Modifier ("Define message body") -> Content Modifier ("Define property" -- sets query parameters) -> Request Reply to WebShop (OData) -> End -> Receiver (ProcessDirect)

## Parameters

| Key | Purpose | Example |
|-----|---------|---------|
| `Address` | WebShop OData URL (external data source variant) | `https://refapp-espm-ui-cf.cfapps.eu10.hana.ondemand.com/espm-cloud-web/espm.svc` |

## Known Gotchas
- Timer-initiated flows have no sender, so there is no request message. The first Content Modifier must create the message body from scratch (using expressions or constants).
- The Timer start event configuration (schedule, run once, repeat interval) is set in the iFlow design. The `runOnce` option is useful for one-time initialization tasks.
- Timer flows cannot return responses to a caller. Use MPL status, Data Store entries, or external notifications for result reporting.
- If a timer-initiated flow fails, it will retry on the next scheduled execution. There is no built-in retry mechanism between scheduled runs unless you add explicit retry logic (e.g., JMS queue).
