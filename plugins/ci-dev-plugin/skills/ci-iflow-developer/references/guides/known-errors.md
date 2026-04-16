# Known Errors — SAP CPI Deployment & Runtime

**Usage:** Grep this file for the exact error string to get a deterministic fix.
When encountering a deployment or runtime error:
1. Grep for the key part of the error message against this file
2. If matched: apply the documented fix directly
3. If not matched: use `get-deploy-error`, `get-iflow-build-errors`, `get-messages` to investigate, then append a DISCOVERED entry

When appending new entries: use `## Error:` heading with the exact error string as the title, add Phase/Root Cause/Fix/Grep key.

---

## Error: "Credential not found" / "Could not find credential for alias"

- **Phase:** E (deploy) or runtime
- **Root Cause:** The iFlow references a credential alias that does not exist in the Security Material store
- **Fix:** MCP server cannot create credentials. Inform user to create the credential in CPI Security Material store with the missing alias name. Provide alias name and credential type (User Credentials, OAuth2 Client Credentials, etc.)
- **Grep key:** `credential for alias`, `Credential not found`

---

## Error: "Error parsing BPMN XML" / "Failed to parse integration flow definition"

- **Phase:** D (upload) or E (deploy)
- **Root Cause:** Malformed XML in the `.iflw` file — missing closing tags, invalid namespace prefixes, or unescaped special characters in property values
- **Fix:** Validate XML well-formedness. Check for unescaped `<`, `>`, `&` in `ifl:property` values. Ensure all namespace declarations are present on root element.
- **Grep key:** `Error parsing BPMN`, `Failed to parse integration flow`

---

## Error: "Mandatory property '{property}' is missing" / "Missing required adapter attribute"

- **Phase:** E (deploy) or runtime
- **Root Cause:** An adapter is missing a required configuration property in its message flow element
- **Fix:** Add the missing property as an `<ifl:property>` inside the `<bpmn2:messageFlow>` extensionElements. Read `./references/metadata/adapters/{adapter}_{direction}.json` to find mandatory property keys.
- **Grep key:** `Mandatory property`, `Missing required adapter`

---

## Error: "Package not found" / "IntegrationPackage with Id '{id}' not found"

- **Phase:** D (upload)
- **Root Cause:** The target package does not exist on the tenant
- **Fix:** Create the package first using `create-package` with required Id, Name, and Version fields before uploading the artifact.
- **Grep key:** `Package not found`, `IntegrationPackage with Id`

---

## Error: "HTTP 409 Conflict" / "artifact is locked by another user" / "Entity is locked"

- **Phase:** D (upload) or E (deploy)
- **Root Cause:** Another user or process has locked the artifact (e.g., iFlow open in Web UI designer)
- **Fix:** Inform user that the artifact is locked. Cannot proceed until the lock is released. Do NOT force-overwrite.
- **Grep key:** `409 Conflict`, `artifact is locked`, `Entity is locked`

---

## Error: "Invalid URL format" / "Malformed endpoint address"

- **Phase:** E (deploy) or runtime
- **Root Cause:** Receiver adapter's `httpAddressWithoutQuery` contains invalid URL (missing protocol, spaces, or template variable not resolved)
- **Fix:** Ensure URLs are properly formatted. If using externalized parameters, verify `{{paramName}}` syntax (double curly braces). Verify parameters.prop has correct default value.
- **Grep key:** `Invalid URL format`, `Malformed endpoint`

---

## Error: "Script resource not found" / "Referenced script does not exist"

- **Phase:** E (deploy) or runtime
- **Root Cause:** The `.iflw` references a Groovy/JS script file not included in the zip at `src/main/resources/script/`
- **Fix:** Add the missing script file to the zip. Verify `<key>script</key><value>{filename}</value>` in callActivity matches actual filename (case-sensitive) in the script directory.
- **Grep key:** `Script resource not found`, `Referenced script does not exist`

---

## Error: "Version conflict" / "Artifact version mismatch" / "ETag mismatch"

- **Phase:** D (upload)
- **Root Cause:** Attempting to update an artifact whose version has changed since last read (optimistic locking conflict)
- **Fix:** Re-read the artifact with `get-iflow-content` to get the current version, then retry with `update-iflow-content`.
- **Grep key:** `Version conflict`, `ETag mismatch`, `version mismatch`

