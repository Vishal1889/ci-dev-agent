## Phase C: Artifact Generation

### Zip Folder Structure

| Artifact Type | Key Paths |
|--------------|-----------|
| iFlow | `META-INF/MANIFEST.MF`, `src/main/resources/scenarioflows/integrationflow/{Name}.iflw`, `src/main/resources/parameters.prop`, `src/main/resources/parameters.propdef`, `src/main/resources/script/*.groovy`, `src/main/resources/mapping/*` (Message Mappings `.mmap` AND XSLT files `.xsl`/`.xslt`), `src/main/resources/xsd/*`, `src/main/resources/wsdl/*` |
| Message Mapping | `META-INF/MANIFEST.MF`, `src/main/resources/mapping/{Name}.mmap`, `src/main/resources/xsd/*` |

### CPI Runtime Fundamentals

These are foundational CPI concepts needed for BPMN generation. Reference this section when configuring Content Modifier, Groovy Script, Router, or Splitter steps.

#### Exchange Model: Headers vs Properties

| Aspect | Exchange Headers | Exchange Properties |
|--------|-----------------|-------------------|
| **Scope** | Current adapter call — may be lost or overwritten when calling external systems via Request-Reply | Entire iFlow execution — persist across all steps and adapter calls |
| **Sent externally** | Yes — HTTP headers are sent to receivers and returned by senders | No — properties are internal to the iFlow, never sent to external systems |
| **Use when** | Setting HTTP headers (Content-Type, Authorization), reading adapter-injected metadata (CamelFileName), passing data to receivers | Preserving data across Request-Reply calls, storing intermediate results, passing data between LIPs, internal processing flags |
| **Access syntax** | `${header.HeaderName}` | `${property.PropertyName}` |

#### CPI Expression Syntax (for Content Modifier, Router, Splitter)

| Expression | Meaning | Example Use |
|-----------|---------|-------------|
| `${in.body}` | Current message body as string | Save body to property before Request-Reply replaces it |
| `${header.HeaderName}` | Value of exchange header | `${header.Content-Type}`, `${header.CamelFileName}` |
| `${property.PropertyName}` | Value of exchange property | `${property.originalPayload}`, `${property.batchId}` |
| `${xpath:expression}` | XPath evaluated on message body | `${xpath://Order/@type}`, `${xpath:count(//Item)}` |
| `${date:now:yyyyMMdd}` | Current date/time formatted | `${date:now:yyyy-MM-dd'T'HH:mm:ss}` |
| `${exchangeId}` | Unique exchange identifier | Correlation ID |

#### Standard SAP/Camel Headers

| Header | Set By | Description |
|--------|--------|-------------|
| `SAP_MessageProcessingLogID` | CPI runtime | Unique MPL ID for this message — use for correlation/tracking |
| `SAP_Sender` | Sender adapter | Sender system name from participant config |
| `SAP_Receiver` | Receiver adapter | Receiver system name from participant config |
| `SapMessageIdEx` | CPI runtime | Extended message ID — used by Idempotent Process Call for dedup |
| `CamelFileName` | SFTP/FTP sender | Original filename of the picked-up file |
| `CamelFileLength` | SFTP/FTP sender | File size in bytes |
| `CamelFileLastModified` | SFTP/FTP sender | Last modified timestamp of the file |
| `CamelHttpResponseCode` | HTTP/HTTPS adapters | HTTP response status code — set this in Content Modifier to control sync response status |
| `CamelSplitIndex` | Splitter step | 0-based index of current split record |
| `CamelSplitSize` | Splitter step | Total number of split records |
| `CamelSplitComplete` | Splitter step | `true` on the last split record |
| `Content-Type` | Manual (Content Modifier) | MIME type — set before sending to HTTP/REST receivers |

> **After Request-Reply:** HTTP response headers from the external system become available as exchange headers. For example, if the external API returns `X-Batch-ID` in the response, it is accessible as `${header.X-Batch-ID}` in subsequent steps.

> **After Splitter:** All steps after a Splitter operate on **each individual split record** (not the full original message). The Camel split headers (`CamelSplitIndex`, `CamelSplitSize`, `CamelSplitComplete`) are available for per-record logic. Exchange properties set BEFORE the Splitter remain accessible for all split records.

> **Property mutation across split records:** In CPI's General Splitter with **sequential processing** (default), the exchange is shared across iterations — properties modified in one record ARE visible in subsequent records. This allows accumulation patterns (e.g., Groovy appends to a `failedOrders` property each iteration). However, with **parallel processing** enabled (`ParallelProcessing=true`), each record gets a COPY of the exchange — property mutations do NOT accumulate across records. For reliable accumulation, prefer: (a) Groovy with sequential Splitter, or (b) Data Store Write per record + post-Splitter Select to aggregate.

#### Content Modifier BPMN Configuration

Content Modifier is a `callActivity` with `activityType=Enricher`. Its behavior is configured via `ifl:property` entries:

**Setting headers** — property key `headerTable` with HTML-encoded table rows:
```xml
<ifl:property>
    <key>headerTable</key>
    <value>&lt;row&gt;&lt;cell&gt;Action&lt;/cell&gt;&lt;cell&gt;Name&lt;/cell&gt;&lt;cell&gt;Type&lt;/cell&gt;&lt;cell&gt;Value&lt;/cell&gt;&lt;cell&gt;Default&lt;/cell&gt;&lt;/row&gt;&lt;row&gt;&lt;cell&gt;Create&lt;/cell&gt;&lt;cell&gt;Content-Type&lt;/cell&gt;&lt;cell&gt;expression&lt;/cell&gt;&lt;cell&gt;application/json&lt;/cell&gt;&lt;cell/&gt;&lt;/row&gt;</value>
</ifl:property>
```
- Action: `Create` (set/overwrite), `Delete` (remove header)
- Type: `expression` (CPI expression), `constant` (literal value), `header` (copy from another header), `property` (copy from property)

