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

This skill operates in **plan mode by default**. Before ANY execution (MCP tool calls that create or modify artifacts, BPMN generation, upload, or deploy), the skill MUST:

1. Complete Phase A requirement gathering
2. Present the full design to the user (requirements summary table + flow diagram — see Phase A Gate in `phase-a-requirements.md`)
3. Wait for explicit user confirmation (e.g., "looks good", "proceed", "yes")
4. Only THEN transition to Phase B and beyond

**What counts as execution (blocked until confirmation):**
- `scaffold-iflow`, `update-iflow-content`, `deploy-iflow`
- `scaffold-message-mapping`, `update-message-mapping-content`, `deploy-message-mapping`
- Writing any generated BPMN XML, Groovy scripts, or mapping files
- Any MCP tool call that creates or modifies tenant artifacts

**What is allowed before confirmation:**
- `get-server-info` (transport detection)
- `list-all-packages`, `get-package-details` (read-only queries to validate package existence)
- `get-iflow-content`, `get-message-mapping-content` (read-only inspection of existing artifacts)
- Reading reference files, templates, and metadata within the skill directory
- Spawning the requirements analysis sub-agent

If the user's input is ambiguous or incomplete, ask clarifying questions rather than proceeding with assumptions. Never skip the confirmation step, even for "simple" iFlows.

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

This MCP server runs in **stdio** or **http** mode. Auto-detect by calling `get-server-info` in Phase A step 1. Stdio mode uses `destinationName: "default"` / `runtimeDestination: "runtime"`. HTTP mode resolves destinations via user input, `config/tenant-destination-config.json`, or by asking the user. See `phase-a-requirements.md` step 1 for the full decision tree.

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

**Phase A to B transition is BLOCKED until user confirms.** Do not output the Phase A gate message or read phase-b-pattern-matching.md until the user has explicitly approved the design presented in the Phase A Gate. All other phase transitions may proceed automatically.

- `"Phase A complete — user confirmed design. Reading phase-b-pattern-matching.md."` → Read `./references/phases/phase-b-pattern-matching.md`
- `"Phase B complete — Template: {name}. Reading phase-c-generation.md."` → Read `./references/phases/phase-c-generation.md`
- `"Phase C complete — generated {N} files for {ArtifactId}. Reading phase-d-upload.md."` → Read `./references/phases/phase-d-upload.md`
- `"Phase D complete — artifact {ArtifactId} uploaded and build-validated. Reading phase-e-deploy.md."` → Read `./references/phases/phase-e-deploy.md`
- `"Phase E complete — {ArtifactId} deployed. Reading phase-fgh-completion.md."` → Read `./references/phases/phase-fgh-completion.md`

### Fast Paths

**Inline extraction:** Simple <=3 sentence single-artifact chat descriptions skip the sub-agent. See phase-a-requirements.md.

**Pattern fast path:** High-confidence single-sender/single-receiver with no mapping → skip B.1-B.3 decision logic. See phase-b-pattern-matching.md.

### Start Here

Read `./references/phases/phase-a-requirements.md` to begin Phase A.
