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

> **Read first:** [`../_shared/installed-package-rules.md`](../_shared/installed-package-rules.md) — this skill is an installed npm package; you cannot edit your own files (only `skills/ci-iflow-developer/.tmp/` is writable).

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
6. **Exception Subprocess MUST be copied from [`07-exception-subprocess.iflw`](./references/minimal-iflows/07-exception-subprocess.iflw), not invented.** Required: `errorEventDefinition` (not `escalationEventDefinition`), `ErrorEndEvent` or `MessageEndEvent` (NEVER `EscalationEndEvent`), `activityType=ErrorEventSubProcessTemplate` extensionElement on the subprocess, no `triggeredByEvent="true"` attribute, full BPMNDiagram coverage for the subprocess container AND every element inside it. Skipping any of these renders the subprocess as an empty featureless rectangle in the CPI Web UI even when deployment succeeds. The Phase C.1b validation gate rejects iFlows that violate any of these rules before upload. See [known-errors.md](./references/guides/known-errors.md) entry on Exception Subprocess rendering and [bpmn-generation-guide.md §4.6](./references/guides/bpmn-generation-guide.md).
7. **Timer iFlows: NO sender messageFlow** — the timer is a startEvent type, not an adapter. The scaffold's Sender participant may be kept (harmless) but there must be NO sender messageFlow connecting to the start event.
8. **NEVER hallucinate adapter properties, cmdVariantUri values, or BPMN structures.** If the metadata file does not exist in `./references/metadata/`, or you are unsure about correct property keys/values, **stop and tell the user**. Do not guess, invent properties, or retry with fabricated values.
9. **Scaffold-first BPMN generation for NEW artifacts:** After `scaffold-iflow` + `get-iflow-content`, extract the scaffold's structural boilerplate (`<bpmn2:definitions>` attributes, `<bpmn2:collaboration>` extensionElements, `<bpmn2:documentation>`, participant extensionElements). Use this as the structural shell for your generated XML. Do NOT generate BPMN purely from minimal-iflow templates — the scaffold's structure may differ and cause `GenerationFailed` errors.
10. **Uploading parameters.prop/propdef to fresh scaffolds is safe — but guard `&amp;` encoding in `schedule1`:** When the user opts for externalization, uploading `parameters.prop` and `parameters.propdef` to freshly scaffolded artifacts works correctly. **After every upload of a `parameters.prop` containing a `Scheduler` value, verify with `get-iflow-content` that `schedule1` contains `&amp;trigger.timeZone` (not `&trigger.timeZone`).** If `&amp;` was decoded, re-upload. See `known-errors.md` "SAXParseException / &amp; decoding in schedule1" for details. When the user opts to NOT externalize, hardcode values directly in the BPMN XML — for inline `scheduleKey`, the `schedule1` `&` separator must be double XML-encoded as `&amp;amp;`.
11. **MANDATORY BPMNDiagram validation before upload:** After generating the `.iflw` XML and BEFORE calling `update-iflow-content`, you MUST run the BPMNDiagram completeness validation script (see `phase-c-generation.md` §C.1b). If the assertion fails, fix the XML and re-validate. NEVER upload an iFlow with mismatched shape/edge counts. For complex flows (>8 steps), use Python-based XML generation that builds process elements and diagram entries in lockstep to prevent truncation. The §C.1b gate also enforces Exception Subprocess semantic checks (see Non-Negotiable #6) — both must pass.

12. **Phase B template selection is mandatory — generating BPMN from scratch is forbidden.** Every iFlow you produce MUST be derived from one of the 30 templates in [`./references/minimal-iflows/`](./references/minimal-iflows/). The Phase B lookup table maps user requirements to a template; if nothing matches, use `AskUserQuestion` to let the user pick from the closest 2-3 options or escalate to manual development. The Phase C generation phase asserts this precondition at its top — see [phase-c-generation.md §C.0](./references/phases/phase-c-generation.md). **If the design includes an Exception Subprocess, you must ALSO read [`07-exception-subprocess.iflw`](./references/minimal-iflows/07-exception-subprocess.iflw) in addition to your primary template — see [phase-b-pattern-matching.md §B.0a](./references/phases/phase-b-pattern-matching.md).**

13. **Post-deploy runtime check is MANDATORY on every SUCCESS deploy.** After `deploy-iflow` returns SUCCESS, before declaring the iFlow done, capture the deploy timestamp, wait 30 seconds, and call `get-messages-count(status: FAILED, iflowName: ..., logStart: <deploy-timestamp>)`. If the count is non-zero, fetch details with `get-messages` (top: 5, includeDetails: true) and surface them in the Phase H "Runtime Errors" block — do NOT enter the Phase E error-resolution loop, since runtime errors usually require user intervention (credentials, destinations). `deploy-iflow` SUCCESS means "Started" state, not "working" — polling-adapter credential errors, timer schedule errors, and configuration runtime errors only show up post-deploy. See [phase-e-deploy.md §E.6](./references/phases/phase-e-deploy.md).

## MANDATORY: Design-First Plan Mode

This skill operates in **plan mode by default**. **Immediately upon skill invocation, call `EnterPlanMode`** to enforce read-only constraints during requirement gathering.

Before ANY execution (MCP tool calls that create or modify artifacts, BPMN generation, upload, or deploy), the skill MUST:

1. **Call `EnterPlanMode`** — this blocks all write tools (Edit, Write, Bash non-readonly, MCP write tools) until plan mode is exited
2. Complete Phase A requirement gathering (read-only operations + sub-agent analysis). `AskUserQuestion` is appropriate here for *clarifying* the design — e.g. "which OAuth flow?", "externalize this parameter?", "confirm 3 receivers vs 2?".
3. Present the full design to the user (requirements summary table + flow diagram — see Phase A Gate in `phase-a-requirements.md`)
4. **Call `ExitPlanMode` as the single approval gate** — Claude Code's ExitPlanMode dialog shows the user the design (the summary table and flow diagram you just presented are part of the plan in their session) and asks for their approval. **Do NOT use a separate `AskUserQuestion` "Approve / Request changes" prompt right before ExitPlanMode** — that creates a confusing double prompt asking the same question twice.
5. Only AFTER ExitPlanMode is approved, transition to Phase B and beyond.

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

At each phase transition, output the gate message and immediately read the next file.

**Phase A to B transition is BLOCKED until user confirms AND plan mode is exited.** Do not output the Phase A gate message or read phase-b-pattern-matching.md until the user has explicitly approved the design presented in the Phase A Gate. After user approves, call `ExitPlanMode` first, then proceed. All other phase transitions may proceed automatically.

- `"Phase A complete — user confirmed design."` → Call `ExitPlanMode` → Read `./references/phases/phase-b-pattern-matching.md`
- `"Phase B complete — Template: {name}. Reading phase-c-generation.md."` → Read `./references/phases/phase-c-generation.md`
- `"Phase C complete — generated {N} files for {ArtifactId}. Reading phase-d-upload.md."` → Read `./references/phases/phase-d-upload.md`
- `"Phase D complete — artifact {ArtifactId} uploaded and build-validated. Reading phase-e-deploy.md."` → Read `./references/phases/phase-e-deploy.md`
- `"Phase E complete — {ArtifactId} deployed. Reading phase-fgh-completion.md."` → Read `./references/phases/phase-fgh-completion.md`

### Fast Paths

**Inline extraction:** Simple <=3 sentence single-artifact chat descriptions skip the sub-agent. See phase-a-requirements.md.

**Pattern fast path:** High-confidence single-sender/single-receiver with no mapping → skip B.1-B.3 decision logic. See phase-b-pattern-matching.md.

### Start Here

1. Call `EnterPlanMode`, then read `./references/phases/phase-a-requirements.md` to begin Phase A.
