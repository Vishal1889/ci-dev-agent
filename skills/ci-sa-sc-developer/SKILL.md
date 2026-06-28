---
name: ci-sa-sc-developer
description: >
  SAP Cloud Integration standalone Script Collection development skill.
  TRIGGER when: user asks to create/package a Script Collection artifact,
  shared Groovy scripts, reusable script bundle, or .groovy script package for CPI.
  DO NOT TRIGGER when: user wants a Groovy Script step inside an iFlow (use ci-iflow-developer),
  or for iFlow/Message Mapping work.
---

Trigger: User asks to create a Script Collection artifact, package shared Groovy scripts, or bundle scripts for reuse across multiple iFlows. Do NOT trigger for in-iFlow Groovy Script steps, iFlow creation, or Message Mapping work.

# SAP Cloud Integration — Standalone Script Collection Developer

Package and document Script Collection artifacts for SAP Cloud Integration.

> **Important:** Script Collections CANNOT be managed via the MCP server. This skill guides you through creating the artifact structure and provides upload instructions for the CPI Web UI.

## Non-Negotiables

1. `Bundle-SymbolicName` in MANIFEST.MF must exactly match the artifact ID.
2. Groovy scripts use `def Message processData(Message message)` signature. JavaScript scripts use `function processData(message)`.
3. Deploy Script Collection BEFORE any iFlows that reference it.
4. iFlows referencing this SC must add `Require-Bundle: {BundleSymbolicName}` to their MANIFEST.MF.
5. **NEVER hallucinate MANIFEST.MF headers.** Use the sample at `./references/sample-script-collection/META-INF/MANIFEST.MF` as template.

## MANDATORY: Design-First Plan Mode

This skill operates in **plan mode by default**. **Immediately upon skill invocation, call `EnterPlanMode`** to enforce read-only constraints during requirement gathering.

Before ANY execution (file generation, directory structure creation, or artifact packaging), the skill MUST:

1. **Call `EnterPlanMode`** — this blocks all write tools (Edit, Write, Bash non-readonly) until plan mode is exited
2. Complete Phase 1 script gathering
3. Present the Design Confirmation Gate (see below) to the user — showing exactly what will be created
4. Wait for explicit user confirmation via `AskUserQuestion` (user selects "Approve")
5. **Call `ExitPlanMode`** — this exits plan mode and unblocks all write tools
6. Only THEN proceed to Phase 2 (packaging) and beyond

**What counts as execution (blocked by `EnterPlanMode` until `ExitPlanMode`):**
- Creating any directory structures or files (MANIFEST.MF, .project, metainfo.prop, scripts)
- Writing to the `.tmp/` directory
- Any artifact packaging work

**What is allowed in plan mode (before user confirmation):**
- Reading reference files and samples within the skill directory
- Reading user-provided script files or paths
- `AskUserQuestion` for gathering missing requirements and clarifying scripts

If the user's input is ambiguous or incomplete, ask clarifying questions rather than proceeding with assumptions. Never skip the confirmation step.

## MANDATORY: Structured Question Format (AskUserQuestion)

**Every question presented to the user MUST use the `AskUserQuestion` tool.** Never present questions as plain text, blockquotes, or markdown-formatted questions. This applies to ALL phases and ALL question types.

### Question Type Mapping

| Category | When | AskUserQuestion Strategy |
|----------|------|--------------------------|
| **Enumerated choices** | Script language (Groovy/JavaScript) | Use 2-4 specific `options` with descriptive labels |
| **Open-ended** | Script purpose, package ID, file names | Present the question with 2-3 common-pattern options — user selects "Other" (always available) for custom input |
| **Design confirmation gates** | Design Gate | Use 2 `options`: "Approve — proceed" / "Request changes" |

## Phase 1: Gather Scripts

Collect the scripts to bundle:

| Field | Required? |
|-------|-----------|
| Artifact name and ID | Yes — naming: `SC_{Purpose}` or `{System}_{Purpose}_Scripts` |
| Package ID | Yes |
| Script files to include | Yes — list each .groovy file |
| Purpose/description per script | Yes — for documentation |

**Naming convention for scripts:** `camelCase.groovy` (e.g., `transformPayload.groovy`, `errorUtils.groovy`)

**Standard Groovy entry point:**
```groovy
import com.sap.gateway.ip.core.customdev.util.Message

def Message processData(Message message) {
    // Your logic here
    return message
}
```

**Standard JavaScript entry point (also supported):**
```javascript
function processData(message) {
    var body = message.getBody(java.lang.String);
    // Your logic here
    message.setBody(body);
    return message;
}
```

> **Note:** Groovy is preferred over JavaScript for new scripts. JavaScript is supported for legacy compatibility.

## Design Confirmation Gate (MANDATORY)

> This gate comes AFTER Phase 1 (gather scripts) and BEFORE Phase 2 (packaging). Do NOT proceed to Phase 2 until the user confirms the design.

**After gathering all script information in Phase 1, present the following design summary:**

~~~
================================================
  SCRIPT COLLECTION DESIGN SUMMARY
