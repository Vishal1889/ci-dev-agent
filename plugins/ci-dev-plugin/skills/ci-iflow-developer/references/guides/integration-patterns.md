### Common Integration Patterns

**Intermediate Request-Reply (data enrichment mid-flow):**
When the iFlow needs to call an external system mid-flow (e.g., fetch data from a REST API before processing), use a Request-Reply step connected to a receiver participant:
- The Request-Reply step (`serviceTask` with `activityType=ExternalCall`) calls the external system and replaces the message body with the response.
- Wire the Request-Reply step BETWEEN other processing steps in the sequence flow — it is NOT the final step.
- After the Request-Reply, subsequent steps (Splitter, Router, Content Modifier, etc.) process the response.
- The receiver participant for this intermediate call needs its own messageFlow with adapter configuration, just like a final receiver.
- If the intermediate response is JSON but subsequent steps need XML, add a JSON-to-XML Converter AFTER the Request-Reply.

**Content-based Router with multiple receivers:**
When routing messages to different receivers based on content:
- Router is a `bpmn2:exclusiveGateway` in BPMN (NOT a `callActivity`). It has multiple outgoing sequence flows, each with a route condition.
- Route conditions are set as `conditionExpression` elements on each outgoing `<bpmn2:sequenceFlow>`, using XPath or Camel Simple expressions (e.g., `${header.X-Type} = 'RUSH'`, `//Order/Type = 'STANDARD'`). The `expressionType` ifl:property on the sequenceFlow specifies `XPath` or `NonXML` (Camel Simple).
- See `bpmn-generation-guide.md` §4.4 for the complete Router BPMN XML template with conditionExpression examples.
- Each route branch leads to its own processing steps and receiver (via Request-Reply or Send).
- Each branch ends with its own EndEvent — branches are independent after the Router.
- **Default route:** One outgoing sequence flow has no condition (or condition `otherwise`) — this is the fallback.

**Discard pattern (log and drop):**
When a route branch should log the message but not send it anywhere:
- Route → Content Modifier (set a log message or custom header) → EndEvent
- The EndEvent has NO receiver messageFlow attached — it simply terminates the branch.
- Do NOT create a receiver participant for the discard route.

**JSON API → XML processing pipeline:**
When fetching JSON from a REST API and processing with XML-based steps (Splitter, Router, XSLT):
- Request-Reply (HTTP receiver) → JSON-to-XML Converter → Splitter/Router/etc.
- The JSON-to-XML Converter must come BEFORE any XML-based processing step.
- If the splitter expects a specific XML structure, verify the converter output matches the splitter's XPath expression.

**Multicast fan-out (parallel delivery):**
When the same message must be sent to multiple receivers simultaneously:
- Use `parallelGateway` (fork) — NOT `callActivity` or `exclusiveGateway`. CPI's Multicast step maps to `parallelGateway` in BPMN.
- Each outgoing branch from the fork leads to its own processing steps and receiver.
- Each branch ends with its own EndEvent — branches are independent after the fork.
- **Join gateway:** Optional. If you need to collect results from all branches before continuing, add a second `parallelGateway` (join) that merges the branches. If branches end independently (fire-and-forget to each receiver), no join is needed.
- **Receiver wiring per branch:** Each branch wires to its receiver via a Request-Reply or Send step (`serviceTask`), following the Wiring Lookup Table. Different branches can use different adapter types.
- Look up cmdVariantUri: Read `./references/metadata/steps/parallel_multicast.json` (or `sequential_multicast.json`).

**Data Store operations (flow steps, not adapters):**
Data Store Write/Select/Get/Delete are flow steps (`callActivity`), not adapter-based receivers. They do NOT need a receiver participant or messageFlow:
- Add as `callActivity` in the process, wired via sequence flows like any other step.
- Look up cmdVariantUri: Read `./references/metadata/steps/data_store_write.json` (Write), `data_store_select.json` (Select), `data_store_get.json` (Get), `data_store_delete.json` (Delete).
- Data Store name and entry ID are configured as `ifl:property` entries on the `callActivity`.
- **10MB payload limit** per Data Store entry. Split large payloads before writing.
- See `bpmn-generation-guide.md` §4.1 cmdVariantUri Reference and metadata files for the Data Store step BPMN template.
- **Multiple Data Store operations** in the same iFlow are fully supported. Each operation is an independent `callActivity` with its own Data Store name and entry ID. Common pattern: Select (check existence) → process → Write (store result) → Delete (cleanup old entries). Each operation is independent — there are no transaction boundaries across multiple Data Store steps.