---

## Error: "Bundle-SymbolicName mismatch" / "Artifact Id in MANIFEST.MF does not match"

- **Phase:** D (upload) or E (deploy)
- **Root Cause:** `Bundle-SymbolicName` in MANIFEST.MF does not match the `Id` field in the API call
- **Fix:** Ensure `Bundle-SymbolicName` in MANIFEST.MF exactly matches the artifact Id used in the API call. Remove any `; singleton:=true` suffix when comparing.
- **Grep key:** `Bundle-SymbolicName`, `Artifact Id in MANIFEST`

---

## Error: "Deploy failed: FAIL" (no specific error in deploy status)

- **Phase:** E (deploy)
- **Root Cause:** Generic deployment failure — deploy tool only returns FAIL status
- **Fix:** Call `get-deploy-error` to get the detailed error message. Also check `get-messages` filtered by the iFlow artifact ID for runtime error information.
- **Grep key:** `Deploy failed`, `deploy status FAIL`

---

## Error: "HTTP 400 Bad Request" on artifact creation

- **Phase:** D (upload)
- **Root Cause:** Request body is malformed — base64 content corrupted, wrong zip structure, or required fields (Id, Name, PackageId) missing
- **Fix:** Verify: (1) zip contains `META-INF/MANIFEST.MF` at root, (2) base64 encoding has no line breaks (`base64 -w 0`), (3) all required fields present. Use `scaffold-iflow` to create, then `update-iflow-content` to upload content.
- **Grep key:** `HTTP 400`, `Bad Request`

---

## Error: "Mapping resource not found" / "Cannot resolve mapping reference"

- **Phase:** E (deploy) or runtime
- **Root Cause:** The `.iflw` references a mapping file not in the zip or with mismatched `mappinguri`
- **Fix:** Verify `mappinguri` follows format `dir://mapping/{artifact-id}/src/main/resources/mapping/{filename}`. Ensure referenced file exists in zip at `src/main/resources/mapping/`.
- **Grep key:** `Mapping resource not found`, `Cannot resolve mapping`

---

## Error: "Cannot find ScriptCollection '{bundleId}'"

- **Phase:** E (deploy)
- **Root Cause:** A Groovy Script step references an external Script Collection not deployed or with a different Id
- **Fix:** Deploy the Script Collection artifact first. Verify `scriptBundleId` matches the Script Collection's artifact Id exactly. Add `Require-Capability` to MANIFEST.MF.
- **Grep key:** `Cannot find ScriptCollection`

---

## Error: "HTTP 403 Forbidden" on create or deploy operations

- **Phase:** D (upload) or E (deploy)
- **Root Cause:** API user/credentials lack required role assignments (e.g., missing `AuthGroup.IntegrationDeveloper`)
- **Fix:** Tenant permissions issue — cannot be fixed by the skill. Inform user to check role assignments in BTP cockpit.
- **Grep key:** `HTTP 403`, `Forbidden`

---

## Error: "Duplicate artifact Id" / "Artifact already exists"

- **Phase:** D (upload)
- **Root Cause:** Attempting to create an artifact with an Id that already exists in the package
- **Fix:** Use `update-iflow-content` instead of `scaffold-iflow`, or choose a different artifact Id.
- **Grep key:** `Duplicate artifact Id`, `already exists`

---

## Error: "Invalid cmdVariantUri" / "Unknown flow step variant"

- **Phase:** D (upload) or E (deploy)
- **Root Cause:** The `cmdVariantUri` on a callActivity, messageFlow, or process element contains an unrecognized variant string
- **Fix:** Read the step's distilled JSON from `./references/metadata/steps/{step}.json` for the exact cmdVariantUri. Common mistake: wrong version suffix.
- **Grep key:** `Invalid cmdVariantUri`, `Unknown flow step variant`

---

## Error: "Sequence flow target not found" / "Cannot resolve targetRef"

- **Phase:** D (upload) or E (deploy)
- **Root Cause:** A `<bpmn2:sequenceFlow>` has a `targetRef` pointing to an element ID that does not exist
- **Fix:** Verify all sequenceFlow `sourceRef` and `targetRef` values match actual element IDs. Run pre-upload validation.
- **Grep key:** `Sequence flow target not found`, `Cannot resolve targetRef`