**Setting properties** — property key `propertyTable` with HTML-encoded table rows (same format as headerTable):
```xml
<ifl:property>
    <key>propertyTable</key>
    <value>&lt;row&gt;&lt;cell&gt;Action&lt;/cell&gt;&lt;cell&gt;Name&lt;/cell&gt;&lt;cell&gt;Type&lt;/cell&gt;&lt;cell&gt;Value&lt;/cell&gt;&lt;cell&gt;Default&lt;/cell&gt;&lt;/row&gt;&lt;row&gt;&lt;cell&gt;Create&lt;/cell&gt;&lt;cell&gt;originalPayload&lt;/cell&gt;&lt;cell&gt;expression&lt;/cell&gt;&lt;cell&gt;${in.body}&lt;/cell&gt;&lt;cell/&gt;&lt;/row&gt;</value>
</ifl:property>
```

**Setting message body** — property keys `bodyType` and `wrapContent`:
```xml
<ifl:property><key>bodyType</key><value>expression</value></ifl:property>
<ifl:property><key>wrapContent</key><value>${property.combinedResponse}</value></ifl:property>
```
- bodyType: `expression` (CPI expression) or `constant` (literal text/XML/JSON)
- wrapContent: the expression or literal content

> **Delete action:** To remove headers before returning a sync response, add rows with Action=`Delete` in the `headerTable`. Common removals: internal processing headers, SAP_* headers not needed by the caller.

#### Groovy Script API Reference

Standard boilerplate for CPI Groovy scripts:
```groovy
import com.sap.gateway.ip.core.customdev.util.Message

def Message processData(Message message) {
    // Read body
    def body = message.getBody(String.class)

    // Read/set headers
    def fileName = message.getHeader("CamelFileName", String.class)
    message.setHeader("X-Processed", "true")

    // Read/set properties
    def batchId = message.getProperty("batchId")
    message.setProperty("status", "validated")

    // Modify body
    message.setBody("{ \"result\": \"success\" }")

    return message
}
```

Common Groovy use cases in CPI:
- **String parsing:** Extract metadata from filenames, parse delimited strings
- **JSON building/parsing:** `import groovy.json.JsonBuilder` / `import groovy.json.JsonSlurper` — `new JsonSlurper().parseText(body)` to parse, `new JsonBuilder(map).toPrettyString()` to build
- **XML parsing:** `def xml = new XmlSlurper().parseText(body)` — access fields via `xml.EmployeeID.text()`, `xml.@attribute`, `xml.children()`. Use for validation, field extraction, conditional logic.
- **Header manipulation:** Set multiple headers conditionally, copy between headers and properties
- **Validation logic:** Check mandatory fields, validate format patterns — `if (!xml.EmployeeID.text()) { message.setProperty("errors", "Missing EmployeeID") }`
- **Data transformation:** Complex field mapping not achievable with standard steps

> **Do NOT use Groovy when a Content Modifier or Message Mapping can do the job.** Content Modifier is preferred for simple header/property/body setting. Message Mapping is preferred for field-to-field source-to-target transformations. Use Groovy only when standard steps and Message Mapping are insufficient (conditional logic, loops, string manipulation, CSV parsing, dynamic field generation).

### Generation Steps

1. Create temp directory: `mkdir -p skills/ci-iflow-developer/.tmp/<artifact-id>` — **NEVER use `/tmp`, `C:\tmp`, or any system temp path.** All temp files MUST stay inside the skill's `.tmp/` directory.
2. **Do NOT generate MANIFEST.MF.** The `scaffold-iflow` tool creates a correct MANIFEST.MF with the right `Bundle-SymbolicName`, `Import-Package`, and `Import-Service` for the tenant. Use the scaffolded version as-is. Only modify it if you need to add `Require-Capability` for Script Collection references (see `bpmn-generation-guide.md` §8). Hand-crafting MANIFEST.MF with wrong `Import-Package` versions or `Import-Service` entries causes silent deployment failures.
3. Generate `.iflw` BPMN XML using **scaffold-first workflow**:
   - After `scaffold-iflow` + `get-iflow-content` (Phase D steps 1-3), extract the scaffold's structural boilerplate: `<bpmn2:definitions>` attributes, `<bpmn2:collaboration>` extensionElements + documentation, participant extensionElements.
   - Use this boilerplate as the outer shell. Fill in custom content (steps, adapters, wiring, diagram) following template patterns from `./references/minimal-iflows/`.
   - See `bpmn-generation-guide.md` §0 "Scaffold-First Generation Rule".
   > **Phase C/D Interleave:** For new artifacts, do Phase C steps 1-2, then Phase D steps 1-3 (scaffold + read), then return to Phase C step 3 (generate .iflw using scaffold boilerplate), then Phase C steps 4-8, then Phase D steps 4-5.
   - **Before generating any adapter messageFlow or step callActivity**, verify the metadata file exists:
     - Adapter: `./references/metadata/adapters/{adapter}_{direction}.json`
     - Step: `./references/metadata/steps/{step}.json`
   - **If the file does not exist or has empty `cmdVariantUri`:** Do NOT guess. Inform the user: *"I don't have metadata for {name}. I'll skip this component — you can add it manually in the CPI Web UI, or provide the adapter/step configuration."* Continue generating the rest of the iFlow with a placeholder comment in the BPMN XML: `<!-- TODO: {name} adapter/step — metadata not available, add manually -->`. Log it as a user action item for Phase H.
   - **If you are unsure about a property key or valid value:** Use the metadata file's property list as the source of truth. If the property isn't in the metadata, do not invent it.
