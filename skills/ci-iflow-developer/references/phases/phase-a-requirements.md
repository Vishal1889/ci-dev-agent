# Phase A: Requirement Analysis

## Phase A: Requirement Analysis

**Input sources:** verbal description, Functional Specification (FS), Technical Specification (TS), or combination.

> **Parallelization:** Steps 1 and 2 are combined into a single sub-agent call. The sub-agent handles both destination resolution (`get-server-info`) and requirements extraction in parallel within its own context. The main agent is in plan mode and cannot call MCP tools directly.

1. **Determine transport mode and resolve destinations (delegated to sub-agent):**

   First check if the user already provided destination names in their request — if so, use them as-is (Priority 1) and skip `get-server-info`.

   Otherwise, **include destination resolution instructions in the sub-agent prompt** (see Sub-Agent Prompt Template below). The sub-agent will call `get-server-info` and return the resolved destinations alongside the extracted requirements.

   The main agent cannot call `get-server-info` or any other MCP tools during Phase A because `EnterPlanMode` is active. All MCP read calls must be delegated to the sub-agent.

   **Destination resolution rules (included in sub-agent prompt):**

   After calling `get-server-info`:

   **Stdio mode (`transport: "stdio"`):**
   - Always pass `destinationName: "default"` and `runtimeDestination: "runtime"`.

   **HTTP mode (`transport: "http"`):**
   - **Priority 2 — Tenant config:** Read `../../config/tenant-destination-config.json`. If it exists:
     - **User specifies tenant name** (e.g. "deploy to DEV"): look up that key (case-insensitive), use `designTime` / `runtime`.
     - **Single tenant configured:** use it automatically, inform user.
     - **Multiple tenants, user didn't specify:** return `DESTINATION_UNRESOLVED` with the tenant list. The main agent will present via `AskUserQuestion` with header: `Tenant`, each tenant name as an option label with description showing its destination names (e.g., "designTime: CI_API_B, runtime: CI_Iflow_B").
   - **Priority 3 — Ask user (fallback):** If config file missing/empty, return `DESTINATION_UNRESOLVED`. The main agent will ask via `AskUserQuestion` with header: `Destination`, question: "What is the BTP Destination name for the Design-Time API?", no predefined options (user provides name via "Other").
   - **After resolved, remember for the rest of the session.** Do not ask again.
   - If runtime destination needed but tenant has no `runtime` key, ask for runtime only.
   - If user switches tenant mid-session, allow it — update and confirm.
2. **Invoke Requirements Analysis Sub-Agent:** Identify the input source (file path, chat text, or both) and invoke the sub-agent using the **Sub-Agent Prompt Template** below. The sub-agent reads the requirements, extracts structured fields, validates completeness, and suggests an archetype. It returns a compact structured object (~400-800 tokens) without polluting the main context with full document content.

   **Inline extraction fast path (skip sub-agent when ALL true):**
   - Input is chat text only (no file path provided)
   - User described requirements in ≤3 sentences
   - Single artifact (not multi-artifact)
   → Extract requirements inline using the Extraction Checklist fields below. Skip sub-agent spawn.
   → Otherwise: spawn the sub-agent as specified.

   **IMPORTANT — file-based inputs ALWAYS require sub-agent:** If the user provided ANY file path (PDF, DOCX, Excel, MD, etc.), you MUST spawn the sub-agent for extraction — never attempt file reading or extraction inline. The main agent is in plan mode (`EnterPlanMode` is active) and cannot run Bash/Python for file processing. The sub-agent operates independently outside plan mode constraints and handles all document reading, DOCX embedded file extraction, and Excel parsing.

3. **Validate sub-agent output:**
   - If `STATUS=COMPLETE` → proceed to Phase A Gate.
   - If `STATUS=INCOMPLETE` → present what was understood, then present the `MISSING_INFORMATION` questions to the user. After the user answers, send supplementary context to the sub-agent via `SendMessage` (see Completeness Validation Loop below for exact format). Maximum **2 additional SendMessage interactions** (3 total). After that, proceed with remaining gaps marked as "TBD".
4. **Multi-artifact handling:** If the sub-agent returns `MULTI_ARTIFACT=true`, plan artifacts as a set with dependency order (deploy mappings before iFlows). If artifact type is ambiguous, ask the user to clarify.