**Local Integration Process (LIP) and Process Call:**
A LIP is a reusable sub-process within the same iFlow. In BPMN:
- The LIP is a separate `<bpmn2:process>` element within the same `.iflw` file (the main iFlow can have multiple `<bpmn2:process>` elements).
- The LIP has its own StartEvent, processing steps, and EndEvent. It does NOT have its own sender participant, but it CAN call external systems via Request-Reply or Send steps — the receiver participant and messageFlow for these calls are defined in the main `<bpmn2:collaboration>`, not inside the LIP process.
- From the main process, call the LIP via a Process Call step: `callActivity` with `activityType=ProcessConsumer`. The `processId` property references the LIP's `<bpmn2:process id="...">`.
- The LIP has its own integration process pool participant (`<bpmn2:participant>` with `ifl:type="IntegrationProcess"` and `processRef` pointing to the LIP process ID).
- Use LIPs to encapsulate reusable logic (validation, transformation, error handling) that is called multiple times or from different branches.
- **Partial failure handling (Splitter + LIP):** When processing individual records from a Splitter, wrap each record's processing in a LIP with its own exception subprocess. If one record fails, the LIP's exception subprocess handles it (e.g., log error, write to DLQ) using `ErrorEnd`. The parent process Splitter continues with the next record — the error is absorbed at the LIP level.
- See `bpmn-generation-guide.md` §4.1 for the Process Call cmdVariantUri and LIP structure.

**Script Collection reference:**
When an iFlow uses Groovy scripts from an external Script Collection (shared across multiple iFlows):
- On the Groovy Script `callActivity`, set `scriptBundleId` property to the Script Collection's artifact Id (must match exactly — case-sensitive).
- The `script` property contains the script filename within the collection (e.g., `utils.groovy`).
- **Deployment dependency:** The Script Collection must be deployed on the tenant BEFORE this iFlow. Add to Phase C.2 dependency order and Phase H user action items.
- Add `Require-Bundle: <ScriptCollectionSymbolicName>` to the iFlow's MANIFEST.MF to declare the dependency.
- Script Collections cannot be managed by this MCP server — they must be uploaded/deployed via the Cloud Integration web UI or a separate tool.

**Poll Enrich (fetch and merge without replacing message body):**
Poll Enrich fetches data from an external source and MERGES it with the current message — unlike Request-Reply, which REPLACES the message body:
- Poll Enrich is a `serviceTask` with `activityType=PollEnrich` (NOT `ExternalCall`).
- It connects to a receiver participant via a messageFlow, just like Request-Reply — the adapter configuration goes on the messageFlow.
- The fetched content is added as an attachment or merged based on the `aggregationAlgorithm` property (`Concatenate`, `Replace Body`, `Throw Exception`).
- Common use case: fetch a file from SFTP/FTP mid-flow to combine with the current message.
- Look up cmdVariantUri: Read `./references/metadata/steps/poll_enrich.json`.

**MIME Multipart Encoder/Decoder:**
Used when the message needs to carry attachments (e.g., EDI + PDF label, XML + binary file):
- MIME Multipart Encoder is a `callActivity` flow step that packages the message body + attachments into a MIME multipart message.
- MIME Multipart Decoder unpacks a received multipart message into body + attachments.
- These are standard palette flow steps — add as `callActivity` in the process.
- Look up cmdVariantUri: Read `./references/metadata/steps/mime_multipart_encoder.json` or `mime_multipart_decoder.json`.
- See `bpmn-generation-guide.md` §4.1 cmdVariantUri Reference for the MIME step template.

**Idempotent Process Call (exactly-once processing):**
Prevents duplicate processing of the same message (e.g., retried by JMS or idempotent file pickup):
- Idempotent Process Call is a `callActivity` with `activityType=IdempotentProcessCall`. It wraps a LIP.
- On first call: executes the LIP normally and records a unique message ID.
- On subsequent calls with the same ID: skips the LIP execution (returns previous result or empty body).
- **Key properties:** `idempotentComponentId` (unique identifier for this idempotent scope), `idempotentExpirationDays` (how long to remember processed IDs, e.g., `30`).
- The message ID is derived from the message's `SapMessageIdEx` header by default. Override with `idempotentId` property if needed.
- Look up cmdVariantUri: Read `./references/metadata/steps/idempotent_process_call.json`.