4. Generate Groovy scripts, mappings, schemas as needed. **Choose implementation approach per the Step Implementation Preferences table below.** **Script filenames:** use `camelCase.groovy` (e.g., `transformPayload.groovy`, `setHeaders.groovy`). The BPMN `<key>script</key><value>` must match the filename exactly (case-sensitive).
5. **Externalize environment-specific values (if user opted for externalization in Phase A).** Use CPI's runtime parameter syntax `{{parameterName}}` in BPMN XML property values. The `{{paramName}}` syntax is actual CPI runtime syntax — do NOT replace it with literal values. CPI resolves `{{paramName}}` at deployment using the value from `parameters.prop`.
   - **Externalize:** adapter endpoints, credential aliases, timeouts, retry counts, queue names, table names, schedule keys
   - **Shared credentials across multi-artifact sets:** When multiple iFlows use the same credential alias (e.g., all call S/4HANA with the same OAuth2 credential), use the exact same externalized parameter name and default value in ALL iFlows' `parameters.prop` files. Document the shared credential alias in the Phase H user action items so the user creates it once in the CPI Security Material store.
   - **Do NOT externalize:** step names, participant names, adapter types, flow structure, processing logic
   - **If user opted NOT to externalize:** Hardcode values directly in the BPMN XML adapter properties. Do NOT generate `parameters.prop` or `parameters.propdef`. For hardcoded inline `scheduleKey`, the `schedule1` `&` separator must be double XML-encoded as `&amp;amp;`. Copy from minimal-iflow templates (`.iflw` files).
   > **Uploading parameters.prop/propdef to fresh scaffolds is safe** when externalizing. The previously documented "corruption" was caused by `&amp;` in `schedule1` getting decoded to bare `&` during upload — not by the upload itself. **After uploading, verify schedule encoding with `get-iflow-content`.**

   **Worked example — externalizing HTTP Receiver properties:**

   *Before (hardcoded):*
   ```xml
   <ifl:property><key>httpAddressWithoutQuery</key><value>http://api.example.com/endpoint</value></ifl:property>
   <ifl:property><key>credentialName</key><value>MyCredential</value></ifl:property>
   <ifl:property><key>authenticationMethod</key><value>Basic</value></ifl:property>
   ```

   *After (externalized):*
   ```xml
   <ifl:property><key>httpAddressWithoutQuery</key><value>{{receiver.Address}}</value></ifl:property>
   <ifl:property><key>credentialName</key><value>{{receiver.Credential}}</value></ifl:property>
   <ifl:property><key>authenticationMethod</key><value>{{receiver.Authentication}}</value></ifl:property>
   ```

   *Resulting `parameters.prop`:*
   ```
   receiver.Address=http\://api.example.com/endpoint
   receiver.Credential=MyCredential
   receiver.Authentication=Basic
   ```

   *Resulting `parameters.propdef` (partial — showing `<param_references>` only):*
   ```xml
   <param_references>
     <!-- Receiver adapter: FULL cmdVariantUri in attribute_id -->
     <reference attribute_category="Receiver" attribute_id="ctype::AdapterVariant/cname::HTTP/tp::HTTP/mp::None/direction::Receiver/version::1.17.0/attrId::httpAddressWithoutQuery" attribute_uilabel="Address" param_key="receiver.Address"/>
     <reference attribute_category="Receiver.Receiver.Auth" attribute_id="ctype::AdapterVariant/cname::HTTP/tp::HTTP/mp::None/direction::Receiver/version::1.17.0/attrId::credentialName" attribute_uilabel="Credential Name" param_key="receiver.Credential"/>
     <reference attribute_category="Receiver.Receiver.Auth" attribute_id="ctype::AdapterVariant/cname::HTTP/tp::HTTP/mp::None/direction::Receiver/version::1.17.0/attrId::authenticationMethod" attribute_uilabel="Authentication" param_key="receiver.Authentication"/>
     <!-- Sender adapter references use SHORT form: /attrId::{key} with empty uilabel -->
     <!-- Flow step params (Content Modifier, Data Store, PGP): NO reference entries -->
   </param_references>
   ```

   > See `./references/guides/parameters-generation-guide.md` for 3 complete worked examples (sync, timer, polling+multi-receiver) and the full `param_references` rules for sender vs receiver adapters.

6. Generate `parameters.prop` with default values in Java properties format: `key=value` (e.g., `receiver.Address=https://example.com`).
7. Generate `parameters.propdef` in **XML format**: `<?xml version="1.0"...?><parameters><parameter>...</parameter></parameters>`. Do NOT use Java properties format (e.g., `key.isExternallyConfigured=true`) — this causes `"Error while loading the details of the integration flow"` in the Web UI. See `bpmn-generation-guide.md` §10 for the correct XML structure.
8. **Populate `<param_references>` in `parameters.propdef`:** For every `{{paramName}}` used in an adapter messageFlow property, add a `<reference>` entry binding the parameter to the adapter attribute. See `bpmn-generation-guide.md` §10 for the exact format and generation rules. **Do NOT leave `<param_references/>` empty** when externalized parameters exist — this causes adapter binding failures and `"Enter adapter details for channel"` errors.

   **Parameter validation checklist** (verify before proceeding to artifact upload):
   1. Every `{{paramName}}` in the `.iflw` has a matching `key=value` in `parameters.prop`
   2. Every key in `parameters.prop` has a `<parameter>` element in `parameters.propdef`
   3. **Receiver adapter** params have `<reference>` with FULL `attribute_id`: `ctype::AdapterVariant/cname::{Name}/...version::{V}/attrId::{key}` — drop `sap:` from `cname::`
   4. **Sender adapter** params have `<reference>` with SHORT `attribute_id`: `/attrId::{key}` and empty `attribute_uilabel=""`
   5. **Flow step params** (Content Modifier, Data Store, PGP, etc.) have `<parameter>` entries but NO `<reference>` in `<param_references>`
   6. Timer `Scheduler`: NO `<reference>` entry (timer is not an adapter messageFlow)
   7. Polling adapter `scheduleKey`: SHORT form reference `/attrId::scheduleKey` with `attribute_category="Sender"`
   8. `parameters.propdef` is XML format (not Java properties)
   9. Dropdown fields have `<isCombobox>true</isCombobox>`, booleans `<isCombobox>false</isCombobox>`, free-text `<additionalMetadata/>`
   10. Credential aliases documented as user action items for Phase H

### Step Implementation Preferences

For each processing step in the requirements, select the implementation approach using these rules:

**For message transformation/mapping tasks** (source-to-target field mapping, structure conversion):

| Priority | Approach | When |
|----------|----------|------|
| **1st** | **Message Mapping (.mmap)** | **Always prefer for mapping tasks** — field-to-field mapping, structure transformation, value conversions, constant defaults, conditional mapping. Use in-iFlow or standalone artifact. |
| 2nd | Groovy Script | **Only if user explicitly requests Groovy for mapping**, OR if the mapping requires logic not achievable in Message Mapping (e.g., complex string parsing, dynamic field generation, external API calls during mapping, CSV parsing without XSD) |
| 3rd | XSLT Mapping | Complex XML-to-XML with advanced grouping/sorting not achievable in Message Mapping |
| Never | JavaScript | Always use Groovy instead |

**For non-mapping tasks** (processing logic, header manipulation, routing, validation):

