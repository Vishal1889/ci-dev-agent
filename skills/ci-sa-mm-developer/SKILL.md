---
name: ci-sa-mm-developer
description: >
  SAP Cloud Integration standalone Message Mapping development skill.
  TRIGGER when: user asks to create/update a standalone (reusable) Message Mapping artifact,
  .mmap file, or standalone mapping that will be referenced by multiple iFlows.
  DO NOT TRIGGER when: user wants a mapping step inside an iFlow (use ci-iflow-developer),
  or for iFlow/Script Collection work.
---

Trigger: User asks to create a standalone Message Mapping artifact (.mmap), a reusable mapping artifact, or a mapping that multiple iFlows will reference. Do NOT trigger for in-iFlow mapping steps, iFlow creation, or Script Collection work.

# SAP Cloud Integration — Standalone Message Mapping Developer

Build and deploy standalone Message Mapping artifacts using ci-mcp-server-custom MCP tools.

## CRITICAL: MCP Server Name

**The MCP server name is `ci-mcp-server-custom` — NOT `ci-mcp-server`.** All tool calls MUST use prefix `mcp__ci-mcp-server-custom__`.

## Non-Negotiables

1. Always call `get-message-mapping-content` after `scaffold-message-mapping` to get the exact `.mmap` filepath.
2. Never overwrite an existing artifact without first reading current content.
3. All temp files go in `skills/ci-sa-mm-developer/.tmp/` — NEVER system temp dirs.

## MANDATORY: Design-First Plan Mode

This skill operates in **plan mode by default**. **Immediately upon skill invocation, call `EnterPlanMode`** to enforce read-only constraints during requirement gathering.

Before ANY execution (MCP tool calls that create or modify artifacts, .mmap generation, upload, or deploy), the skill MUST:

1. **Call `EnterPlanMode`** — this blocks all write tools (Edit, Write, Bash non-readonly, MCP write tools) until plan mode is exited
2. Complete Phase 1 requirements gathering
3. Present the Design Confirmation Gate (see below) to the user — showing exactly what will be created
4. Wait for explicit user confirmation via `AskUserQuestion` (user selects "Approve")
5. **Call `ExitPlanMode`** — this exits plan mode and unblocks all write tools
6. Only THEN proceed to Phase 2 (.mmap generation) and beyond

**What counts as execution (blocked by `EnterPlanMode` until `ExitPlanMode`):**
- `scaffold-message-mapping`, `update-message-mapping-content`, `deploy-message-mapping`
- `create-mapping-test-iflow`, `deploy-iflow` (test harness)
- Generating any .mmap XML, XSD schemas, MANIFEST.MF, or Groovy UDF files

**What is allowed in plan mode (before user confirmation):**
- Reading reference files and samples within the skill directory
- `AskUserQuestion` for gathering missing requirements

**Note:** MCP tools (including read-only ones like `get-server-info`, `get-package-details`, `get-all-message-mappings`, `get-message-mapping-content`) are blocked by `EnterPlanMode`. Defer all MCP calls to after `ExitPlanMode` (Phase 2 onwards).

If the user's input is ambiguous or incomplete, ask clarifying questions rather than proceeding with assumptions. Never skip the confirmation step.

## MANDATORY: Structured Question Format (AskUserQuestion)

**Every question presented to the user MUST use the `AskUserQuestion` tool.** Never present questions as plain text, blockquotes, or markdown-formatted questions. This applies to ALL phases and ALL question types.

### Question Type Mapping

| Category | When | AskUserQuestion Strategy |
|----------|------|--------------------------|
| **Enumerated choices** | Source/target format (XML/JSON/CSV) | Use 2-4 specific `options` with descriptive labels |
| **Binary / Yes-No** | Schema available? | Use 2 `options` with descriptions |
| **Open-ended** | Mapping rules, field lists, package ID | Present the question with 2-3 common-pattern options — user selects "Other" (always available) for custom input |
| **Design confirmation gates** | Design Gate | Use 2 `options`: "Approve — proceed" / "Request changes" |

### Grouping Rules

Group related questions into a single `AskUserQuestion` call (max 4 questions per call):
- **Source details** (format + schema available) → 1 call with 2 questions
- **Target details** (format + schema available) → 1 call with 2 questions
- **Mapping** (rules + functions) → 1 call with 2 questions

## Transport-Aware Destination Handling

**Destination resolution happens AFTER `ExitPlanMode`** (after the user confirms the design). The main agent cannot call MCP tools during Phase 1 because `EnterPlanMode` is active.

After exiting plan mode (start of Phase 2), call `get-server-info` to detect transport mode (`stdio` vs `http`):

