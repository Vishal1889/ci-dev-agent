---
name: ci-iflow-developer
description: >
  SAP Cloud Integration (CPI/Integration Suite) iFlow development skill. MUST be invoked before
  using any ci-mcp-server-custom MCP tools for Integration Flow work.
  TRIGGER when: user mentions SAP CPI, SAP Cloud Integration, SAP Integration Suite,
  Integration Suite, iFlow, integration flow, or asks to create/deploy/update/debug
  integration artifacts, write Groovy scripts for CPI, configure adapters (SFTP, HTTP, SOAP, OData,
  IDoc, JMS), check message processing logs, implement a functional/technical specification on CPI,
  send test messages to CPI endpoints, or manage CPI packages.
  DO NOT TRIGGER when: user means CI/CD (Continuous Integration), GitHub Actions, Jenkins pipelines,
  generic REST API development, non-SAP integration platforms, standalone message mappings
  (use ci-sa-mm-developer), or standalone script collections (use ci-sa-sc-developer).
---

Trigger: User mentions SAP CPI, SAP Cloud Integration, SAP Integration Suite, iFlow, integration flow, or asks to create/deploy/update/debug integration artifacts, configure CPI adapters, check message logs, implement a spec on CPI, send test messages, or manage CPI packages. Do NOT trigger for CI/CD pipelines, Jenkins, GitHub Actions, non-SAP integration work, standalone Message Mapping artifacts (→ ci-sa-mm-developer), or standalone Script Collections (→ ci-sa-sc-developer).

# SAP Cloud Integration — iFlow Developer

Build, upload, deploy, and manage SAP Cloud Integration artifacts using ci-mcp-server-custom MCP tools.

## CRITICAL: MCP Server Name

**The MCP server name is `ci-mcp-server-custom` — NOT `ci-mcp-server`.** All tool calls MUST use the prefix `mcp__ci-mcp-server-custom__` (e.g., `mcp__ci-mcp-server-custom__scaffold-iflow`). Do NOT use `mcp__ci-mcp-server__` — that server does not exist and will fail. This applies to every tool call throughout all phases.

## CRITICAL: Project Directory Boundary

**NEVER traverse outside the project directory or the skill directory (`skills/ci-iflow-developer/`) to read, search, or reference files — unless the user explicitly instructs you to access a specific external path (read-only).** This applies to ALL phases, ALL sub-agents, and ALL file operations:

- All reference files (guides, metadata, samples, docs) are inside `./references/` relative to this skill directory
- All temp files go in `skills/ci-iflow-developer/.tmp/` — **NEVER use system temp directories** (`/tmp`, `C:\tmp`, `C:\Users\*\AppData\Local\Temp`, or any path outside the project). Create a sub-directory with the artifact ID (e.g., `.tmp/CHS_OTC_RackManifest_SemStream_to_S4/`)
- Sub-agents spawned via the Agent tool inherit this constraint — include it in their prompts
- If a required file is not found within the project directory, **ask the user** for the correct path instead of searching outside
- The ONLY exception is when the user provides an explicit external path (e.g., "read the spec at C:/Users/me/Documents/spec.pdf") — and even then, only **read** from that path, never write to it

## Non-Negotiables

Verify before ANY BPMN generation:

1. **Ask the user whether to externalize parameters** — during Phase A, confirm whether the user wants adapter endpoints, credentials, schedule keys, and other environment-specific values externalized as `{{paramName}}` (configurable per environment via CPI Configuration API) or hardcoded (simpler, suitable for prototyping/testing). If externalizing schedules, always use `{{Scheduler}}` with `custom:schedule` type. See `./references/guides/scheduler-configuration-guide.md` for templates.
2. **Receiver messageFlow `sourceRef` = ServiceTask (Request-Reply/Send), NEVER EndEvent** — for Request-Reply and Send steps, the messageFlow sources from the serviceTask, not the EndEvent.
3. **HTTP/SOAP/OData/JDBC/RFC/ProcessDirect receivers MUST use Request-Reply (`ExternalCall`)** — never use Send for these adapters.
4. **Always call `get-iflow-content` after `scaffold-iflow`** to get the exact `.iflw` filename. Never create a new `.iflw` file when one was scaffolded.
5. **`parameters.propdef` MUST be XML format** — NOT Java properties format. Wrong format causes "Error while loading" in Web UI. See `./references/guides/parameters-generation-guide.md` for worked examples with correct `param_references` bindings (sender vs receiver adapters use different `attribute_id` formats).
6. **ErrorEnd in exception subprocesses uses `errorEventDefinition`** — NOT `escalationEventDefinition`/`EscalationEndEvent`. See known-errors.md.
7. **Timer iFlows: NO sender messageFlow** — the timer is a startEvent type, not an adapter. The scaffold's Sender participant may be kept (harmless) but there must be NO sender messageFlow connecting to the start event.
8. **NEVER hallucinate adapter properties, cmdVariantUri values, or BPMN structures.** If the metadata file does not exist in `./references/metadata/`, or you are unsure about correct property keys/values, **stop and tell the user**. Do not guess, invent properties, or retry with fabricated values.
9. **Scaffold-first BPMN generation for NEW artifacts:** After `scaffold-iflow` + `get-iflow-content`, extract the scaffold's structural boilerplate (`<bpmn2:definitions>` attributes, `<bpmn2:collaboration>` extensionElements, `<bpmn2:documentation>`, participant extensionElements). Use this as the structural shell for your generated XML. Do NOT generate BPMN purely from minimal-iflow templates — the scaffold's structure may differ and cause `GenerationFailed` errors.
10. **Uploading parameters.prop/propdef to fresh scaffolds is safe — but guard `&amp;` encoding in `schedule1`:** When the user opts for externalization, uploading `parameters.prop` and `parameters.propdef` to freshly scaffolded artifacts works correctly. **After every upload of a `parameters.prop` containing a `Scheduler` value, verify with `get-iflow-content` that `schedule1` contains `&amp;trigger.timeZone` (not `&trigger.timeZone`).** If `&amp;` was decoded, re-upload. See `known-errors.md` "SAXParseException / &amp; decoding in schedule1" for details. When the user opts to NOT externalize, hardcode values directly in the BPMN XML — for inline `scheduleKey`, the `schedule1` `&` separator must be double XML-encoded as `&amp;amp;`.

## MANDATORY: Design-First Plan Mode

This skill operates in **plan mode by default**. **Immediately upon skill invocation, call `EnterPlanMode`** to enforce read-only constraints during requirement gathering.

Before ANY execution (MCP tool calls that create or modify artifacts, BPMN generation, upload, or deploy), the skill MUST:

1. **Call `EnterPlanMode`** — this blocks all write tools (Edit, Write, Bash non-readonly, MCP write tools) until plan mode is exited
2. Complete Phase A requirement gathering (read-only operations + sub-agent analysis)
3. Present the full design to the user (requirements summary table + flow diagram — see Phase A Gate in `phase-a-requirements.md`)
4. Wait for explicit user confirmation via `AskUserQuestion` (user selects "Approve")
5. **Call `ExitPlanMode`** — this exits plan mode and unblocks all write tools
6. Only THEN transition to Phase B and beyond

**What counts as execution (blocked by `EnterPlanMode` until `ExitPlanMode`):**
- `scaffold-iflow`, `update-iflow-content`, `deploy-iflow`
- `scaffold-message-mapping`, `update-message-mapping-content`, `deploy-message-mapping`
- Writing any generated BPMN XML, Groovy scripts, or mapping files
- Any MCP tool call that creates or modifies tenant artifacts