| Priority | Approach | When |
|----------|----------|------|
| 1st | Standard palette step | Content Modifier, Filter, Router, Splitter, Converter, Data Store, etc. |
| 2nd | Groovy Script | Complex logic not achievable with standard steps (conditional validation, dynamic header manipulation, string parsing, JSON/XML building, accumulation patterns) |
| Never | JavaScript | Always use Groovy instead |

> **Key rule:** If the requirement says "map fields from source to target" or provides a field mapping table, default to **Message Mapping** — not Groovy Script. Message Mappings are maintainable in the Web UI, support visual mapping, and are the SAP-recommended approach. Only fall back to Groovy if (a) the user explicitly asks for it, (b) no XSD/schema is available and cannot be derived, or (c) the mapping logic requires programmatic capabilities beyond Message Mapping functions.

### Receiver Adapter Wiring Rules

Getting this wrong is the single most common cause of deployment failure. The receiver adapter type determines which BPMN element and step type you must use to connect to the receiver participant. There is no flexibility here — using the wrong combination silently produces invalid BPMN that fails at deployment.

#### Wiring Lookup Table

Before wiring any receiver, find the adapter in this table and use the specified step:

| Receiver Adapter | Required Step | BPMN Element | messageFlow sourceRef |
|-----------------|---------------|--------------|----------------------|
| **HTTP** | Request-Reply | `<bpmn2:serviceTask>` | ServiceTask ID |
| **OData** | Request-Reply | `<bpmn2:serviceTask>` | ServiceTask ID |
| **SOAP** | Request-Reply | `<bpmn2:serviceTask>` | ServiceTask ID |
| **RFC** | Request-Reply | `<bpmn2:serviceTask>` | ServiceTask ID |
| **JDBC** | Request-Reply | `<bpmn2:serviceTask>` | ServiceTask ID |
| **SuccessFactors** | Request-Reply | `<bpmn2:serviceTask>` | ServiceTask ID |
| **ProcessDirect** | Request-Reply | `<bpmn2:serviceTask>` | ServiceTask ID |
| **IDoc** | Request-Reply | `<bpmn2:serviceTask>` | ServiceTask ID |
| **AMQP** | Request-Reply | `<bpmn2:serviceTask>` | ServiceTask ID |
| **Kafka** | Request-Reply | `<bpmn2:serviceTask>` | ServiceTask ID |
| **SFTP** | Send OR Request-Reply | `<bpmn2:serviceTask>` | ServiceTask ID |
| **FTP** | Send OR Request-Reply | `<bpmn2:serviceTask>` | ServiceTask ID |
| **JMS** | Send OR Request-Reply | `<bpmn2:serviceTask>` | ServiceTask ID |
| **Mail** | Send OR Request-Reply | `<bpmn2:serviceTask>` | ServiceTask ID |
| **AS2** | Send OR Request-Reply | `<bpmn2:serviceTask>` | ServiceTask ID |
| **XI** (EO) | Send OR Request-Reply | `<bpmn2:serviceTask>` | ServiceTask ID |

**Key insight:** The messageFlow to a receiver always originates from a `serviceTask` (Request-Reply or Send step), never from an EndEvent. EndEvents terminate the integration process — they don't call external systems.

**Send step** (`activityType: Send`) is fire-and-forget — use ONLY with: AS2, FTP, JMS, Mail, SFTP, XI (QoS: Exactly Once). **Never use Send for SOAP** unless the user explicitly mentions SAP RM / reliable messaging (extremely rare). For all standard SOAP scenarios, use Request-Reply.

**Request-Reply** (`activityType: ExternalCall`) waits for a response — works with all adapters above plus HTTP, OData, JDBC, RFC, IDoc, AMQP, Kafka, SuccessFactors, ProcessDirect, and many more.

> **Rule of thumb:** When in doubt, use Request-Reply. It works with every receiver adapter. If no response processing is needed, just let the response flow through without acting on it.

#### Correct BPMN Pattern

The receiver adapter properties go on the `messageFlow`, and the `messageFlow.sourceRef` points to the `serviceTask` — not to an EndEvent:

```xml
<!-- The Request-Reply step (serviceTask, not callActivity) -->
<bpmn2:serviceTask id="ServiceTask_1" name="Send to Receiver">
    <bpmn2:extensionElements>
        <ifl:property><key>activityType</key><value>ExternalCall</value></ifl:property>
        <ifl:property>
            <key>cmdVariantUri</key>
            <value>ctype::FlowstepVariant/cname::ExternalCall/version::1.0.4</value>
        </ifl:property>
        <ifl:property><key>componentVersion</key><value>1.0</value></ifl:property>
    </bpmn2:extensionElements>
    <bpmn2:incoming>SequenceFlow_in</bpmn2:incoming>
    <bpmn2:outgoing>SequenceFlow_out</bpmn2:outgoing>
</bpmn2:serviceTask>

<!-- messageFlow from ServiceTask to Receiver — adapter config goes here -->
<bpmn2:messageFlow id="MessageFlow_Rcv" name="HTTP"
    sourceRef="ServiceTask_1" targetRef="Participant_Receiver">
    <bpmn2:extensionElements>
        <!-- All adapter properties (ComponentType, address, auth, etc.) -->
    </bpmn2:extensionElements>
</bpmn2:messageFlow>
```

> **Never wire EndEvent directly to a receiver adapter** — this always fails deployment. See Wiring Lookup Table above.

See `bpmn-generation-guide.md` §4.5 ("Request-Reply vs Send") for XML examples.

#### OData Receiver Query Parameters

When calling OData APIs (SAP S/4HANA, SuccessFactors, etc.), query parameters are configured as adapter properties on the OData receiver messageFlow:
- `resourcePath` — the OData entity set (e.g., `A_BusinessPartner`, `User`)
- `queryOptions` — URL query string with OData parameters: `$filter=EmployeeID eq '12345'&$select=FirstName,LastName&$expand=ToAddress&$top=100`
- Externalize `resourcePath` and `queryOptions` as `{{paramName}}` if they vary per environment.
- **OData V2 vs V4:** OData V2 (most SAP on-premise) returns XML (Atom/OData) by default. OData V4 (SuccessFactors, S/4HANA Cloud) returns JSON by default. If subsequent steps need XPath processing, add a JSON-to-XML Converter after the Request-Reply for OData V4 responses.
- See adapter metadata file `./references/metadata/adapters/odata_v2_receiver.json` for the full OData adapter property template.

### Message Mapping Placement