### Requirements Analysis Sub-Agent

This sub-agent handles requirement extraction, validation, and archetype pre-classification. It processes full documents or chat text in its own context and returns a compact structured result (~400-800 tokens), keeping the main skill context clean for BPMN generation.

**When to invoke:** For document inputs (PDF, DOCX, etc.) or requirements longer than 3 sentences or multi-artifact. For simple single-artifact chat descriptions (≤3 sentences), use the inline fast path above.

#### Extraction Checklists

**For iFlow creation, the sub-agent validates:**

| # | Field | Required? | If Missing | AskUserQuestion Format |
|---|-------|-----------|------------|------------------------|
| 1 | Artifact type (iFlow / MessageMapping / both) | Yes | Infer from context if clearly implied (e.g., user says "create an iFlow"). If ambiguous, ASK_USER. | header: `Artifact`, options: `[iFlow, Message Mapping, Both iFlow + Mapping]` |
| 2 | iFlow Name and ID | Yes | Derive per naming convention | N/A — derived, not asked |
| 3 | Package ID | Yes | ASK_USER | header: `Package`, question only (user provides package ID via "Other"). If the sub-agent resolved a package list, use those as options. |
| 4 | Sender system name | Yes | ASK_USER. **For Timer-triggered iFlows:** set to `N/A` — Timer has no sender system. **For JMS-triggered iFlows:** set to `JMS Queue` — JMS uses the built-in message broker. | header: `Sender`, question only (no predefined options — user provides name via "Other") |
| 5 | Sender adapter type | Yes | ASK_USER — "What protocol does the sender use? (HTTPS/SOAP/SFTP/Timer/ProcessDirect (=called by another iFlow)/IDoc/XI/JMS)" | header: `Protocol`, options: `[HTTPS, SOAP, SFTP, Timer/Scheduler]`. If user needs more: follow-up with `[ProcessDirect, IDoc/XI, JMS]` |
| 6 | Sender authentication | Yes | ASK_USER — "What authentication method?" Map user response to exact CPI XML values: Basic→`Basic`, OAuth2/OAuth2CC→`OAuth2 Client Credentials`, ClientCert/mTLS→`ClientCertificate`, UserRole→`RoleBased`, UserNamePassword(SFTP)→`user_password`, PublicKey/KeyPair(SFTP)→`publickey`, SASL(Kafka)→`PLAIN` or `SCRAM-SHA-256`, None→`None`. **For Timer-triggered iFlows:** set to `N/A`. **For IDoc/XI-triggered:** typically `ClientCertificate` (SAP system authenticates via client cert) or `None` (if handled at infrastructure level). **For JMS-triggered:** set to `N/A` — built-in broker requires no auth config. **For ProcessDirect-triggered:** set to `N/A` — internal CPI-to-CPI calls require no auth config. | header: `Auth`, options conditional on adapter. HTTPS/SOAP: `[RoleBased, Basic, Client Certificate, None]`. SFTP: `[Username/Password, Public Key]`. Timer/ProcessDirect/JMS: skip (N/A). |
| 7 | Sender endpoint | Yes | ASK_USER or derive from adapter type. **For Timer-triggered iFlows:** set to `N/A` — derive schedule from trigger specification instead. **For IDoc/XI-triggered:** endpoint is auto-assigned by CPI (IDoc sender channel address is typically `/sap/bc/srt/idoc` or auto-generated). **For JMS-triggered:** set to the JMS queue name to consume from (e.g., `OrderQueue`). Externalize as `{{queueName}}`. **For SFTP-triggered:** set to the SFTP directory path to poll (e.g., `/inbound/payments/`). Externalize as `{{sftpDirectory}}`. SFTP-specific config (pollInterval, readLock, moveTo, fileName filter) are adapter properties configured in the BPMN XML — see `./references/metadata/adapters/sftp_sender.json` for property keys. | header: `Endpoint`, question only (user provides path/URL via "Other") |
| 8 | Receiver system name(s) | Yes | ASK_USER. Note: "receiver" here means external systems called via adapter-based messageFlows. Data Store operations and Persist Message steps are NOT receivers — they are flow steps listed in Processing Steps (field 17). **JMS queue writes ARE adapter-based receivers** — list the queue name as the receiver endpoint and externalize it as `{{queueName}}`. | header: `Receiver`, question only (user provides name via "Other") |
| 9 | Receiver adapter type(s) | Yes | ASK_USER — "What protocol does the receiver use? (HTTP/SFTP/SOAP/JDBC/ProcessDirect/etc.)" | header: `Protocol`, options: `[HTTP, SFTP, SOAP, JDBC]`. If user needs more: follow-up with `[OData, ProcessDirect, JMS, RFC]` |
| 10 | Receiver authentication | Yes | ASK_USER | header: `Auth`, options conditional on adapter. HTTP/SOAP: `[Basic, OAuth2 Client Credentials, Client Certificate, None]`. SFTP: `[Username/Password, Public Key]`. |
| 11 | Receiver endpoint(s) | Yes | ASK_USER | header: `Endpoint`, question only (user provides URL via "Other") |
| 12 | Intermediate data fetching | If mentioned | Note Request-Reply calls to external systems (see "Intermediate Request-Reply" in Common Integration Patterns) | N/A — derived from requirements |
| 12b | Sync or async response | If HTTPS/SOAP-triggered | ASK_USER — "Should this iFlow return a synchronous response to the caller, or accept the message and process asynchronously?" Sync = `returnExceptionToSender=true` and final response flows back. Async = fire-and-forget with 202 Accepted. **N/A for SFTP/Timer/IDoc/XI/JMS-triggered iFlows** — these are inherently async. **For ProcessDirect-triggered iFlows:** ASK_USER — ProcessDirect calls are synchronous (caller blocks until response). The response behavior matters: sync = return response body to calling iFlow, async = return acknowledgment only. | header: `Response`, options: `[Synchronous — return response to caller, Asynchronous — fire-and-forget]` |
| 13 | Mapping needed? | Yes | ASK_USER — "Is message transformation/mapping needed between source and target formats?" Note: this refers to formal Message Mapping artifacts (`.mmap`). If the user plans to use Groovy Script or XSLT for transformation instead, record that in Processing Steps (field 17) rather than here. | header: `Mapping`, options: `[Yes — Message Mapping (.mmap), No mapping needed, Script/XSLT transformation instead]` |
| 14 | Source/target structures | If mapping=Yes | ASK_USER — "Are the source and target message structures (XSD/JSON schema) available?" | header: `Schemas`, options: `[Yes — I can provide them, Not available — derive from requirements]` |
| 15 | Mapping rules | If mapping=Yes | ASK_USER — "What are the field mapping rules?" | header: `Rules`, options: `[I will provide a mapping table, Derive from schemas, I will describe in text]` |
| 16 | Exception handling | Yes | Default to Yes with standard exception subprocess (ErrorStartEvent → Content Modifier → ErrorEnd). If user specifies a different pattern (e.g., terminate for critical failures), note the specific type. | N/A — defaults to Yes, only ask if ambiguous |
| 17 | Processing steps (ordered) | Yes | Derive from requirements | N/A — derived, not asked |
| 18 | Externalize parameters? | Yes | ASK_USER — "Should adapter endpoints, credentials, and schedule be externalized as configurable parameters (recommended for production — allows per-environment configuration without redeployment), or hardcoded (simpler for prototyping/testing)?" Default: Yes (externalize). If user says No, hardcode all values directly in BPMN XML. | header: `Params`, options: `[Externalize (recommended for production), Hardcode (simpler for prototyping)]` |
| 19 | Archetype suggestion | Yes | Heuristic — used by Phase B fast path | N/A — derived, not asked |