- **Stdio mode:** Always use `destinationName: "default"`.
- **HTTP mode:** Read `../../config/tenant-destination-config.json` for destination names, or ask the user via `AskUserQuestion`.

## Phase 1: Requirements

Extract these fields:

| Field | Required? | AskUserQuestion Format |
|-------|-----------|------------------------|
| Mapping name and ID | Yes — derive per naming convention: `MM_{SourceMsg}_to_{TargetMsg}` | N/A — derived, not asked |
| Package ID | Yes | header: `Package`, question only (user provides via "Other") |
| Source structure format (XML/JSON/CSV) | Yes | header: `Format`, options: `[XML, JSON, CSV]` |
| Source schema (XSD/JSON schema) | Yes — ask user if not provided | header: `Schema`, options: `[Yes — I can provide it, No — derive from requirements]` |
| Target structure format | Yes | header: `Format`, options: `[XML, JSON, CSV]` |
| Target schema | Yes — ask user if not provided | header: `Schema`, options: `[Yes — I can provide it, No — derive from requirements]` |
| Field-to-field mapping rules | Yes — ask user for complete list | header: `Rules`, options: `[I will provide a mapping table, Derive from schemas, I will describe in text]` |
| Functions/conditions | If applicable | header: `Functions`, question only (user describes via "Other") |

**Naming convention:** `MM_{SourceMsg}_to_{TargetMsg}` (e.g., `MM_ORDERS05_to_PurchaseOrder`). ID must not start with a number, space, or period.

## Design Confirmation Gate (MANDATORY)

> This gate comes AFTER Phase 1 (requirements) and BEFORE Phase 2 (generation). Do NOT proceed to Phase 2 until the user confirms the design.

**After gathering all requirements in Phase 1, present the following design summary:**

~~~
================================================
  MESSAGE MAPPING DESIGN SUMMARY
================================================

  General
  ------------------------------------------------
  | Field               | Value                   |
  |---------------------|-------------------------|
  | Mapping Name        | <display name>          |
  | Artifact ID         | <MM_Source_to_Target>    |
  | Package ID          | <package_id>            |

  Source Structure
  ------------------------------------------------
  | Field               | Value                   |
  |---------------------|-------------------------|
  | Format              | <XML/JSON/CSV>          |
  | Schema              | <filename or "to generate">|
  | Root Element        | <root element name>     |
  | Key Fields          | <list of source fields> |

  Target Structure
  ------------------------------------------------
  | Field               | Value                   |
  |---------------------|-------------------------|
  | Format              | <XML/JSON/CSV>          |
  | Schema              | <filename or "to generate">|
  | Root Element        | <root element name>     |
  | Key Fields          | <list of target fields> |

  Field Mapping Rules
  ------------------------------------------------
  | #  | Source Field       | Target Field       | Transform/Function  |
  |----|-------------------|--------------------|---------------------|
  | 1  | <source_field_1>  | <target_field_1>   | <direct/concat/etc> |
  | 2  | <source_field_2>  | <target_field_2>   | <function or UDF>   |
  | .. | ...               | ...                | ...                 |

  Functions & Conditions
  ------------------------------------------------
  | Function            | Applied To              | Purpose             |
  |---------------------|-------------------------|---------------------|
  | <concat/substring/> | <field(s)>              | <description>       |

  Groovy UDFs (if needed)
  ------------------------------------------------
  | Script Name         | Function Name           | Purpose             |
  |---------------------|-------------------------|---------------------|
  | <script.groovy>     | <functionName>          | <description>       |

  Files to Generate
  ------------------------------------------------
  | File Path                                      | Purpose             |
  |------------------------------------------------|---------------------|
  | src/main/resources/mapping/{id}.mmap           | Mapping definition  |
  | src/main/resources/xsd/{Source}.xsd             | Source schema       |
  | src/main/resources/xsd/{Target}.xsd             | Target schema       |
  | src/main/resources/script/{script}.groovy       | Groovy UDF (if any) |
  | META-INF/MANIFEST.MF                            | Bundle manifest     |
  | .project                                        | Eclipse project     |
~~~

**After presenting the summary, ask the user using the `AskUserQuestion` tool:**

Use `AskUserQuestion` with:
- question: "Does this message mapping design match your requirements? Please review the field mappings, functions, and file structure."
- header: `Design`
- options:
  - label: "Approve — proceed to generation", description: "The design is correct, proceed to Phase 2"
  - label: "Request changes", description: "I want to modify field mappings, functions, or other details before proceeding"