The Requirements Analysis Sub-Agent (Phase A) should have determined mapping placement. If not determined, ask the user now using the `AskUserQuestion` tool:

Use `AskUserQuestion` with:
- question: "Should the message mapping be created as a step within the iFlow, or as a separate reusable artifact?"
- header: `Placement`
- options:
  - label: "In-iFlow step", description: "Mapping is embedded within this iFlow — simpler, used only by this iFlow"
  - label: "Standalone reusable artifact", description: "Separate Message Mapping artifact that can be referenced by multiple iFlows"

- **In-iFlow** (default if user says "doesn't matter"): Add as a `MessageMapping` callActivity step in the BPMN XML. The `.mmap` file goes inside the iFlow zip under `src/main/resources/mapping/`.
- **Separate artifact**: Create a standalone Message Mapping artifact via `scaffold-message-mapping` + `update-message-mapping-content`. Reference it from the iFlow using `mappingSource=mappingSrcExternal` and add `Require-Capability` to the iFlow's MANIFEST.MF.

### Generating .mmap Content

When the iFlow requires a Message Mapping (in-iFlow or standalone created as part of this iFlow task):

1. **Read `./references/guides/message-mapping-generation-guide.md`** — this is the authoritative reference for `.mmap` XML generation. It contains the exact XML skeleton, all 74 standard function `fname` values (many differ from UI labels — e.g., `sub` not `subtract`), binding parameter names, brick patterns, and a worked example.
2. **NEVER guess `fname` values or binding parameter names.** If a function is not in the generation guide, stop and tell the user.
3. **Sample `.mmap` files** are available at `./references/minimal-message-mappings/` for on-demand reference when debugging or verifying complex patterns.
4. **Groovy UDFs in mappings:** If the mapping requires custom functions, place the `.groovy` file in `src/main/resources/script/` and add a `<libref>` entry in the `.mmap`'s `<libstorage>`. See Section 7 of the generation guide.

### Common Integration Patterns

**IMPORTANT:** The lookup table below provides quick-reference Key Rules. For BPMN XML details, multi-step configurations, and edge cases, **you MUST read `./references/guides/integration-patterns.md`** for any pattern you are implementing. The Key Rule alone is NOT sufficient for correct BPMN generation — it is a summary, not a specification.

| Pattern | When to Use | Key Rule |
|---------|------------|----------|
| Intermediate Request-Reply | Mid-flow external call | Request-Reply between steps, not at EndEvent |
| Content-based Router | Route by content/header | `exclusiveGateway` (not callActivity), conditions on sequenceFlows |
| Discard (log and drop) | Route branch with no receiver | EndEvent with no messageFlow |
| JSON → XML pipeline | REST API → XML processing | JSON-to-XML Converter before Splitter/Router |
| Multicast fan-out | Send to multiple receivers | `parallelGateway` fork, independent branch EndEvents |
| Data Store operations | Store/retrieve data | `callActivity` steps (not adapters), 10MB limit |
| LIP + Process Call | Reusable sub-process | Separate `<bpmn2:process>`, ProcessCall with `processId` |
| Script Collection ref | Shared Groovy scripts | `scriptBundleId` must match, deploy SC first |
| Poll Enrich | Fetch without replacing body | `serviceTask` PollEnrich (not ExternalCall) |
| Idempotent Process Call | Exactly-once processing | Wraps LIP, dedup by `SapMessageIdEx` |
| Looping Process Call | Retry on transient failures | Wraps LIP, max iterations + loop condition |
| JMS decoupling | Async 2-iFlow pattern | Same queue name in both iFlows, flexible deploy order |
| JMS DLQ | Failed message handling | Exception subprocess → JMS Send to DLQ |
| Sync request-response | Return response to caller | `returnExceptionToSender=true`, body at EndEvent = response |
| Preserve intermediate results | Multiple Request-Reply calls | Save body to property before each call |
| Multicast + sync response | Side-channel fire-and-forget | Response from last branch in XML order |
| Filter step | Conditional pass/block | `throwExceptionOnFilterFailure` for sync error response |
| ProcessDirect-triggered | Called sub-flow | Exchange propagated, deploy callee first |
| Terminate End Event | Kill switch | Stops entire iFlow immediately |
| Persist Message | Audit trail | `callActivity` step, stores full body to MPL |
| XML Digital Signature | Compliance signing | Keystore alias externalized, add as user action |
| Exception Subprocess | Error handling | `ErrorEnd` only (never EscalationEnd), see §4.6 |

### Same Protocol on Sender and Receiver

When the same adapter type (e.g., SFTP) is used for both sender and receiver with different configurations:
- **Participant names:** Use distinct names that indicate direction — e.g., `SFTP_BOCOM_Sender` and `SFTP_Payroll_Receiver`, not just `SFTP`.
- **Externalized parameters:** Use direction-prefixed parameter names to avoid collisions — e.g., `sftp.sender.Address` vs `sftp.receiver.Address`, `sftp.sender.CredentialName` vs `sftp.receiver.CredentialName`.
- **Credential aliases:** Different credentials for sender and receiver require separate aliases in the CPI Security Material store. List both as user action items.

### Naming & Formatting Rules

**iFlow Name and ID:**
- Name CANNOT start with a number, space, period (`.`), or any special character
- Name CANNOT end with a period (`.`)
- The artifact **ID** is derived from the Name: remove all special characters, replace spaces with underscores (see Generation Steps for full example)
- Use the same value for both `Bundle-SymbolicName` in MANIFEST.MF and the artifact ID in API calls

**Participant Names (Sender/Receiver):**
- **No spaces** in participant names. Use PascalCase or underscores.
- Right: `SAP_S4HANA`, `Supplier_EDI`, `SFTPReceiver`, `HTTPS_Sender`
- Wrong: `SAP S4HANA`, `Supplier EDI`, `SFTP Receiver`, `HTTPS Sender`

**Channel Names (Message Flow):**
- The `Name` property on `<bpmn2:messageFlow>` must be the **bare adapter type name** matching the adapter's `cname::` value from its cmdVariantUri — no spaces, no suffixes, no descriptions.
- Right: `SOAP`, `HTTP`, `SFTP`, `ProcessDirect`, `HTTPS`, `AMQP`
- Wrong: `SOAP_OrderRequest`, `HTTP_SupplierEDI`, `HTTPS Sender Channel`, `My HTTP Connection`
- When in doubt, query the adapter's cmdVariantUri from the metadata JSON files and extract the `cname::` portion after the vendor prefix. Use exact casing as shown in the examples above (e.g., `ProcessDirect` not `processdirect`, `SFTP` not `sftp`).

