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

## Transport-Aware Destination Handling

Call `get-server-info` first to detect transport mode (`stdio` vs `http`).

- **Stdio mode:** Always use `destinationName: "default"`.
- **HTTP mode:** Read `./tenant-destination-config.json` for destination names, or ask the user.

## Phase 1: Requirements

Extract these fields:

| Field | Required? |
|-------|-----------|
| Mapping name and ID | Yes — derive per naming convention: `MM_{SourceMsg}_to_{TargetMsg}` |
| Package ID | Yes |
| Source structure format (XML/JSON/CSV) | Yes |
| Source schema (XSD/JSON schema) | Yes — ask user if not provided |
| Target structure format | Yes |
| Target schema | Yes — ask user if not provided |
| Field-to-field mapping rules | Yes — ask user for complete list |
| Functions/conditions | If applicable |

**Naming convention:** `MM_{SourceMsg}_to_{TargetMsg}` (e.g., `MM_ORDERS05_to_PurchaseOrder`). ID must not start with a number, space, or period.

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