**For Message Mapping creation, the sub-agent validates:**

| # | Field | Required? | If Missing | AskUserQuestion Format |
|---|-------|-----------|------------|------------------------|
| 1 | Placement: in-iFlow or standalone? | Yes | ASK_USER — "Should this mapping be a step within an iFlow, or a standalone reusable artifact?" | header: `Placement`, options: `[In-iFlow step, Standalone reusable artifact]` |
| 2 | Parent iFlow ID (if in-iFlow) | If in-iFlow | ASK_USER — "Which iFlow should contain this mapping?" | header: `iFlow`, question only (user provides ID via "Other") |
| 3 | Source structure format (XML/JSON/CSV) | Yes | ASK_USER | header: `Format`, options: `[XML, JSON, CSV]` |
| 4 | Source schema available? | Yes | ASK_USER — "Can you provide the source message structure/schema?" | header: `Schema`, options: `[Yes — I can provide it, No — derive from requirements]` |
| 5 | Target structure format | Yes | ASK_USER | header: `Format`, options: `[XML, JSON, CSV]` |
| 6 | Target schema available? | Yes | ASK_USER — "Can you provide the target message structure/schema?" | header: `Schema`, options: `[Yes — I can provide it, No — derive from requirements]` |
| 7 | Mapping rules (field-to-field) | Yes | ASK_USER — "What are the mapping rules between source and target fields?" | header: `Rules`, question only (user describes mapping rules via "Other") |
| 8 | Functions/conditions | If applicable | Extract from requirements or ASK_USER | header: `Functions`, question only (user describes via "Other") |