**iflw Filename (CRITICAL — causes "must contain only one integration flow" error if wrong):**
- When `scaffold-iflow` creates an artifact, it generates a `.iflw` file whose name matches the **display Name** (with spaces), NOT the artifact ID (with underscores). For example: artifact ID `My_Flow_v2` → scaffolded file is `My Flow v2.iflw`.
- **ALWAYS call `get-iflow-content` after `scaffold-iflow`** (or before any `update-iflow-content`) to discover the exact `.iflw` filepath. Extract the path ending in `.iflw` from the response.
- Use that **exact filepath** in the `update-iflow-content` files array. Do NOT invent a new `.iflw` filename — this creates a second `.iflw` file in the ZIP and causes deployment failure.

### Adapter Authentication Types

When configuring adapter authentication, use these standard values for the `authenticationMethod` / `senderAuthType` property.

> **Sender vs Receiver auth types differ.** Not all auth types are available for both directions:
> - **Sender (inbound) adapters** (HTTPS/SOAP): `RoleBased`, `ClientCertificate`, `Basic`, `None`. OAuth2 Client Credentials is NOT valid for sender adapters.
> - **Receiver (outbound) adapters** (HTTP/SOAP/OData/etc.): `Basic`, `OAuth2 Client Credentials`, `ClientCertificate`, `None`. `RoleBased` is NOT valid for receiver adapters.
> - **SFTP adapter** (both directions): `user_password`, `publickey`.
> - **Kafka adapter**: `SASL` (`PLAIN` or `SCRAM-SHA-256`).

| Auth Type | Property Value | Internal XML Value | Use When |
|-----------|---------------|-------------------|----------|
| None | `None` | `None` | No authentication required (or as fallback if other methods fail) |
| Basic | `Basic` | `Basic` | Username/password stored in CPI's Security Material (credential vault). Reference via credential alias. |
| OAuth2 Client Credentials | `OAuth2 Client Credentials` | `OAuth2 Client Credentials` | OAuth2 client_credentials grant. **Requires `proxyType=default`** — never combine with on-premise. |
| Client Certificate | `Client Certificate` | `ClientCertificate` | Mutual TLS / X.509 certificate |
| User Role (Sender SOAP/HTTPS) | `RoleBased` | `RoleBased` | Sender adapter with ESBMessaging.send role. **Use `RoleBased` not `User Role`** — the UI label differs from the XML value. |
| User Name/Password (SFTP) | `user_password` | `user_password` | SFTP adapter. **Use `user_password` not `User Name/Password`**. Credential key is `credential_name` (underscore). Booleans use `0`/`1` not `true`/`false`. |
| Public Key (SFTP) | `publickey` | `publickey` | SFTP adapter key-based authentication. Requires a key pair deployed in the CPI keystore. |
| SASL (Kafka) | `PLAIN` or `SCRAM-SHA-256` | `PLAIN` / `SCRAMSHA256` | Kafka adapter. Use `PLAIN` for simple username/password, `SCRAM-SHA-256` for salted challenge. |

> **Fallback rule:** If authentication configuration causes deployment errors (e.g., missing credential alias, certificate issues), set `authenticationMethod` to `None` as a temporary workaround, inform the user, and log it as a user action item in the completion summary.
> **Proxy Type rule:** Use `default` for internet, `on-premise` or `sapcc` for Cloud Connector. Never use `Internet` or `On-Premise` (capitalized UI labels) — these cause `Invalid value` deployment errors.
> **Proxy + Auth compatibility:** `OAuth2 Client Credentials` requires `proxyType=default` — never combine with on-premise. All other auth types (Basic, ClientCertificate, RoleBased, None) work with both `default` and `on-premise` proxy types.

### Polling Schedule Configuration for Sender Adapters (SFTP, FTP, Mail, etc.)

**Two approaches for polling schedules:**

**Option A — ~~Simple interval polling~~ (DEPRECATED — does not work):**

> **WARNING: `schedulerType=trigger` + `pollInterval` does NOT satisfy CPI's deployment validation.** Deploying with only `schedulerType`+`pollInterval` (without `scheduleKey`) produces: `"Timer is not configured. Please set a schedule"` / `"SFTP Sender doesn't support the Trigger Option null"`. **Always provide a `scheduleKey`** — either externalized as `{{Scheduler}}` (preferred, see Option B) or hardcoded inline with correct double-encoding (for fresh scaffolds per SKILL.md non-negotiable #10).

**Option B — Full schedule control via externalized `scheduleKey`:**

When the user needs cron-based scheduling (specific days, times, timezones), externalize `scheduleKey` as `{{Scheduler}}` on the adapter messageFlow and provide the schedule table in `parameters.prop`. See `./references/guides/scheduler-configuration-guide.md` for ready-to-copy templates.

> **Schedule externalization depends on user preference (Phase A).** If externalizing: use `{{Scheduler}}` in the `.iflw` with the schedule table in `parameters.prop` and `custom:schedule` type in `parameters.propdef`. This works on fresh scaffolds. **After every upload, verify with `get-iflow-content` that `schedule1` contains `&amp;trigger.timeZone` (not bare `&trigger.timeZone`).** If hardcoding: place the full schedule table inline in the `.iflw` XML with `&amp;amp;` double-encoding for the `&` separator. See `scheduler-configuration-guide.md` "schedule1 Format Reference" for encoding rules.

### Timer Schedule Format (Timer Start Events ONLY)

> **Note:** This section applies ONLY to Timer-triggered iFlows (where the StartEvent is a `timerEventDefinition`), NOT to polling sender adapters. For polling adapters, see the Polling Schedule section above.

For Timer Start Events, the `scheduleKey` is placed inside the `<bpmn2:timerEventDefinition>` element (not on a messageFlow). **If the user opted for externalization (Phase A):** use `{{Scheduler}}` and provide the schedule table in `parameters.prop` with type `custom:schedule` in `parameters.propdef`. **If hardcoding:** place the full schedule table inline with `&amp;amp;` double-encoding for the `&` separator.