**Do NOT proceed to Phase 2 until the user confirms the design is correct.**

If the user requests changes, update the design and re-present the summary. Only after explicit confirmation:

1. Call `ExitPlanMode` to unblock write tools
2. Output: "Design confirmed. Exited plan mode. Proceeding to Phase 2: Generate .mmap Artifact."

## Phase 2: Generate .mmap Artifact

**Read `skills/ci-iflow-developer/references/guides/message-mapping-generation-guide.md`** — this is the authoritative reference for `.mmap` XML generation. It covers the exact XML skeleton, all 74 standard function `fname` values, binding parameter names, brick patterns, custom Groovy UDF wiring, and a worked example.

> **CRITICAL:** Many function `fname` values differ from their UI display names (e.g., `sub` not `subtract`, `mul` not `multiply`). NEVER guess — always look up in the generation guide.

**Additional references:**
- Sample `.mmap` files: `skills/ci-iflow-developer/references/minimal-message-mappings/`
- Sample standalone artifact structure: `./references/sample-standalone-mapping/` — shows the complete folder layout, MANIFEST.MF, `.project`, Groovy UDF script, and XSDs

### Standalone Artifact Structure

A standalone Message Mapping artifact has this folder layout:

```
{ArtifactId}/
  .project                                          — Eclipse project descriptor
  META-INF/
    MANIFEST.MF                                     — SAP-BundleType: MessageMapping
  metainfo.prop                                     — Empty description file
  src/main/resources/
    mapping/
      {artifactid}.mmap                             — The mapping definition (lowercase of artifact ID)
    xsd/
      {SourceSchema}.xsd                            — Source message structure
      {TargetSchema}.xsd                            — Target message structure
    script/                                         — (optional) Groovy UDF scripts
      {script_name}.groovy
```

### MANIFEST.MF for Standalone Message Mapping

Key differences from iFlow MANIFEST.MF:
- `SAP-BundleType: MessageMapping` (not `IntegrationFlow`)
- `Provide-Capability: messagemapping.{artifactid};version:Version="1.0.0"` — required so iFlows can reference this mapping
- `Import-Package` includes mapping-specific packages (`com.sap.it.api.mapping`, `com.sap.aii.mapping.*`, etc.)
- No `SAP-RuntimeProfile` header

See `./references/sample-standalone-mapping/META-INF/MANIFEST.MF` for the exact format.

### Groovy UDFs in Standalone Mappings

When a mapping requires custom Groovy functions:
1. Place `.groovy` file in `src/main/resources/script/`
2. In `.mmap`, add `<lnkRole role="UsedFuncLib">` in `<lnks>` section with `typeID="gsh"`
3. In `.mmap`, add `<entry name="{scriptName}"><libref>...</libref></entry>` in `<libstorage>`
4. Call with `<brick fname="{functionName}" fns="{scriptName}" type="Func">`

See `./references/sample-standalone-mapping/` for a working example with a Groovy UDF.

Also generate:
- `META-INF/MANIFEST.MF` — use the sample as template, replace `Bundle-Name`, `Bundle-SymbolicName`, and `Provide-Capability` with the artifact ID
- `.project` — replace `<name>` with the artifact ID
- Source/target XSD schemas if not provided by user

## Phase 3: Upload

```
Tool: get-package-details         — verify package exists (create with create-package if not)
Tool: scaffold-message-mapping    — create artifact placeholder
Tool: get-message-mapping-content — discover exact .mmap filepath (CRITICAL)
Tool: update-message-mapping-content — upload generated .mmap + XSDs + MANIFEST.MF
```

> Always use the exact `.mmap` filepath from `get-message-mapping-content` — do NOT invent a new filename.

## Phase 4: Deploy + Verify

```
Tool: deploy-message-mapping      — deploy the artifact
```

**Optional test harness:**
```
Tool: create-mapping-test-iflow   — creates an echo test iFlow
Tool: deploy-iflow (if_echo_mapping)
Tool: get-iflow-endpoints
Tool: send-http-message           — send test payload
Tool: get-messages                — verify results
```

## Completion Summary

Present a brief summary:
- Artifact ID and package
- Source/target structures
- Fields mapped
- Deploy status
- User action items (if any schema adjustments needed)

## Cross-Skill Notes

- **In-iFlow mapping:** If the user wants a mapping step inside an existing iFlow, use `ci-iflow-developer` instead.
- **iFlow referencing this mapping:** The iFlow must add `Require-Capability: {MappingArtifactId}` to its MANIFEST.MF and use `mappingSource=mappingSrcExternal`. Deploy this mapping BEFORE deploying the referencing iFlow.