#### Input Source Handling

Build the `{input_source_block}` for the prompt template below based on the input type:

| Input Type | How to build `{input_source_block}` |
|-----------|--------------------------------------|
| **Document file** (PDF, MD, DOCX) | `"Read the document at: {file_path}"` |
| **Chat text** (user typed requirements) | Condense user messages into key facts: `"User requirements:\n- Source: SAP S/4HANA\n- Target: SFTP\n- Trigger: Timer every 5 min\n- ..."` |
| **Mixed** (document + clarifications) | `"Read the document at: {file_path}. Additional context from user:\n- {clarification_1}\n- {clarification_2}"` |

#### Destination Context Handling

Build the `{destination_context}` for the sub-agent prompt template:

| Scenario | How to build `{destination_context}` |
|----------|--------------------------------------|
| **User provided destination names** | `"User provided destinations: designTime={name}, runtime={name}. Skip get-server-info."` |
| **User specified tenant name** | `"User specified tenant: {tenant_name}. Look up in tenant config after detecting transport."` |
| **No destination info from user** | `""` (empty — sub-agent will detect and resolve) |

**Embedded File Extraction (DOCX/Office documents):**

DOCX files are ZIP archives that may contain embedded files critical for mapping structure generation. **Always delegate embedded file extraction to the sub-agent** — include the extraction instructions in the sub-agent prompt. The main agent is in plan mode (`EnterPlanMode` is active) and cannot run Bash/Python directly.

1. **Detect embedded files:** Use Python to unzip the `.docx` and list files under `word/embeddings/` — common types: `.xlsx`, `.xlsm`, `.xls` (Excel mapping sheets), `.bin` (OLE objects), `.pdf`, `.docx` (nested documents)
2. **Extract and read Excel files:** Embedded Excel files (`.xlsx`, `.xlsm`) frequently contain:
   - **Field mapping tables** (source field → target field with transformation rules)
   - **Sample data files** (actual message payloads showing field names, formats, data types)
   - **Structure definitions** (column layouts, record formats, fixed-length field positions)
3. **Read all sheets:** Use `openpyxl` to read every sheet in each embedded Excel file — mapping data may be on any sheet
4. **Pass to sub-agent:** Include the extracted embedded file content in the `{input_source_block}` as additional context:
   ```
   "Read the document at: {file_path}.

   EMBEDDED FILES extracted from the document:

   EMBEDDED_FILE_1 (Microsoft_Excel_Worksheet.xlsx):
   Sheet 'Inbound Mapping Template':
   [extracted table content]

   EMBEDDED_FILE_2 (Microsoft_Excel_Macro-Enabled_Worksheet.xlsm):
   Sheet 'Sample Data':
   [extracted table content with column headers and sample rows]"
   ```

This step is critical because specification documents often embed the most important artifacts — mapping templates with exact field names, sample files showing actual data formats, and structure definitions — as OLE objects that are invisible to plain text extraction.

#### Sub-Agent Prompt Template

Use the Agent tool with `name: "req-analyst"` and this prompt (replace `{input_source_block}` with the appropriate input from the table above). The name makes the agent addressable for follow-up via SendMessage.