**Looping Process Call (retry with iteration control):**
When a processing block needs to be retried on transient failures:
- Looping Process Call wraps a Local Integration Process (LIP) call in a loop with configurable max iterations and a loop condition.
- It's a `callActivity` with `activityType=LoopProcess` — different from regular Process Call (`ProcessConsumer`).
- Properties: `maximumIterations` (e.g., `3`), `loopCondition` (XPath expression evaluated after each iteration — loop continues while true), `loopType` (typically `whileLoop`).
- **Loop exhaustion behavior:** When `maximumIterations` is reached and the `loopCondition` still evaluates to true, the loop exits and the flow continues to the next step. If the LIP threw an exception on the last iteration, the exception propagates to the calling process's exception subprocess. To detect exhaustion and take conditional action (e.g., route to Terminate End Event or JMS DLQ), set a property in the LIP on each failure (e.g., `retryCount` incremented, or `retryExhausted=true` on the last attempt), then add a Router after the Looping Process Call to check this property.
- The LIP contains the actual processing logic that may fail transiently (e.g., calling an external system).
- Use for: AS2/HTTP retry on 5xx errors, SFTP retry on connection timeout, any idempotent operation that may fail transiently.
- Look up cmdVariantUri: Read `./references/metadata/steps/looping_process_call.json`.

**Nesting Process Call types:** Idempotent Process Call and Looping Process Call can be nested. Common pattern: Idempotent Process Call → calls LIP-A (dedup wrapper) → LIP-A contains Looping Process Call → calls LIP-B (retry wrapper) → LIP-B contains the actual processing + external call. Each wrapper is a separate LIP. The BPMN structure requires: 3 `<bpmn2:process>` elements (main + LIP-A + LIP-B), with the main process calling LIP-A via Idempotent, and LIP-A calling LIP-B via Looping.

**JMS async decoupling (2-iFlow queue pattern):**
When an inbound iFlow needs to decouple from processing via a JMS queue:
- **iFlow 1 (writer):** Receives messages (e.g., IDoc sender) → processing → JMS Send step (fire-and-forget to queue). The JMS receiver adapter uses `Send` activityType. Queue name is externalized as `{{queueName}}`.
- **iFlow 2 (consumer):** JMS sender adapter (consumer trigger) → reads from the same queue → processing → final receiver. The JMS sender adapter is configured with the queue name and polling behavior.
- **Queue name alignment:** Both iFlows MUST reference the exact same queue name. Externalize in both as `{{queueName}}` with matching default values in `parameters.prop`.
- **Deploy order:** Flexible — JMS queues buffer messages, so either iFlow can be deployed first. Unlike ProcessDirect, there's no strict deploy ordering. Note this in Phase C.2 if both artifacts are JMS-linked.
- **Error handling:** If iFlow 2 fails, the message stays in the queue for retry (JMS redelivery). Configure `maxRedeliveryCount` on the JMS sender adapter.
- Common use case: IDoc → JMS → async processing pipeline, SFTP → JMS → fan-out, any pattern needing guaranteed delivery with decoupling.

**JMS dead-letter queue (DLQ) pattern:**
When processing fails after all retries, write the failed message to a separate DLQ for manual review:
- After the Looping Process Call (or final retry), if the processing still fails, catch the error in the exception subprocess.
- In the exception subprocess: Content Modifier (set error details as headers) → JMS Send step (fire-and-forget) to the DLQ. Use a dedicated queue name like `{originalQueue}_DLQ` or `{originalQueue}_Error`.
- Externalize the DLQ queue name as `{{dlqQueueName}}` in parameters.prop.
- The DLQ message should include: original payload, error message (header), timestamp, source iFlow name, and retry count.