---

## Error: "MANIFEST.MF: line too long" / "Invalid manifest format"

- **Phase:** D (upload)
- **Root Cause:** MANIFEST.MF has lines exceeding 72-byte limit, or continuation lines don't start with a space
- **Fix:** Wrap lines at 72 bytes. Continuation lines must begin with exactly one space. File must end with newline. No blank lines between headers.
- **Grep key:** `line too long`, `Invalid manifest format`

---

## Error: "Timeout during deployment" / deploy status stuck in DEPLOYING

- **Phase:** E (deploy)
- **Root Cause:** Deployment task hasn't completed within expected timeframe (deploy-iflow auto-polls up to 5 minutes)
- **Fix:** If `deploy-iflow` returns TIMEOUT, tenant may have deployment queue backlog. Inform user to check CPI Operations view. Retry `deploy-iflow` after a few minutes.
- **Grep key:** `Timeout during deployment`, `stuck in DEPLOYING`

---

## Error: "Content-Type not supported" / "Unsupported media type"

- **Phase:** Runtime
- **Root Cause:** Receiver endpoint rejected the message because Content-Type header doesn't match expectations
- **Fix:** Add a Content Modifier step before the receiver to set the correct `Content-Type` header (e.g., `application/json`, `application/xml`).
- **Grep key:** `Content-Type not supported`, `Unsupported media type`

---

## Error: "Certificate expired" / "SSL handshake failed" / "PKIX path validation failed"

- **Phase:** Runtime
- **Root Cause:** SSL certificate for the receiver endpoint has expired or is not trusted by the CPI keystore
- **Fix:** Tenant infrastructure issue — MCP server does not manage certificates. Inform user to check and update the certificate in CPI keystore via Web UI.
- **Grep key:** `Certificate expired`, `SSL handshake failed`, `PKIX path`

---

## Error: "JMS queue '{name}' not found" / "Queue does not exist"

- **Phase:** Runtime
- **Root Cause:** iFlow references a JMS queue name that hasn't been created on the tenant
- **Fix:** JMS queues may be auto-created on first use. If not, user must create the queue via CPI Operations > Message Queues UI. Cannot create queues via API.
- **Grep key:** `JMS queue`, `Queue does not exist`

---

## Error: "Data store entry too large" / "Payload exceeds size limit"

- **Phase:** Runtime
- **Root Cause:** Attempting to write a message body to Data Store that exceeds the 10MB limit
- **Fix:** Split large payloads before writing to Data Store. Consider using the Splitter step or alternative persistence (SFTP, external DB).
- **Grep key:** `Data store entry too large`, `Payload exceeds size limit`

---

## Error: "Process Direct endpoint '{address}' not found"

- **Phase:** Runtime
- **Root Cause:** A ProcessDirect receiver references an endpoint address that no deployed iFlow exposes
- **Fix:** Verify the target iFlow is deployed and its ProcessDirect sender adapter uses the exact same `address` value. Both iFlows must be deployed on the same tenant.
- **Grep key:** `Process Direct endpoint`, `not found`

---

## Error: "Circular reference detected" / "Infinite loop in process call"

- **Phase:** E (deploy) or runtime
- **Root Cause:** A Local Integration Process calls itself (directly or indirectly)
- **Fix:** Review the process call chain. Ensure no circular dependencies between Local Integration Processes.
- **Grep key:** `Circular reference`, `Infinite loop in process call`

---

## Error: "Failed to extract zip content" (backslash path separators)

- **Phase:** D (upload)
- **Root Cause:** Zip file contains entry paths with backslashes (e.g., `META-INF\MANIFEST.MF`) instead of forward slashes. PowerShell's `Compress-Archive` on Windows writes backslash separators. CPI's zip parser only understands forward-slash paths.
- **Fix:** Recreate the zip using Python's `zipfile` module with `.replace(os.sep, '/')` on each archive entry name, or use Unix `zip` command. **Never use PowerShell `Compress-Archive`.**
- **Grep key:** `Failed to extract zip`
- **Category:** DISCOVERED — 2026-03-15

---

## Error: "Invalid value 'on-premise' entered in 'Proxy Type' field" / "Attribute 'Credential Name' is mandatory"