```
"You are a requirements analysis agent for SAP Cloud Integration.

BOUNDARY RULE: Only access files within the project directory or paths explicitly provided by the user. All skill reference files are under skills/ci-iflow-developer/. Temp files go in skills/ci-iflow-developer/.tmp/ — NEVER use /tmp or system temp directories.

TASK 1 — DESTINATION RESOLUTION:
Call `get-server-info` (MCP tool: mcp__ci-mcp-server-custom__get-server-info) to detect the transport mode.
- If stdio: set DESTINATION_DESIGNTIME='default', DESTINATION_RUNTIME='runtime'.
- If http: Read skills/ci-iflow-developer/../../config/tenant-destination-config.json.
  - Single tenant: use its designTime/runtime values.
  - Multiple tenants and user specified one: look up that key (case-insensitive).
  - Multiple tenants and user did NOT specify: return DESTINATION_UNRESOLVED with the tenant list.
  - Config missing/empty: return DESTINATION_UNRESOLVED.
{destination_context}

TASK 2 — REQUIREMENTS EXTRACTION:
Read requirements and extract structured integration details.

INPUT: {input_source_block}

EXTRACTION RULES:
1. Determine artifact type: iFlow, MessageMapping, or both
2. FOR DOCX INPUTS: Extract embedded files (word/embeddings/*.xlsx) using Python zipfile+openpyxl. These often contain the most important mapping tables and sample data. Save to skills/ci-iflow-developer/.tmp/{artifact-id}/embedded/
3. FOR IFLOW: extract sender (system, adapter, auth, endpoint), receiver(s) (same), intermediate Request-Reply calls, mapping needs, exception handling, processing steps (ordered list), externalized parameters. Derive Name/ID per convention: {INT_ID}_{Source}_{Direction}_{Target}_{BusinessObject}
4. FOR MESSAGE MAPPING: extract placement (in-iFlow/standalone), source/target structures, mapping rules. Derive name: MM_{SourceMsg}_to_{TargetMsg}
5. MULTI-ARTIFACT: detect if multiple iFlows or standalone mappings needed. List each with dependency order.

COMPLEXITY MODIFIERS: Detect: routing, splitting, multicast, multi-receiver, or none.

FLOW PATTERN: Classify as P2P | ROUTING | TIMER_P2P | TIMER_ROUTING | MULTICAST with 1-sentence reasoning.

ARCHETYPE: Suggest likely pattern with confidence (High/Medium/Low). Do NOT guess specific archetype IDs.

VALIDATION: Extract if present, set ASK_USER if missing. Never guess values.

OUTPUT FORMAT (compact key:value, under 800 tokens):

DESTINATION:
  Transport: stdio | http
  DesignTime: <destination name or UNRESOLVED>
  Runtime: <destination name or UNRESOLVED>
  Tenants: <list of tenant names, if UNRESOLVED and multiple tenants>

ARTIFACT_TYPE: iFlow | MessageMapping | Multi
STATUS: COMPLETE | INCOMPLETE

GENERAL:
  Name: <string>
  Id: <string>
  Package: <string or ASK_USER>
  ErrorHandling: Yes | No

SOURCE:
  SystemName: <string>
  AdapterType: <adapter>
  Authentication: <auth or ASK_USER>
  Endpoint: <string or ASK_USER>

TARGETS:
  - SystemName: <string>
    AdapterType: <adapter>
    Authentication: <auth or ASK_USER>
    Endpoint: <string or ASK_USER>

STEPS:
  1. <StepType> - <Purpose>
  2. <StepType> - <Purpose>

PARAMETERS:
  - <name>: <default> (used in: <component>)

MAPPING:
  Needed: Yes | No
  SourceStructure: available | missing
  TargetStructure: available | missing
  Rules: described | partial | missing
  EmbeddedMappingTable: Yes | No

ARCHETYPE: <pattern description> (High | Medium | Low)
  Reasoning: <1 sentence>

COMPLEXITY_MODIFIERS: routing | splitting | multicast | multi-receiver | none
FLOW_PATTERN: P2P | ROUTING | TIMER_P2P | TIMER_ROUTING | MULTICAST
  Reasoning: <1 sentence>

MISSING_INFORMATION:
  - <field>: <specific question for user>
  (or None if all fields extracted)

MULTI_ARTIFACT: true | false
If true:
  ARTIFACT_1: Type, Name, Id, Role, DependsOn
  ARTIFACT_2: ...
  DEPLOY_ORDER: <comma-separated Ids>

EMBEDDED_FILES:
  Count: <number>
  Files:
    - Name: <filename>  Type: <xlsx|pdf|other>  Sheets: <names>
      Content: <brief description>  SavedTo: <path>  UsefulFor: <mapping_structure|sample_data|other>
  (or None)"
```