**What is allowed in plan mode (before user confirmation):**
- Reading reference files, templates, and metadata within the skill directory
- Spawning the requirements analysis sub-agent via `Agent` tool (sub-agents operate independently — they are NOT constrained by the parent's plan mode and can call MCP tools, run Bash/Python, etc.)
- `AskUserQuestion` for gathering missing requirements

**IMPORTANT — MCP tools are blocked in plan mode:** `EnterPlanMode` blocks ALL tool calls except read-only file tools (Read, Glob, Grep), Agent, and AskUserQuestion. This means MCP tools like `get-server-info`, `list-all-packages`, and `get-package-details` cannot be called by the main agent during Phase A. **Delegate all MCP read calls to the sub-agent.** Include destination resolution instructions (transport detection, tenant config lookup) in the sub-agent prompt so it can call `get-server-info` and resolve destinations on behalf of the main agent.

**IMPORTANT — file-based inputs require sub-agent:** When the user provides ANY file path (PDF, DOCX, Excel, MD, etc.) as requirements input, you MUST spawn the sub-agent for extraction. Never attempt file reading, DOCX embedded file extraction, or Python-based processing inline — the main agent is in plan mode and cannot run Bash/Python. The sub-agent handles all file extraction independently.

If the user's input is ambiguous or incomplete, ask clarifying questions rather than proceeding with assumptions. Never skip the confirmation step, even for "simple" iFlows.

## MANDATORY: Structured Question Format (AskUserQuestion)

**Every question presented to the user MUST use the `AskUserQuestion` tool.** Never present questions as plain text, blockquotes, or markdown-formatted questions. This applies to ALL phases, ALL question types, and ALL sub-agent `MISSING_INFORMATION` relays.

### Question Type Mapping

| Category | When | AskUserQuestion Strategy |
|----------|------|--------------------------|
| **Enumerated choices** | Adapter type, auth method, format, artifact type | Use 2-4 specific `options` with descriptive labels |
| **Binary / Yes-No** | Externalize params?, mapping needed?, sync/async? | Use 2 `options` with descriptions explaining trade-offs |
| **Open-ended** | Endpoint URL, system name, mapping rules, package ID | Present the question with 2-3 common-pattern options — user selects "Other" (always available) for custom input |
| **Design confirmation gates** | Phase A Gate, Design Gate | Use 2 `options`: "Approve — proceed" / "Request changes" |
| **Permission requests** | Read tenant iFlows?, delete artifact? | Use 2 `options`: "Yes — proceed" / "No — skip" |

### Grouping Rules

Group related questions into a single `AskUserQuestion` call (max 4 questions per call, each question with its own `header`, `options`, and `multiSelect` setting):

- **Sender details** (system name + adapter type + auth + endpoint) → 1 call with up to 4 questions
- **Receiver details** (system name + adapter type + auth + endpoint) → 1 call with up to 4 questions
- **Processing options** (sync/async + mapping needed + schemas available + externalize) → 1 call with up to 4 questions
- **Admin** (artifact type + package ID) → 1 call with 2 questions

Do NOT group unrelated questions across different domains (e.g., sender details + mapping rules).

### Sub-Agent MISSING_INFORMATION Relay

When the Requirements Analysis Sub-Agent returns `STATUS=INCOMPLETE` with `MISSING_INFORMATION` items:
1. Parse each missing item
2. Classify per the Question Type Mapping above
3. Group related items (up to 4 per call)
4. Present each group via `AskUserQuestion` with appropriate `header` and `options`
5. **Never paste the sub-agent's raw MISSING_INFORMATION text as plain text to the user**

### Inline Fast-Path Questions

When using the inline extraction fast path (≤3 sentence input, single artifact), every ASK_USER field that cannot be inferred MUST still use `AskUserQuestion` — not plain text.

## MCP Tool Reference

This server uses **named tools with typed parameters** (not raw OData). Full tool guide: `./references/guides/ci-mcp-tool-guide.md`.

Available tools: `get-server-info`, `list-all-packages`, `get-package-details`, `create-package`, `get-iflow-content`, `list-iflows-in-package`, `scaffold-iflow`, `update-iflow-content`, `deploy-iflow`, `undeploy-artifact`, `get-iflow-endpoints`, `get-iflow-configurations`, `get-iflow-build-errors`, `get-deploy-error`, `get-message-mapping-content`, `get-all-message-mappings`, `scaffold-message-mapping`, `update-message-mapping-content`, `deploy-message-mapping`, `create-mapping-test-iflow`, `get-messages`, `get-messages-count`, `send-http-message`.

### Supported Artifact Types

| Type | Scaffold Tool | Update Tool | Deploy Tool |
|------|--------------|-------------|-------------|
| Integration Flow | `scaffold-iflow` | `update-iflow-content` | `deploy-iflow` |
| Message Mapping | `scaffold-message-mapping` | `update-message-mapping-content` | `deploy-message-mapping` |
| XSLT Mapping | (embedded in iFlow) | via `update-iflow-content` files array | (deployed with iFlow) |
| Groovy Script | (embedded in iFlow) | via `update-iflow-content` files array | (deployed with iFlow) |

> **Not available in this MCP server:** Script Collections, Value Mappings, Partner Directory, Access Policies, Data Stores, Variables, Security Material, JMS Queues. These must be managed via the Cloud Integration web UI or a different MCP server.

### Critical: Transport-Aware Destination Handling

This MCP server runs in **stdio** or **http** mode. The sub-agent calls `get-server-info` during Phase A to auto-detect the mode (the main agent cannot call MCP tools in plan mode). Stdio mode uses `destinationName: "default"` / `runtimeDestination: "runtime"`. HTTP mode resolves destinations via user input, `config/tenant-destination-config.json`, or by asking the user. See `phase-a-requirements.md` step 1 for the full decision tree.

---

## Execution Tracking

Record approximate phase durations based on tool call timestamps visible in the conversation. Do NOT rely on bash `date` commands for timing — they are unreliable across platforms (Windows, macOS, Linux).

**Track these milestones** at each major phase transition:
- Phase A: Requirement Analysis
- Phase B: Pattern Matching
- Phase C: Artifact Generation
- Phase D: Upload to Cloud Integration
- Phase E: Deploy & Error Resolution
- Phase F: Escalation (if needed)
- Phase G: User Decision (if needed)
- Phase H: Completion Summary

**At skill completion**, present a timing summary in the Phase H Completion Summary (approximate durations are fine, e.g., `~15s`).

## Orchestration Dashboard (Optional)

The orchestration dashboard provides a real-time visual view of skill execution phases and MCP tool calls. It is **opt-in**: it only activates if `orchestration_dashboard: true` is set in `.claude/ci-dev-plugin.local.md` YAML frontmatter. All orchestration commands are **silent no-ops** if the dashboard is not enabled — they exit immediately with no error.

### Launching the Dashboard (once at skill start)

Before calling `EnterPlanMode`, run the dashboard launcher via Bash:

```bash
node "skills/ci-iflow-developer/../../orchestration/launcher.js" --skill-name ci-iflow-developer
```

If the dashboard is enabled, this starts the server and opens the browser. The script prints a session ID line to stdout (e.g., `session:skill-a1b2c3d4`). **Capture this session ID** — you will pass it to subsequent phase event commands. If the output is empty or the command fails, skip all subsequent orchestration commands silently.

### Sending Phase Events

At each phase boundary, send a phase event via Bash using `--json` and `--session`:

```bash
node "skills/ci-iflow-developer/../../orchestration/send-event.js" phase-transition --json "{\"phase\":\"A\",\"name\":\"Requirement Analysis\"}" --session <captured-session-id>
```

Replace `<captured-session-id>` with the session ID captured from the launcher output.

**Phase event table:**

| Phase | `phase` value | `name` value |
|-------|--------------|--------------|
| A | `A` | `Requirement Analysis` |
| B | `B` | `Pattern Matching` |
| C | `C` | `Artifact Generation` |
| D | `D` | `Upload to CPI` |
| E | `E` | `Deploy & Error Resolution` |
| F | `F` | `Escalation` |
| G | `G` | `User Decision` |
| H | `H` | `Completion Summary` |
| end | `done` | `Skill Complete` |

**Important:**
- All orchestration commands use `node` with `--json` args — no shell piping — so they work on all platforms (Windows, macOS, Linux)
- Never block skill execution on orchestration failures. If any command fails, continue the skill normally
- MCP tool events (PreToolUse/PostToolUse) and sub-agent events are tracked automatically by hooks — no action needed in the skill for those
- For the final `done` event, add `--cleanup` to remove the session tracking file:
  ```bash
  node "skills/ci-iflow-developer/../../orchestration/send-event.js" phase-transition --json "{\"phase\":\"done\",\"name\":\"Skill Complete\"}" --session <captured-session-id> --cleanup
  ```

## Template Selection

Templates are selected in Phase B using a 14-row lookup table (in `phase-b-pattern-matching.md`) that matches trigger type, receiver count, routing, and splitting to one of 14 minimal `.iflw` templates in `./references/minimal-iflows/`.

## Phase Workflow Overview

This skill executes in phases. **At each phase gate, output the gate message and read the next phase file before proceeding.**

| Phase | File to Read | Purpose |
|-------|-------------|---------|
| A | `./references/phases/phase-a-requirements.md` | Requirement analysis + user confirmation |
| B | `./references/phases/phase-b-pattern-matching.md` | Template selection + metadata lookup |
| C | `./references/phases/phase-c-generation.md` | BPMN XML generation + validation |
| D | `./references/phases/phase-d-upload.md` | Upload to CPI tenant |
| E | `./references/phases/phase-e-deploy.md` | Deploy + error resolution |
| F-H | `./references/phases/phase-fgh-completion.md` | Escalation + completion |

### Phase Gate Protocol

At each phase transition, output the gate message, send the orchestration phase event (if session ID was captured), and immediately read the next file.

**Phase A to B transition is BLOCKED until user confirms AND plan mode is exited.** Do not output the Phase A gate message or read phase-b-pattern-matching.md until the user has explicitly approved the design presented in the Phase A Gate. After user approves, call `ExitPlanMode` first, then proceed. All other phase transitions may proceed automatically.

- `"Phase A complete — user confirmed design."` → Call `ExitPlanMode` → Send phase event: `node "skills/ci-iflow-developer/../../orchestration/send-event.js" phase-transition --json "{\"phase\":\"B\",\"name\":\"Pattern Matching\"}" --session <session-id>` → Read `./references/phases/phase-b-pattern-matching.md`
- `"Phase B complete — Template: {name}. Reading phase-c-generation.md."` → Send phase event C (`Artifact Generation`) → Read `./references/phases/phase-c-generation.md`
- `"Phase C complete — generated {N} files for {ArtifactId}. Reading phase-d-upload.md."` → Send phase event D (`Upload to CPI`) → Read `./references/phases/phase-d-upload.md`
- `"Phase D complete — artifact {ArtifactId} uploaded and build-validated. Reading phase-e-deploy.md."` → Send phase event E (`Deploy & Error Resolution`) → Read `./references/phases/phase-e-deploy.md`
- `"Phase E complete — {ArtifactId} deployed. Reading phase-fgh-completion.md."` → Send phase event H (`Completion Summary`) → Read `./references/phases/phase-fgh-completion.md`

### Fast Paths

**Inline extraction:** Simple <=3 sentence single-artifact chat descriptions skip the sub-agent. See phase-a-requirements.md.

**Pattern fast path:** High-confidence single-sender/single-receiver with no mapping → skip B.1-B.3 decision logic. See phase-b-pattern-matching.md.

### Start Here

1. Launch the orchestration dashboard (Bash): `node "skills/ci-iflow-developer/../../orchestration/launcher.js" --skill-name ci-iflow-developer` — capture the session ID from stdout if printed (e.g., `session:skill-a1b2c3d4`). If the output is empty or the command fails, skip all orchestration commands silently.
2. Send Phase A event (Bash): `node "skills/ci-iflow-developer/../../orchestration/send-event.js" phase-transition --json "{\"phase\":\"A\",\"name\":\"Requirement Analysis\"}" --session <session-id>`
3. Call `EnterPlanMode`, then read `./references/phases/phase-a-requirements.md` to begin Phase A.