**Timer schedule externalization (when user opted for it):**
- In `.iflw`: `<ifl:property><key>scheduleKey</key><value>{{Scheduler}}</value></ifl:property>`
- In `parameters.propdef`: `<type>custom:schedule</type>` for the `Scheduler` parameter
- In `parameters.prop`: The full schedule table value

See `./references/guides/scheduler-configuration-guide.md` for ready-to-copy schedule templates (run-once, every N minutes, cron weekdays, etc.).

### Timer-Triggered iFlow Rules

**These rules apply ONLY when the iFlow's StartEvent is a Timer (not for Timer steps mid-flow):**
- **NO Sender Participant** — Do NOT create a `<bpmn2:participant ifl:type="EndpointSender">` element.
- **NO Sender MessageFlow** — Timer adapter config is embedded directly in the `<bpmn2:startEvent>`.
- **StartEvent uses `intermediatetimer`** — cmdVariantUri: `ctype::FlowstepVariant/cname::intermediatetimer/version::1.4.0`. The `activityType` is `StartTimerEvent` inside the `timerEventDefinition` extensionElements.
- **Timer properties on StartEvent** — Schedule config goes in the startEvent's extensionElements, NOT on a message flow.
- **Receiver participants still apply** — External systems called via Request-Reply or End Event still need receiver participants and message flows.

### IDoc/XI-Triggered iFlow Rules

**These rules apply ONLY when the iFlow's sender adapter is IDoc or XI:**
- **Sender Participant required** — Unlike Timer, IDoc/XI iFlows DO have a sender participant (`<bpmn2:participant ifl:type="EndpointSender">`).
- **IDoc sender adapter** — configured on the sender messageFlow with adapter type `IDoc` or `XI`. The cmdVariantUri comes from `./references/metadata/adapters/idoc_sender.json` (or `xi_sender.json`).
- **SAP-specific headers** — IDoc messages carry SAP headers (`SapMessageId`, `SapIDocType`, `SapIDocDbId`). These are set automatically by the IDoc adapter — do NOT manually set them in Content Modifier.
- **Acknowledgment** — IDoc sender can return synchronous acknowledgment to SAP. Set `returnAck=true` on the IDoc sender adapter if SAP expects an acknowledgment. This is a property on the sender messageFlow, not on the iFlow collaboration.
- **On-premise proxy** — IDoc sender from SAP typically uses Cloud Connector. Set `proxyType=on-premise` on the sender adapter.

### Large iFlow Considerations

When an iFlow has 12+ processing steps or 3+ receiver systems:
- **Coordinate layout:** Large iFlows need careful BPMNDiagram coordinates to avoid overlapping elements. Increase horizontal spacing between steps. See `bpmn-generation-guide.md` §7 for layout rules.
- **Consider splitting:** If the iFlow exceeds ~20 steps or has unrelated processing branches, consider splitting into multiple iFlows connected via ProcessDirect or JMS. This improves readability, maintainability, and error isolation.
- **Context management:** When generating BPMN XML for large iFlows, the XML itself may be 500+ lines. Generate incrementally — build the collaboration section first, then each process section, then sequence flows, then the diagram section.
- **Upload strategy:** iFlows with 3+ LIPs typically produce 60-100KB `.iflw` files. **Always write generated BPMN to the `.tmp/` directory** (not just hold in context). In Phase D, use the **sub-agent upload pattern** instead of inlining large content in `update-iflow-content`. See Phase D "Large iFlow Upload Strategy" for the prompt template and error fix loop.
- **Validation priority:** For large iFlows, run Phase C.1 pre-upload validation extra carefully — more steps means more opportunities for sequenceFlow wiring errors, missing IDs, or orphaned elements.

### Phase C.1: Pre-Upload Validation Checklist

Before uploading, validate the generated BPMN XML. **If any check fails, fix and re-validate.**

**XML & Structure:**
- [ ] XML parses without errors (`python -c "import xml.etree.ElementTree as ET; ET.parse('file.iflw')"`)
- [ ] All `sourceRef`/`targetRef` resolve to existing element IDs
- [ ] All `<bpmn2:incoming>`/`<bpmn2:outgoing>` text matches a `sequenceFlow` id
- [ ] `serviceTask` used for ExternalCall, Send, PollEnrich — NOT `callActivity`
- [ ] `parallelGateway` used for Multicast/Join — NOT `exclusiveGateway`
- [ ] EndEvents with receiver messageFlows have `<bpmn2:messageEventDefinition/>`
- [ ] Timer iFlows: NO sender participant, NO sender messageFlow
- [ ] Receiver messageFlow `sourceRef` = ServiceTask (not EndEvent) for Request-Reply/Send adapters
- [ ] **IntegrationProcess participant extensionElements are NOT empty** — every `<bpmn2:participant ifl:type="IntegrationProcess">` MUST have `componentVersion` and `cmdVariantUri` properties (main: `IntegrationProcess/version::1.2.1`, LIP: `LocalIntegrationProcess/version::1.1.3`). Empty `<bpmn2:extensionElements/>` causes "Error while loading" in CPI Web UI.

**BPMNDiagram Completeness (CRITICAL for LIP iFlows):**
- [ ] **Every BPMN element has a BPMNShape** — count all startEvents, endEvents, callActivities, serviceTasks, gateways, subProcesses across ALL processes (main + LIPs + exception subprocesses) and verify the BPMNDiagram has the same count of BPMNShape entries
- [ ] **Every sequenceFlow has a BPMNEdge** — count all sequenceFlows across ALL processes and verify matching BPMNEdge count
- [ ] **Every messageFlow has a BPMNEdge** — including messageFlows from serviceTasks inside LIPs to receiver participants
- [ ] **Every participant has a BPMNShape** — sender, all receivers, main process pool, ALL LIP pools
- [ ] When multiple messageFlows target the same receiver participant (e.g., 3 JMS error channels to one JMS_ErrorQueue), each channel name MUST be unique