#### Completeness Validation Loop

1. Invoke sub-agent (spawned with `name: "req-analyst"`) → receive structured output
2. **Check DESTINATION section first:**
   - If `DesignTime=UNRESOLVED` and `Tenants` list returned: present via `AskUserQuestion` with header: `Tenant`, each tenant as an option.
   - If `DesignTime=UNRESOLVED` and no tenants: ask via `AskUserQuestion` with header: `Destination`, question: "What is the BTP Destination name for the Design-Time API?"
   - Store resolved destination names for use in Phase B onwards.
3. If `STATUS=COMPLETE` → proceed to Phase A Gate
4. If `STATUS=INCOMPLETE`:
   a. Present to user: *"Here's what I understood from your requirements:"* followed by the extracted fields in a readable format
   b. Present the `MISSING_INFORMATION` questions to the user **using the `AskUserQuestion` tool**: classify each missing item per the Question Type Mapping in SKILL.md, set appropriate `header` and `options`, group related items (up to 4 per call). **Never paste the sub-agent's raw MISSING_INFORMATION text as plain text.**
   c. Wait for user answers
   d. Send user answers to the existing agent via `SendMessage` — do NOT spawn a new Agent. The agent retains its full context including the already-read document:
      ```
      SendMessage(to: "req-analyst", message: "SUPPLEMENTARY CONTEXT — the user provided these answers to your MISSING_INFORMATION questions:
      - {field_1}: {answer_1}
      - {field_2}: {answer_2}
      Re-evaluate your extraction with this new information. Return the SAME output format (ARTIFACT_TYPE, STATUS, GENERAL, SOURCE, etc.) with updated fields. Only change fields affected by the new answers.")
      ```
   e. Maximum **2 additional SendMessage interactions** after the initial call (3 total). After that, proceed with remaining gaps marked as "TBD" in the Phase A Gate summary table and note them as user action items in the Phase H completion summary.

### Phase A Gate: Present Requirements for User Confirmation (MANDATORY)

> This gate comes AFTER Phase A steps 1-4 (above) which gather and validate requirements. This step presents them to the user for approval. Do NOT proceed to Phase B without user confirmation.

**Before proceeding to Phase B, always present the requirements summary and get user approval.**

The requirements summary below is generated by mapping the Requirements Analysis Sub-Agent's structured output directly into this table format. Do NOT re-read or re-extract from the original document — use the sub-agent's returned fields.

Present the iFlow requirements in this tabular format:

```
═══════════════════════════════════════════════════
  IFLOW REQUIREMENTS SUMMARY
═══════════════════════════════════════════════════

  General
  ─────────────────────────────────────────────────
  | Field               | Value                   |
  |---------------------|-------------------------|
  | iFlow Name          | <name>                  |
  | iFlow ID            | <derived_id>            |
  | Package             | <package_id>            |
  | Trigger             | <HTTPS/Timer/SFTP/etc>  |
  | Error Handling      | <Yes/No>                |
  | Archetype (suggested)| <A# — Name (confidence)>|

  Source System (Sender)
  ─────────────────────────────────────────────────
  | Field               | Value                   |
  |---------------------|-------------------------|
  | System Name         | <sender_name>           |
  | Adapter Type        | <HTTPS/SFTP/SOAP/etc>   |
  | Protocol            | <HTTP/FTP/SMTP/etc>     |
  | Authentication      | <Basic/OAuth2/Cert/etc> |
  | Endpoint            | <address or param>      |

  Target System(s) (Receiver)
  ─────────────────────────────────────────────────
  | Field               | Value                   |
  |---------------------|-------------------------|
  | System Name         | <receiver_name>         |
  | Adapter Type        | <HTTP/SFTP/SOAP/etc>    |
  | Protocol            | <HTTP/FTP/SMTP/etc>     |
  | Authentication      | <Basic/OAuth2/Cert/etc> |
  | Endpoint            | <address or param>      |

  Processing Steps (in order)
  ─────────────────────────────────────────────────
  | #  | Step Type          | Purpose               |
  |----|--------------------|-----------------------|
  | 1  | <Content Modifier> | <Set tracking headers>|
  | 2  | <Groovy Script>    | <Transform payload>   |
  | 3  | <Router>           | <Route by type>       |
  | .. | ...                | ...                   |

  Externalized Parameters
  ─────────────────────────────────────────────────
  Externalize: <Yes/No (user preference)>

  (If Yes:)
  | Parameter Name       | Default Value   | Used In          |
  |----------------------|-----------------|------------------|
  | source.Address       | /api/inbound    | Sender adapter   |
  | receiver.Address     | https://...     | Receiver adapter |
  | receiver.Credential  | credAlias       | Receiver auth    |
  | ...                  | ...             | ...              |

  (If No: all values will be hardcoded in BPMN XML)

  Additional Artifacts
  ─────────────────────────────────────────────────
  | Artifact             | Type             | Notes            |
  |----------------------|------------------|------------------|
  | mapping_name.mmap    | Message Mapping  | In-iFlow         |
  | script.groovy        | Groovy Script    | Custom transform |
  | ...                  | ...              | ...              |
```

Then present a **flow diagram** showing the end-to-end message flow. Use the sub-agent's `FLOW_PATTERN` value to select the appropriate template — do not manually classify:
- `P2P` → Simple P2P template below
- `ROUTING` → Routing flow template below
- `TIMER_P2P` → Timer-triggered template below
- `TIMER_ROUTING` → Routing flow template adapted for timer (replace `[Sender]` with `|Timer Start|`)
- `MULTICAST` → Routing flow template adapted for multicast (replace Router with Multicast step)

**Simple P2P flow (sender-triggered, one receiver):**
```
  [Sender] --SOAP--> |Start| --> Content Modifier --> Groovy Script --> Request-Reply --HTTP--> [Receiver]
                      |                                                       |              |
                      |                                                  Set Status --> |End| |
                      | Exception Subprocess:                                                |
                      | ErrorStart --> Content Modifier --> ErrorEnd                          |
                      +----------------------------------------------------------------------+
```

**Routing flow (multiple receivers):**
```
  [Sender] --HTTPS--> |Start| --> Content Modifier --> Router --- Route A --> Request-Reply --HTTP--> [ReceiverA]
                                                           |                      +--> |End|
                                                           +--- Route B --> Send --SFTP--> [ReceiverB]
                                                           |                  +--> |End|
                                                           +--- Default --> |End| (discard)
```

**Timer-triggered flow (no sender participant):**
```
  |Timer Start| --> Content Modifier --> Request-Reply --HTTP--> [ExternalAPI]
                                              +--> Groovy Script --> Send --SFTP--> [Receiver]
                                                                       +--> |End|
```

Note: These flow diagrams are **simplified conceptual representations** for requirements approval. They show the high-level message flow, not exact BPMN structure. Exact BPMN wiring rules (Request-Reply vs Send vs EndEvent) are defined in Phase C under "Receiver Adapter Wiring Rules."

**After presenting the summary and diagram, ask the user using the `AskUserQuestion` tool:**

Use `AskUserQuestion` with:
- question: "Does this iFlow design match your requirements? Please review the summary table and flow diagram."
- header: `Design`
- options:
  - label: "Approve — proceed to generation", description: "The design is correct, proceed to Phase B"
  - label: "Request changes", description: "I want to modify steps, adapters, authentication, parameters, or other details before proceeding"

**Do NOT proceed to Phase B until the user confirms the design is correct.**

> **Phase gate:** After receiving user confirmation (user selects "Approve"), call `ExitPlanMode` to unblock write tools, then output: "Phase A complete — user confirmed design. Exited plan mode. Reading phase-b-pattern-matching.md."
> Then: Read `./references/phases/phase-b-pattern-matching.md` before proceeding to Phase B.
> If you find yourself generating BPMN XML without having received user confirmation on the requirements summary, stop immediately and go back to Phase A Gate.
