# Content-Based Routing

Content-Based Routing directs a message to different receivers based on message content. An Exclusive Gateway (Router) evaluates conditions against message properties or payload fields and forwards the message down the matching route. The critical design decision is how to handle the no-match case: when no route condition is satisfied. SAP CPI provides three strategies, each with different operational trade-offs. All three variants share the same core flow structure but differ in default-route behavior. Reference template `04-router-conditional-branching.iflw` for the base router structure.

## Flow Structure

Structural base: template `04-router-conditional-branching.iflw`. Customizations:
- Content Modifier before router extracts the routing field into a property (e.g., `shippingCountry` via XPath)
- Content Modifier after router sets monitoring context headers (`context`, `receiver`)
- Multiple Message End Events, each connected to a different receiver participant

Core flow: Sender (HTTPS) -> Start -> Content Modifier (extract routing property) -> Content Modifier (set monitoring context) -> Exclusive Gateway -> [Route per condition to End Event -> Receiver]

## Variant Matrix

| Variant | No-Match Behavior | Default Route Target | Error Handling |
|---|---|---|---|
| Ignore If No Receiver | Message silently discarded | Terminate End Event (no message end) | None; message disappears from monitoring with status Completed |
| Raise Error | Escalation via Error End Event + Exception Subprocess | Error End Event triggers exception subprocess | Exception subprocess classifies error (no-receiver vs other), routes to alerting receiver via local integration processes |
| Send To Default | Message forwarded to a fallback receiver | Default route sends to Germany receiver with context "Default route" | None; message always reaches some receiver |

## Variant Details

### Ignore If No Receiver
- The default route on the Exclusive Gateway targets a plain End Event (not a Message End Event), so no outbound message is generated
- The message completes successfully in monitoring but produces no output
- Route conditions use NonXML expression type with `${property.shippingCountry} = 'NL'` or `'DE'`

### Raise Error
- The default route targets an Error End Event, which raises an exception caught by an Exception Subprocess
- The Exception Subprocess contains a Router that classifies the error by checking `${property.SAP_ErrorModelStepID}` against the Error End Event's step ID
- Two Local Integration Processes handle the error: "No Receiver found Error" and "Any other error", each creating appropriate error payloads
- The exception subprocess sends the error payload to an Alerting receiver
- This is the most operationally robust variant: failures are visible and actionable

### Send To Default
- The default route on the Exclusive Gateway leads to a Content Modifier that sets receiver="Default route", then a Message End Event connected to the Germany (fallback) receiver
- Every message is guaranteed to reach a receiver, preventing silent data loss
- Only one explicit condition route (NL) vs default (everything else goes to Germany)

## Known Gotchas

- The "Ignore" variant is dangerous in production: messages that match no route vanish silently. Use only when message loss is acceptable (e.g., filtering out irrelevant messages).
- In the "Raise Error" variant, the `SAP_ErrorModelStepID` property contains the step ID of the element that threw the error. The condition in the exception subprocess must reference the exact step ID of the Error End Event, which is auto-generated. If you copy the iFlow and step IDs change, the error classification breaks silently, routing all errors to "any other error".
- Route conditions using `NonXML` expression type evaluate against exchange properties (`${property.X}`), while `XML` expression type evaluates against the message body. Mixing them up produces no error but routes incorrectly.
- The `throwException` property on the Exclusive Gateway is `false` in all variants. Setting it to `true` would throw an exception on no match instead of using the default route, which conflicts with the Ignore and Send-To-Default strategies.