- **Phase:** E (deploy)
- **Root Cause:** When `proxyType` is `on-premise`, authentication methods like `Basic` require a valid credential alias. If the credential doesn't exist on the tenant, deployment fails.
- **Fix:** As temporary workaround, set `authenticationMethod` to `None` and `proxyType` to `default`. Document the credential setup as a user action item. Only use `on-premise` proxy when Cloud Connector is configured on the tenant.
- **Grep key:** `on-premise`, `Proxy Type`, `Credential Name is mandatory`
- **Category:** DISCOVERED — 2026-03-20

---

## Error: "Invalid value 'OAuth2 Client Credentials' entered in 'Authentication' field"

- **Phase:** E (deploy)
- **Root Cause:** `authenticationMethod=OAuth2 Client Credentials` is only valid when `proxyType=default`. Fails when combined with `on-premise` proxy or when OAuth2 credential artifact doesn't exist.
- **Fix:** Ensure `proxyType=default` when using `OAuth2 Client Credentials`. Create the OAuth2 credential artifact in Security Material before deploying. As fallback, use `authenticationMethod=None` temporarily.
- **Grep key:** `OAuth2 Client Credentials`, `Authentication field`
- **Category:** DISCOVERED — 2026-03-20

---

## Error: "Error while loading the details of the integration flow" (after uploading parameters files)

- **Phase:** D (upload) / UI rendering
- **Root Cause:** **NOT caused by uploading `parameters.prop`/`parameters.propdef` to a fresh scaffold.** Testing confirmed that uploading these files to fresh scaffolds works correctly for Timer (SIMPLE), SFTP (DAILY), and SFTP (ADVANCED) schedules — as long as the `&amp;` encoding in `schedule1` is preserved. The actual root cause is **`&amp;` in the `schedule1` value getting decoded to bare `&` during the upload pipeline.** When the `.prop` file content is passed through shell interpolation or an intermediate LLM layer (e.g., `claude --print`), `&amp;` may be decoded to `&`. CPI's Web UI parser then sees `&trigger.timeZone` as a malformed XML entity reference inside the schedule table, causing the "Error while loading" message. The iFlow still deploys and runs correctly at runtime — only the Web UI designer view is broken.
- **Fix:** Ensure `&amp;` in the `schedule1` cell is preserved as literal `&amp;` (5 characters: `&` `a` `m` `p` `;`) in the uploaded `parameters.prop` file. After uploading, verify with `get-iflow-content` that the `schedule1` value on the server contains `&amp;trigger.timeZone` (not `&trigger.timeZone`). If `&amp;` was decoded, re-upload the `.prop` file with explicit instructions to preserve the literal `&amp;` entity.
- **Verification:** Three schedule types tested on fresh scaffolds with `parameters.prop`/`parameters.propdef`:
  - Timer SIMPLE (every 5 min): Deploy SUCCESS, UI SUCCESS
  - SFTP DAILY (every 5 min interval): Deploy SUCCESS, UI SUCCESS
  - SFTP ADVANCED (weekdays 9 AM cron): Deploy SUCCESS, UI SUCCESS (after `&amp;` fix)
- **Grep key:** `Error while loading the details of the integration flow`
- **Category:** CORRECTED — 2026-04-13 (original: DISCOVERED 2026-03-23, root cause was misidentified as fresh-scaffold upload issue)

---

## Error: Exception Subprocess renders as empty box in CPI Web UI

- **Phase:** C (generation) — structural error
- **Root Cause:** Three combined BPMN issues: (1) `triggeredByEvent="true"` attribute on `<bpmn2:subProcess>`, (2) Using `EscalationEndEvent`/`escalationEventDefinition` instead of `ErrorEndEvent`/`errorEventDefinition`, (3) Missing `activityType=ErrorEventSubProcessTemplate` property on the subProcess element.
- **Fix:** Remove `triggeredByEvent="true"` from subProcess. Use `errorEventDefinition` with `ErrorEndEvent` (not escalation). Include `activityType=ErrorEventSubProcessTemplate` property. See §4.6 of bpmn-generation-guide.md for the correct XML.
- **Grep key:** `empty box`, `Exception SubProcess`, `SubProcess renders`
- **Category:** DISCOVERED — 2026-03-24

---

## Error: "Integration flow project must contain only one integration flow"