**Synchronous request-response (HTTPS/SOAP sender):**
When the iFlow must return a response to the caller (sync pattern):
- Set `returnExceptionToSender` to `true` in the Collaboration properties. In BPMN XML, this is an `<ifl:property>` inside `<bpmn2:collaboration><bpmn2:extensionElements>`: `<ifl:property><key>returnExceptionToSender</key><value>true</value></ifl:property>`. This ensures errors are returned as SOAP Faults or HTTP error responses instead of being swallowed.
- The message body at the process EndEvent IS the response automatically returned to the sender. No explicit "response messageFlow" is needed — CPI handles the response path internally.
- For sync SOAP iFlows, the response is a SOAP envelope. For sync HTTPS iFlows, the response body is the HTTP response with the status code set by the last Content Modifier's `CamelHttpResponseCode` header.
- **Error handling in sync flows:** With `returnExceptionToSender=true`, the Exception Subprocess's `ErrorEnd` causes the error message (from the Content Modifier in the exception subprocess) to be sent back to the caller as the response. This is how you return SOAP Faults or custom error JSON/XML.
- **Critical:** In sync iFlows, every processing path (including error paths) must produce a meaningful response body. An empty response confuses callers.

**Preserving intermediate results across multiple calls:**
When an iFlow makes multiple sequential Request-Reply calls and needs to combine all responses:
- **Problem:** Each Request-Reply REPLACES the message body with the response. After the second call, the first response is lost.
- **Solution A (simple, sequential):** Before each Request-Reply, use a Content Modifier to save the current body as a property or header (e.g., `${property.oDataResponse}`). After all calls, use a Groovy Script or Content Modifier to combine all saved properties + the final body into the desired response structure.
- **Solution B (parallel, Multicast + Gather):** Use Multicast to fan out to parallel branches, each making a different Request-Reply call. Use a Gather/Join (`parallelGateway`) to rejoin branches. A Groovy Script after the join combines the results. This is better for independent calls that can run in parallel.
- **Gather output format:** After the Gather/Join, the message body contains the **last branch's response body** (by document order in the BPMN XML). To combine ALL branch results, save each branch's response to a distinct exchange property (e.g., `${property.branch1Result}`) in a Content Modifier BEFORE the Gather, then use a Groovy Script after the Gather to read all properties and build the combined response.
- **Recommendation:** Use Solution A for 2 sequential calls. Use Solution B for 3+ independent calls.

**Multicast with sync response (async side-channel):**
When a sync iFlow needs to fire-and-forget to a side-channel (e.g., publish event) while returning a response to the caller:
- Use Multicast (`parallelGateway` fork) with 2+ branches.
- **Main branch:** Continues processing → EndEvent. The message body at this EndEvent becomes the sync response to the caller.
- **Side-effect branch(es):** Processing → Send step (fire-and-forget to AMQP/JMS/SFTP/etc.) → EndEvent (no response needed).
- **Branch ordering:** In CPI, the response is taken from the **last branch** in document order within the BPMN XML. Ensure the main response branch is the LAST `<bpmn2:sequenceFlow>` from the `parallelGateway` fork. Side-effect branches should come first in the XML.
- **No Join needed:** Since the side-effect branches are fire-and-forget, they end independently. The main branch returns the response. Do NOT add a Gather/Join if you want the side-effects to run independently.

**Filter step behavior:**
The Filter step evaluates an XPath or non-XML condition and either passes or blocks the message:
- If the condition evaluates to `true`, the message passes through unchanged.
- If `false`: behavior depends on the `throwExceptionOnFilterFailure` property:
  - `true` → throws an exception, which triggers the Exception Subprocess. In sync iFlows with `returnExceptionToSender=true`, this returns an error response to the caller.
  - `false` (default) → silently discards the message. The flow continues to the EndEvent with an empty body. In sync iFlows, this returns an empty response — which may confuse callers. Set an appropriate response body via Content Modifier AFTER the Filter if using `false`.
- **Recommendation for sync iFlows:** Use `throwExceptionOnFilterFailure=true` so rejected messages get a meaningful error response. Set the error message in the Exception Subprocess's Content Modifier.