================================================

  General
  ------------------------------------------------
  | Field               | Value                   |
  |---------------------|-------------------------|
  | Artifact Name       | <display name>          |
  | Artifact ID         | <SC_Purpose or ID>      |
  | Package ID          | <package_id>            |
  | Bundle-SymbolicName | <same as Artifact ID>   |

  Scripts to Bundle
  ------------------------------------------------
  | #  | Filename            | Language   | Entry Point              | Purpose              |
  |----|---------------------|------------|--------------------------|----------------------|
  | 1  | <script1.groovy>    | Groovy     | processData(Message)     | <description>        |
  | 2  | <script2.groovy>    | Groovy     | processData(Message)     | <description>        |
  | 3  | <utils.js>          | JavaScript | processData(message)     | <description>        |

  JAR Dependencies (if any)
  ------------------------------------------------
  | Library              | Purpose                                  |
  |----------------------|------------------------------------------|
  | <lib.jar>            | <description>                            |
  | (none)               |                                          |

  Files to Generate
  ------------------------------------------------
  | File Path                                       | Purpose             |
  |-------------------------------------------------|---------------------|
  | META-INF/MANIFEST.MF                             | Bundle manifest     |
  | .project                                         | Eclipse project     |
  | metainfo.prop                                    | Description file    |
  | src/main/resources/script/<script1>.groovy        | Groovy script       |
  | src/main/resources/script/<script2>.groovy        | Groovy script       |
  | src/main/resources/lib/<lib>.jar                  | JAR dependency      |

  iFlow Integration Notes
  ------------------------------------------------
  Referencing iFlows must add to their MANIFEST.MF:
    Require-Bundle: <ArtifactId>
  Groovy Script steps in referencing iFlows must set:
    scriptBundleId = <ArtifactId>
  Deploy this Script Collection BEFORE any referencing iFlows.
~~~

**After presenting the summary, ask the user using the `AskUserQuestion` tool:**

Use `AskUserQuestion` with:
- question: "Does this Script Collection design match your requirements? Please review the scripts, file structure, and naming."
- header: `Design`
- options:
  - label: "Approve — proceed to packaging", description: "The design is correct, proceed to Phase 2"
  - label: "Request changes", description: "I want to modify scripts, naming, or other details before proceeding"

**Do NOT proceed to Phase 2 until the user confirms the design is correct.**

If the user requests changes, update the design and re-present the summary. Only after explicit confirmation:

1. Call `ExitPlanMode` to unblock write tools
2. Output: "Design confirmed. Exited plan mode. Proceeding to Phase 2: Package."

## Phase 2: Package

Create the Script Collection directory structure:

```
{ArtifactId}/
  .project                                    — Eclipse project descriptor
  META-INF/
    MANIFEST.MF                               — SAP-BundleType: ScriptCollection
  metainfo.prop                               — Empty description file
  src/main/resources/
    script/
      {script1}.groovy                        — Groovy scripts
      {script2}.js                            — JavaScript scripts (optional)
    lib/                                      — (optional) JAR dependencies
      {library}.jar
```

> A real sample is at `./references/sample-script-collection/` — use it as your structural reference.

**MANIFEST.MF format** (use the sample as template — replace Bundle-Name, Bundle-SymbolicName, Provide-Capability):
```
Manifest-Version: 1.0
Bundle-ManifestVersion: 2
Bundle-Name: {Artifact Display Name}
Bundle-SymbolicName: {ArtifactId}
Bundle-Version: 1.0.0
SAP-BundleType: ScriptCollection
SAP-NodeType: IFLMAP
Import-Package: org.osgi.framework
Provide-Capability: scriptcollection.{ArtifactId};version:Version="1.0.0"
```

Key headers:
- `SAP-BundleType: ScriptCollection` — identifies this as a Script Collection (not `IntegrationFlow` or `MessageMapping`)
- `SAP-NodeType: IFLMAP` — required node type
- `Provide-Capability: scriptcollection.{ArtifactId};version:Version="1.0.0"` — **required** so iFlows can reference this collection via `Require-Bundle`
- `Import-Package: org.osgi.framework` — minimum required import

**.project file:**
```xml
<?xml version="1.0" encoding="UTF-8"?><projectDescription>
   <name>{ArtifactId}</name>
   <comment/>
   <projects/>
   <buildSpec>
      <buildCommand>
         <name>org.eclipse.jdt.core.javabuilder</name>
         <arguments/>
      </buildCommand>
   </buildSpec>
   <natures>
      <nature>org.eclipse.jdt.core.javanature</nature>
      <nature>com.sap.ide.ifl.project.support.project.nature</nature>
      <nature>com.sap.ide.ifl.bsn</nature>
   </natures>
</projectDescription>
```

> MANIFEST.MF rules: Wrap lines at 70 bytes. Continuation lines start with exactly one space. File must end with a newline.

**No `parameters.prop` or `parameters.propdef` needed** — Script Collections have no configurable parameters.

## Phase 3: Upload via CPI Web UI

> Script Collections cannot be uploaded via the MCP server. Follow these steps in the CPI Web UI:

1. Open SAP Integration Suite → Design → Integrations
2. Open or create the target package
3. Click **Edit** → **Add** → **Script Collection**
4. Enter the Name and ID matching your MANIFEST.MF `Bundle-SymbolicName`
5. Upload the scripts (Add → Script → select each .groovy file)
6. Click **Save** → **Deploy**

**Verify deployment:**
- In the package, the Script Collection should show status **Started**
- If status is FAILED, check for Groovy syntax errors

## Completion Summary

Present:
- Artifact ID and package
- Scripts bundled (filename + purpose)
- Upload instructions (Web UI steps above)
- iFlow integration notes: any referencing iFlows must add `Require-Bundle: {BundleSymbolicName}` to MANIFEST.MF and set `scriptBundleId` on Groovy Script callActivity steps

## Cross-Skill Notes

- **iFlow using these scripts:** Use `ci-iflow-developer`. The iFlow's Groovy Script step needs `scriptBundleId = {this artifact's ID}` and `script = {filename}`. The iFlow's MANIFEST.MF needs `Require-Bundle: {BundleSymbolicName}`.
- **Deploy order:** Always deploy this Script Collection BEFORE the iFlows that reference it.
- **Sample artifact:** See `./references/sample-script-collection/` for a real exported Script Collection with Groovy scripts, JavaScript scripts, and a JAR dependency.