- **Phase:** D (upload)
- **Root Cause:** Two `.iflw` files in the ZIP — happened because a new file was created instead of using the scaffolded filename
- **Fix:** Always call `get-iflow-content` after `scaffold-iflow` to discover the exact `.iflw` filename. Use that exact filename when writing the artifact. Never create a new `.iflw` file when updating an existing scaffold.
- **Grep key:** `must contain only one integration flow`
- **Category:** KNOWN

---

## Error: "parameters.propdef" causes "Error while loading" (wrong format)

- **Phase:** D (upload)
- **Root Cause:** `parameters.propdef` file is in Java properties format instead of XML format
- **Fix:** `parameters.propdef` MUST be XML format. See §10 of bpmn-generation-guide.md for the correct XML schema. Java properties format causes "Error while loading the details of the integration flow" in the Web UI.
- **Grep key:** `parameters.propdef`, `Error while loading`
- **Category:** KNOWN

---

## Error: "Cannot resolve processRef" or "Invalid process reference"

- **Phase:** E (deploy)
- **Root Cause:** A Process Call step references a Local Integration Process (LIP) by `processId` that does not exist in the `.iflw` file. The `processId` property on the `callActivity` does not match any `<bpmn2:process id="...">` element.
- **Fix:** Verify the `processId` value on the Process Call `callActivity` exactly matches a `<bpmn2:process>` element ID in the same `.iflw` file. Check for typos, case mismatches, and ensure the LIP process element exists.
- **Grep key:** `Cannot resolve processRef`, `Invalid process reference`, `processId`
- **Category:** KNOWN

---

## Error: "Invalid adapter variant" or malformed cmdVariantUri

- **Phase:** E (deploy)
- **Root Cause:** The `cmdVariantUri` property on a step or adapter messageFlow has an incorrect format. Expected format: `ctype::FlowstepVariant/cname::{Name}/version::{X.Y.Z}` for steps, `ctype::AdapterVariant/cname::{Name}/vendor::sap/tp::{Protocol}/mp::Not Applicable/direction::{Sender|Receiver}/version::{X.Y.Z}` for adapters.
- **Fix:** Read the correct URI from the distilled metadata file: `./references/metadata/adapters/{adapter}_{direction}.json` or `./references/metadata/steps/{step}.json`. Copy the exact `cmdVariantUri` or `adapterVariantURI` value.
- **Grep key:** `Invalid adapter variant`, `cmdVariantUri`, `Invalid variant`
- **Category:** KNOWN

---

## Error: "Connection timed out" or receiver system timeout

- **Phase:** E (runtime)
- **Root Cause:** The receiver system is unreachable or responding too slowly. Common causes: wrong endpoint URL, firewall blocking, Cloud Connector not running (for on-premise systems), or receiver system down.
- **Fix:** (1) Verify the receiver endpoint URL is correct and accessible. (2) For on-premise systems, verify Cloud Connector is running and the virtual host mapping is correct. (3) Increase the `httpReadTimeout` adapter property if the receiver is slow. (4) Check proxy settings (`proxyType` = `default` for internet, `on-premise` for Cloud Connector).
- **Grep key:** `Connection timed out`, `Read timed out`, `ConnectException`
- **Category:** INFRASTRUCTURE

---

## Error: Router with no matching condition (default route missing)

- **Phase:** E (runtime)
- **Root Cause:** A content-based Router (`exclusiveGateway`) received a message that does not match any route condition, and no default route was defined.
- **Fix:** Add a default route — one outgoing `sequenceFlow` from the `exclusiveGateway` with no `conditionExpression` (or condition set to `otherwise`). This acts as the fallback for unmatched messages.
- **Grep key:** `No route matched`, `No matching condition`, `exclusiveGateway`
- **Category:** KNOWN

---

## Error: "Empty iterator" or Splitter produces no splits

- **Phase:** E (runtime)
- **Root Cause:** The Splitter's XPath expression evaluated on the message body returned zero elements. The message structure does not match the expected XML path.
- **Fix:** (1) Verify the Splitter's XPath expression matches the actual message structure. (2) If the message is JSON, ensure a JSON-to-XML Converter is placed BEFORE the Splitter. (3) Check namespace declarations in the XPath if the XML uses namespaces.
- **Grep key:** `Empty iterator`, `Splitter`, `No elements found`
- **Category:** KNOWN

---

