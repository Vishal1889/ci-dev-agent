# Recipient List

The Recipient List pattern sends a message to multiple receivers, where the list of recipients is either statically configured or dynamically determined at runtime based on message content. SAP CPI implements this using Parallel Multicast (static) or message mapping-based receiver determination (dynamic). The dynamic variant optionally uses JMS queues to decouple the scatter from the per-recipient processing. Reference template `05-multicast-parallel-fanout.iflw` for the base multicast structure.

## Variant Matrix

| Variant | Recipient Determination | Delivery | Decoupling |
|---|---|---|---|
| Static Routing | Parallel Gateway (Multicast) with hardcoded routes | Synchronous parallel | None |
| Dynamic Routing | Message Mapping generates XI receiver-determination XML | Synchronous via ProcessDirect per supplier | None |
| Dynamic Routing Using JMS | Message Mapping generates recipient list, JMS queue decouples | Asynchronous via JMS queues | JMS queue per supplier process |

## Variant Details

### Static Routing
Flow: Sender (HTTPS) -> Start -> Parallel Gateway (Multicast) -> [Branch per receiver: End Event -> Receiver (ProcessDirect)]

- A `ParallelGateway` fans out the message to all configured branches simultaneously
- Each branch has its own Message End Event connected to a specific receiver participant
- Recipient list is fixed at design time; adding a receiver requires modifying the iFlow
- All receivers get the identical message

### Dynamic Routing
Flow: Sender (HTTPS) -> Start -> Message Mapping (build XI receiver determination XML) -> Content Modifier (set monitoring context) -> End -> [Per-supplier Local Integration Processes with ProcessDirect adapters]

- A message mapping creates an XI-format receiver determination structure (`<ns2:Receivers>` with `<Receiver>` elements containing `<Service>` and `<Interface>`) that the runtime evaluates to determine which ProcessDirect endpoints to call
- Each potential supplier has its own Local Integration Process receiving via ProcessDirect
- The supplier list is determined at runtime by the mapping logic based on message content (e.g., which product categories are present)
- Uses namespace `xmlns:ns2=http://sap.com/xi/XI/System` for receiver determination

### Dynamic Routing Using JMS
Flow: Sender (HTTPS) -> Start -> Message Mapping (build recipient list) -> Content Modifier -> End -> JMS queue | JMS Sender per supplier -> Supplier Local Integration Process -> End -> Supplier Receiver

- Same dynamic determination as above, but the message is written to a JMS queue instead of synchronous ProcessDirect
- A separate JMS consumer integration process per supplier reads from the queue and forwards to the actual receiver
- Provides asynchronous decoupling: the sender iFlow completes as soon as the message is written to JMS, regardless of supplier processing time
- Enables retry at the per-supplier level: if one supplier fails, only that supplier's JMS consumer retries

## Known Gotchas

- **Static routing** requires iFlow redeployment to add or remove recipients. For frequently changing recipient lists, use dynamic routing.
- **Dynamic routing with XI receiver determination**: the mapping must produce valid XI receiver determination XML. The `<Service>` value must exactly match the receiver system name configured in the iFlow participants. A typo causes silent routing failure.
- **JMS variant**: each JMS queue consumes tenant JMS resources. For a large number of dynamic recipients, the JMS queue count can exceed tenant limits. Monitor queue usage.
- **Parallel Multicast** sends the SAME message to all receivers. If different receivers need different message formats, add a mapping step in each branch after the multicast.
- **Error handling in static multicast**: if one branch fails, the behavior depends on the iFlow's error handling configuration. By default, a failure in any branch fails the entire message. Use Exception Subprocesses per branch if independent error handling is needed.