> **Programmatic verification (recommended for iFlows with LIPs):** Use Python to count and cross-check:
> ```python
> import xml.etree.ElementTree as ET
> ns = {'b': 'http://www.omg.org/spec/BPMN/20100524/MODEL', 'd': 'http://www.omg.org/spec/BPMN/20100524/DI'}
> tree = ET.parse('file.iflw')
> # Count all BPMN elements that need shapes
> elements = len(tree.findall('.//b:startEvent', ns)) + len(tree.findall('.//b:endEvent', ns)) + \
>            len(tree.findall('.//b:callActivity', ns)) + len(tree.findall('.//b:serviceTask', ns)) + \
>            len(tree.findall('.//b:exclusiveGateway', ns)) + len(tree.findall('.//b:parallelGateway', ns)) + \
>            len(tree.findall('.//b:subProcess', ns)) + len(tree.findall('.//b:participant', ns))
> shapes = len(tree.findall('.//d:BPMNShape', ns))
> seq_flows = len(tree.findall('.//b:sequenceFlow', ns))
> msg_flows = len(tree.findall('.//b:messageFlow', ns))
> edges = len(tree.findall('.//d:BPMNEdge', ns))
> assert shapes == elements, f"BPMNShape mismatch: {shapes} shapes vs {elements} elements"
> assert edges == seq_flows + msg_flows, f"BPMNEdge mismatch: {edges} edges vs {seq_flows + msg_flows} flows"
> ```

**Adapter Channels:**
- [ ] Every messageFlow has ALL 12 standard channel properties: `ComponentType`, `ComponentNS`, `ComponentSWCVName`, `ComponentSWCVId`, `TransportProtocol`, `TransportProtocolVersion`, `MessageProtocol`, `MessageProtocolVersion`, `Name`, `direction`, `system`, `cmdVariantUri`
- [ ] `ComponentNS`/`ComponentSWCVName`/`ComponentSWCVId` values from the correct adapter metadata JSON (not copied from a different adapter)
- [ ] ALL adapter-specific properties present (read from metadata JSON — never omit to "simplify")
- [ ] Adapter type vs step wiring correct per Wiring Lookup Table (ExternalCall vs Send)
- [ ] Channel `Name` = bare adapter type (`HTTP`, `SFTP` — not `HTTP_Supplier`)
- [ ] Participant names have no spaces (`SAP_S4HANA` not `SAP S4HANA`)

**Files & Parameters:**
- [ ] Every `<key>script</key><value>X.groovy</value>` has matching file in zip (case-sensitive)
- [ ] Every `mappinguri` has matching file at referenced path
- [ ] Every `{{param}}` has entries in both `parameters.prop` and `parameters.propdef`
- [ ] `parameters.propdef` is valid XML format (not Java properties)
- [ ] `<param_references>` has a `<reference>` for every `{{param}}` in adapter messageFlow properties
- [ ] Credential aliases listed as user action items
- [ ] OAuth2 uses `proxyType=default` (never combine with on-premise)
- [ ] **Schedule encoding**: After upload, verify `schedule1` in `parameters.prop` contains `&amp;trigger.timeZone` (not bare `&trigger.timeZone`) via `get-iflow-content`
- [ ] `scheduleKey` on polling adapters externalized as `{{Scheduler}}` (never hardcoded)
- [ ] `cmdVariantUri` values from metadata files (not from memory)
- [ ] All endpoints/credentials/timeouts externalized as `{{paramName}}`

**Structural Safety:**
- [ ] No circular Process Call chains (trace full call chain)
- [ ] ProcessDirect: callee iFlow deployed before caller, addresses match exactly
- [ ] Data Store Write: payload under 10MB (add Splitter if needed)
- [ ] Script Collection: `scriptBundleId` matches exactly, SC deployed first

> **Note:** After upload, `get-iflow-build-errors` runs as Phase D step 5 for server-side validation before proceeding to Phase E deployment.

### Phase C.1b: Multi-Artifact Generation Order

When Phase A identified multiple artifacts (`MULTI_ARTIFACT=true`), generate them in **deployment dependency order** (same as Phase C.2 deploy order):
1. Generate standalone Message Mappings first (no dependencies)
2. Generate iFlows that are called by OTHER iFlows (e.g., ProcessDirect receiver sub-flows)
3. Generate iFlows that call other iFlows (e.g., main orchestrator iFlow)

This ensures each artifact can reference the correct IDs and endpoints of its dependencies. For each artifact, run Phase C Generation Steps (steps 1-7) and Phase C.1 Pre-Upload Validation independently.

### Phase C.2: Multi-Artifact Dependency Resolution

Deploy artifacts in this order:
1. Message Mappings (standalone artifacts, no dependencies)
2. Integration Flows that are called by OTHER iFlows (e.g., sub-flows invoked via ProcessDirect)
3. Integration Flows that call other iFlows (e.g., router/orchestrator iFlows)

> **ProcessDirect chain rule:** If iFlow A calls iFlow B via ProcessDirect, deploy B first. Deploy leaf iFlows before their callers. Before deploying the caller, verify the target iFlow is already deployed AND its ProcessDirect sender address matches exactly (e.g., both use `/myEndpoint` — not `/myendpoint` or `/my-endpoint`).

### BPMN Structure Anti-Patterns — Avoid These

| Anti-Pattern | Why | Correct Approach |
|-------------|-----|-----------------|
| Wire EndEvent to any receiver needing Request-Reply | Deployment fails — see Receiver Adapter Wiring Rules | Use `serviceTask` (ExternalCall) with messageFlow from ServiceTask to receiver |
| Use `callActivity` for Request-Reply/Send | Wrong BPMN element | Use `serviceTask` (seed ID: `ServiceTask_`) for ExternalCall and Send steps |
| Use descriptive channel Name like `HTTP_Supplier` | CPI expects bare adapter type name | Use `HTTP`, `SOAP`, `SFTP` etc. as the Name property |
| Hardcode credentials in XML | Security violation | Use externalized `{{paramName}}` aliases |
| Skip parameter externalization | Can't configure per environment | Externalize endpoints, credentials, timeouts |
| Omit adapter properties from template | Causes `Mandatory property missing` errors | Copy ALL properties from bpmn-generation-guide template — never omit to "simplify" |
| Use UI labels for auth/proxy values | `Invalid value` deployment errors | Use internal XML values: `RoleBased` not `User Role`, `user_password` not `User Name/Password`, `default` not `Internet` |
| Send JSON to receiver without Content-Type | `Unsupported media type` error | Add Content Modifier before receiver to set `Content-Type: application/json` |


> **Phase gate:** Output: "Phase C complete — generated {N} files for {ArtifactId}. Reading phase-d-upload.md."
> Then: Read `./references/phases/phase-d-upload.md` before proceeding to Phase D.