## Error: Credential type mismatch (wrong credential on adapter)

- **Phase:** E (deploy or runtime)
- **Root Cause:** The credential alias configured on the adapter points to a credential of the wrong type. For example, an OAuth2 Client Credentials credential alias used on an adapter configured with `authenticationMethod=Basic`, or vice versa.
- **Fix:** (1) Verify the adapter's `authenticationMethod` matches the type of credential stored in CPI Security Material. (2) Basic auth needs a Username-Password credential. OAuth2 needs an OAuth2 Client Credentials credential. (3) Create the correct credential type in the CPI Web UI under Security Material.
- **Grep key:** `Unsupported credential type`, `credential`, `authentication`
- **Category:** CONFIGURATION

---

## Error: "Maximum processing time exceeded" (global timeout)

- **Phase:** E (runtime)
- **Root Cause:** The iFlow execution exceeded the global processing time limit. CPI enforces: ~5 minutes for synchronous (HTTPS/SOAP-triggered) iFlows, ~30 minutes for asynchronous iFlows. Long-running transformations, slow receivers, or retry loops can trigger this.
- **Fix:** (1) For sync iFlows: reduce processing time by optimizing transformations, reducing receiver call count, or switching to async pattern. (2) For async iFlows: split large batches into smaller messages, add timeout properties on receiver adapters, or decouple via JMS for very long operations.
- **Grep key:** `Maximum processing time exceeded`, `MPL_PROCESSING_DURATION`, `timeout`
- **Category:** INFRASTRUCTURE

---

## Error: "Stream after migration is null" on .mmap file validation

- **Phase:** D (build validation via `get-iflow-build-errors`)
- **Root Cause:** The `.mmap` file uses an incorrect custom XML format instead of the SAP XI/PI proprietary `xiObj`/`tr:XiTrafo` format that CPI's mapping migration tool expects. CPI tries to migrate/parse the `.mmap` on validation and gets a null stream.
- **Fix:** Replace the `.mmap` content with the correct `xiObj`/`tr:XiTrafo` format. See `bpmn-generation-guide.md §5b` for the complete copy-ready template and worked example. The format is identical for both in-iFlow mappings (`src/main/resources/mapping/`) and standalone Message Mapping artifacts.
- **Note:** When `get-iflow-build-errors` returns "Unable to parse validation response" with raw content "Check execution result: Passed" — this is a **false alarm**. The MCP server fails to parse clean results. The artifact is valid; proceed to deploy.
- **Grep key:** `Stream after migration is null`, `Validation of Message Mapping`, `Validation Exception`
- **Category:** DISCOVERED — 2026-04-10

---

## Error: "Enter adapter details for channel" (missing channel metadata)

- **Phase:** E (deploy)
- **Root Cause:** The adapter messageFlow is missing standard channel metadata properties (`ComponentNS`, `ComponentSWCVName`, `ComponentSWCVId`, `TransportProtocolVersion`, `MessageProtocolVersion`). Without these, CPI cannot resolve the adapter component and treats the channel as unconfigured. Also occurs when these properties have values copied from a different adapter type (e.g., OData values on a Mail adapter). Can also be caused by using the wrong `attribute_id` format in `parameters.propdef` `<param_references>` — receiver adapter references must use the FULL `ctype::AdapterVariant/.../attrId::{key}` format, while sender adapter references must use the SHORT `/attrId::{key}` format. Mixing these formats may cause parameter binding failures.
- **Fix:** (1) Read the correct values from `./references/metadata/adapters/{adapter}_{direction}.json`. (2) Add all standard channel properties to the messageFlow: `ComponentType`, `ComponentNS`, `ComponentSWCVName`, `ComponentSWCVId`, `TransportProtocol`, `TransportProtocolVersion`, `MessageProtocol`, `MessageProtocolVersion`, `Name`, `direction`, `system`, `cmdVariantUri`. (3) Verify `ComponentSWCVId` matches the adapter's `TransportProtocolVersion`, not the componentVersion of a different adapter.
- **Grep key:** `Enter adapter details for channel`, `adapter details`, `channel`
- **Category:** DISCOVERED — 2026-04-11

---

## Error: "GenerationFailed" with no field-level details (stale artifact state)

