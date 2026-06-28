# Message Filter

The Message Filter pattern uses a Router (Exclusive Gateway) to evaluate a condition on the incoming message and either forward it to a receiver or discard it entirely. Unlike Content-Based Routing (which routes to different receivers), Message Filter has a binary outcome: the message either passes through to the single receiver or is silently dropped. Use this when you need to suppress messages that do not meet certain criteria before they reach a backend system.

## Flow Structure

Structural base: template `04-router-conditional-branching.iflw` (simplified to two routes). Customizations:
- Only two routes: pass-through and discard
- Content Modifier extracts the filter field into a property

Sender (HTTPS) -> Start -> Content Modifier (extract filter property, e.g., `productCategory` via XPath) -> Content Modifier (set monitoring context) -> Exclusive Gateway ("Filter") -> [Route to Inventory: condition match] -> End (Message End Event) -> Receiver | [Discard: default route] -> End (Terminate End Event)

The "Route to Inventory system" condition checks `${property.productCategory} = 'Notebooks'` (NonXML expression type). Messages matching the condition proceed to the receiver. The default route targets a plain End Event (not Message End Event), which terminates processing without producing output.

## Known Gotchas

- The discard route uses a Terminate End Event, meaning no output message is generated and no error is raised. The message appears as "Completed" in monitoring regardless of whether it was forwarded or discarded. Add a Content Modifier on the discard branch to set a custom header or log entry if you need to distinguish filtered-out messages in monitoring.
- Message Filter is functionally identical to Content-Based Routing "Ignore If No Receiver" with a single route. The pattern name clarifies intent: filtering is about suppression, routing is about direction.
- The filter condition is evaluated against exchange properties (NonXML expression type), not the message body. The Content Modifier before the router must extract the relevant field into a property first.