**ProcessDirect-Triggered iFlow Rules:**
These rules apply when the iFlow's sender adapter is ProcessDirect (i.e., this iFlow IS the called sub-flow):
- **Exchange propagation** — The calling iFlow's exchange (headers AND properties) is passed to the called iFlow. All headers and properties set by the caller before the ProcessDirect Request-Reply are available in the called iFlow via `${header.X}` and `${property.X}`. The called iFlow's response (body, headers, properties) flows back to the caller.
- **Sender Participant required** — ProcessDirect iFlows DO have a sender participant (`<bpmn2:participant ifl:type="EndpointSender">`), just like HTTPS/SOAP senders.
- **ProcessDirect sender adapter** — configured on the sender messageFlow with adapter type `ProcessDirect`. The `address` property (e.g., `/newHireHandler`) must exactly match the caller's ProcessDirect receiver adapter address. Externalize as `{{pd_address}}`.
- **Synchronous behavior** — ProcessDirect calls are synchronous. The caller blocks until this iFlow returns. The message body at the EndEvent becomes the response to the caller.
- **No authentication** — ProcessDirect is internal CPI-to-CPI. No auth config needed on the sender adapter.
- **Deploy order** — This iFlow must be deployed BEFORE the calling iFlow. See Phase C.2 ProcessDirect chain rule.

**Terminate End Event:**
Use Terminate End Event for critical failures where continuing processing is dangerous:
- Terminate End Event **immediately stops the ENTIRE iFlow** — all branches, all parallel processing, all Local Integration Processes. It is a "kill switch."
- Different from normal EndEvent (terminates only the current branch) and ErrorEnd (inside Exception Subprocess, marks message as failed).
- Use when: mandatory field validation fails, data integrity is compromised, continuing would cause corrupt data in downstream systems.
- In BPMN: `<bpmn2:endEvent>` with `<bpmn2:terminateEventDefinition/>` inside. Look up cmdVariantUri: Read `./references/metadata/steps/terminate_message.json`.
- **In sync iFlows:** Terminate End Event with `returnExceptionToSender=true` returns an error response to the caller. The error message is whatever was set in the message body before the Terminate event.

**Persist Message (audit trail):**
Persist Message writes the current message body and headers to the CPI Message Processing Log for audit/debugging:
- It is a `callActivity` flow step, NOT an adapter-based receiver. Does not need a receiver participant or messageFlow.
- Add it as a step in the sequence flow where you want the audit snapshot.
- Look up cmdVariantUri: Read `./references/metadata/steps/persist_message.json`.
- **Performance note:** Persist Message stores the full message body. For large payloads, this impacts storage. Use selectively — typically before and after critical transformations, or in Exception Subprocesses.

**XML Digital Signature / Verification:**
Used for message integrity and non-repudiation in compliance scenarios:
- XML Digital Signer is a `callActivity` flow step that signs the XML payload using a private key from the CPI keystore.
- XML Signature Verifier validates signatures on incoming messages.
- **Keystore alias** must be configured as a property (externalize as `{{keyAlias}}`). The alias must exist in the CPI keystore — add as user action item.
- Look up cmdVariantUri: Read `./references/metadata/steps/xml_signer.json` or `xml_signature_verifier.json`.

**Exception Subprocess:**
Every iFlow that specifies error handling = Yes needs an exception subprocess:
- Exception subprocess is a `bpmn2:subProcess` inside the main `bpmn2:process` (do NOT add `triggeredByEvent="true"` — see bpmn-generation-guide.md §4.6).
- Contains: `ErrorStartEvent` → processing steps (typically Content Modifier to set error details) → `ErrorEnd` event.
- **IMPORTANT:** Always use `ErrorEnd` (with `errorEventDefinition`) in exception subprocesses — NOT `EscalationEnd`. The `bpmn-generation-guide.md` mandates `ErrorEnd` exclusively. Using `EscalationEndEvent` causes the exception subprocess to render as an empty box in the CPI Web UI.
- **Error behavior with `ErrorEnd`:** The `ErrorEnd` marks the message as FAILED in the Message Processing Log. In sync iFlows with `returnExceptionToSender=true`, the error message body (set by the Content Modifier in the exception subprocess) is returned to the caller as the error response.
- **LIP exception subprocesses:** LIPs CAN have their own exception subprocesses with `ErrorEnd`. If the LIP handles the error, the main process continues (error absorbed within the LIP). If no LIP exception subprocess, error propagates to the main process's exception subprocess. See "Local Integration Process (LIP) and Process Call" pattern above for partial failure per record.
- See `bpmn-generation-guide.md` §4.6 for the complete Exception Subprocess BPMN template including all required properties.