- **Phase:** E (deploy)
- **Root Cause:** After multiple failed deployment attempts (5+), the CPI deploy API may stop returning field-level validation errors and only return the generic `GenerationFailed` message. The artifact enters a stale state where error diagnostics degrade.
- **Fix:** (1) Create a fresh artifact using `scaffold-iflow` with a new ID (e.g., append `_v2`). (2) Deploy the empty scaffold first to confirm the environment is healthy. (3) Upload the BPMN content to the new artifact — CPI will now return specific error messages. (4) Delete the stale artifact after the new one deploys successfully.
- **Grep key:** `GenerationFailed`, `generation and build of the artifact were unsuccessful`
- **Category:** DISCOVERED — 2026-04-11

---

## Error: Deployment failure from hand-crafted MANIFEST.MF

- **Phase:** E (deploy)
- **Root Cause:** The MANIFEST.MF was generated manually with `Import-Package` entries that include version constraints (e.g., `org.apache.camel;version="2.8"`) and/or `Import-Service` headers that don't match the CPI tenant's expected format. The scaffold-generated MANIFEST.MF uses a different (simpler) format without version constraints on some tenants.
- **Fix:** Do NOT overwrite the scaffolded MANIFEST.MF. Use it as-is. If you need to add `Require-Capability`, append only that header. If the MANIFEST.MF was already overwritten: (1) scaffold a new artifact, (2) `get-iflow-content` to retrieve the scaffold's MANIFEST.MF, (3) use that as the base.
- **Grep key:** `GenerationFailed`, `Import-Package`, `MANIFEST`
- **Category:** DISCOVERED — 2026-04-11

---

## Error: "GenerationFailed" from scaffold-template structural mismatch

- **Phase:** E (deploy)
- **Root Cause:** The `.iflw` XML was generated purely from minimal-iflow templates, which lack structural boilerplate the live CPI scaffold includes (`targetNamespace`, `documentation`, participant `cmdVariantUri`/`componentVersion`, additional collaboration properties like `privateKeyAlias`, `traceLevel`, `errorStrategy`). Replacing the scaffold XML with template-derived XML causes CPI to reject it with a generic `GenerationFailed` error.
- **Fix:** Use scaffold-first workflow: (1) `scaffold-iflow`, (2) `get-iflow-content` to read the scaffold's `.iflw`, (3) extract structural boilerplate (`<bpmn2:definitions>` attributes, `<bpmn2:collaboration>` extensionElements, `<bpmn2:documentation>`, participant properties), (4) generate custom content using templates, (5) merge custom content into the scaffold's structural shell. See `bpmn-generation-guide.md` §0.
- **Proof:** Re-uploading the exact scaffold XML deployed successfully. Uploading template-derived XML with identical logic failed.
- **Grep key:** `GenerationFailed`, `scaffold structure`, `structural mismatch`, `template mismatch`
- **Category:** DISCOVERED — 2026-04-11

---

## Error Diagnosis Workflow

When encountering an error not matched above:
1. Call `get-deploy-error` for deployment-level errors
2. Call `get-iflow-build-errors` for build validation errors
3. Call `get-messages` filtered by artifact ID for runtime errors
4. Read the `.iflw` XML via `get-iflow-content` for structural issues
5. Check adapter property keys via `Read ./references/metadata/adapters/{adapter}_{direction}.json`
6. After resolving: append a DISCOVERED entry to this file

---

## Error: "SAXParseException" / "Error while loading" caused by `&amp;` decoding in `schedule1` value

- **Phase:** D (build validation) / E (deploy) / UI rendering
- **Root Cause:** The `schedule1` cell in the `scheduleKey` schedule table contains a bare `&` instead of `&amp;` before `trigger.timeZone`. This happens in TWO contexts:
  - **In `parameters.prop` files:** The `&amp;` entity (literal 5-character text `&amp;`) gets decoded to bare `&` during the upload pipeline — typically when file content passes through shell interpolation or an intermediate LLM process (e.g., `claude --print`). CPI's Web UI parser sees `&trigger.timeZone` as a malformed XML entity reference inside the schedule table, causing "Error while loading the details of the integration flow".
  - **In inline `.iflw` XML** (hardcoded `scheduleKey`): Using `&amp;` gets XML-decoded to bare `&` at parse time. Inline XML requires `&amp;amp;` (double XML-encoded) so that XML parsing yields `&amp;`, which the scheduler parser reads correctly. Using single `&amp;` causes `SAXParseException: The element type "row" must be terminated by the matching end-tag`.
- **Symptoms:** "Error while loading the details of the integration flow" in Web UI, OR `SAXParseException` / `GenerationFailed` during build/deploy. The iFlow may deploy and run correctly at runtime — only the Web UI designer view is broken.
- **Fix:**
  - **For `parameters.prop`** (preferred approach): Ensure `&amp;` is preserved as literal `&amp;` (5 characters) in the uploaded file. After uploading, **always verify** with `get-iflow-content` that `schedule1` contains `&amp;trigger.timeZone` not `&trigger.timeZone`. If decoded, re-upload with explicit encoding preservation instructions.
  - **For inline `.iflw` XML** (hardcoded scheduleKey on fresh scaffolds): Use `&amp;amp;` (double-encoded) in the `schedule1` cell. Copy from minimal-iflow templates (`.iflw` files which use `&amp;amp;`), NOT from `.prop` templates (which use `&amp;`). Example: `&lt;cell&gt;0+0/5+0-23+?+*+*+*&amp;amp;trigger.timeZone=Etc/GMT&lt;/cell&gt;`
- **Testing:** Verified on fresh scaffolds with `parameters.prop`/`parameters.propdef` upload:
  - Timer SIMPLE (every 5 min): Deploy SUCCESS, UI SUCCESS
  - SFTP DAILY (every 5 min interval): Deploy SUCCESS, UI SUCCESS
  - SFTP ADVANCED (weekdays 9 AM cron): Deploy SUCCESS, UI FAILED (bare `&`) → UI SUCCESS (after `&amp;` fix)
- **Grep key:** `SAXParseException`, `element type "row"`, `matching end-tag`, `scheduleKey`, `&amp;trigger`, `Error while loading`
- **Category:** DISCOVERED — 2026-04-13

---

## Error: "Error while loading" caused by incomplete BPMNDiagram for Local Integration Processes

- **Phase:** D (upload) / UI rendering
- **Root Cause:** Two combined defects when generating iFlows with Local Integration Processes (LIPs):
  1. **Missing BPMNDiagram shapes/edges for LIP elements:** The `<bpmndi:BPMNDiagram>` section only contained shapes and edges for the main Integration Process pool and top-level participants. All elements inside LIPs (startEvents, callActivities, serviceTasks, endEvents, subProcesses, sequenceFlows) were missing their BPMNShape and BPMNEdge entries. CPI's Web UI requires a shape for every BPMN element to render the designer view.
  2. **Empty `<bpmn2:extensionElements/>` on IntegrationProcess participants:** All `<bpmn2:participant ifl:type="IntegrationProcess">` elements had self-closing empty `<bpmn2:extensionElements/>` instead of containing the required `componentVersion` and `cmdVariantUri` properties. Main process participants need `IntegrationProcess/version::1.2.1`, LIP participants need `LocalIntegrationProcess/version::1.1.3`.
- **Symptoms:** "Error while loading the details of the integration flow" in the CPI Web UI. The iFlow deploys and runs successfully at runtime — only the Web UI designer view is broken.
- **Fix:**
  1. Add BPMNShape entries for every element inside every LIP (including exception subprocess elements). Add BPMNEdge entries for every sequenceFlow inside every LIP.
  2. Add `componentVersion` and `cmdVariantUri` properties to all IntegrationProcess participant extensionElements. Never use empty `<bpmn2:extensionElements/>`.
  See bpmn-generation-guide.md §3.2 for correct participant XML and §7 for the Complete Diagram Coverage Rule.
- **Grep key:** `Error while loading`, `Local Integration Process`, `LIP`, `BPMNDiagram`, `BPMNShape`
- **Category:** DISCOVERED — 2026-04-15

---

## Error Severity

| Severity | Description | Automated Fix? |
|----------|-------------|---------------|
| **Fixable** | Artifact modification resolves it | Yes — fix and retry |
| **Configuration** | Requires security material or parameters setup | With confirmation |
| **Infrastructure** | Tenant-level (permissions, certs, queues) | No — inform user |
| **Locked** | Artifact locked by another user | No — inform user |
| **Unknown** | Not in knowledge base | Investigate, fix if possible, add DISCOVERED entry |
