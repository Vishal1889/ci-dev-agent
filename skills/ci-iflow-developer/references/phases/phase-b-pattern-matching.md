## Phase B: Pattern Matching & Reference Selection

### B.0: HARD RULE — Template selection is MANDATORY

You **MUST** select one template from the lookup table below and **READ IT IN FULL** before any BPMN generation in Phase C. **Generating BPMN from scratch is forbidden.** The minimal-iflow templates are the validated source of truth for adapter wiring, sequenceFlow structure, and BPMNDiagram coordinates — every shipped template has been deployment-tested. Going off-template is the single largest cause of `GenerationFailed` and "Error while loading the integration flow" errors.

**If no row in the lookup table matches the user's requirements:** STOP. Do NOT pick a "closest structural match" on your own. Use `AskUserQuestion` to present the 2-3 most-similar templates to the user with a short description of each, and let the user pick. If the user says none fit, STOP and tell them this iFlow shape is outside what the skill supports — escalate to manual development in the CPI Web UI.

### B.0a: Composable templates (Exception Subprocess)

Exception Subprocess is the only "composable" entry in the lookup table — it is NOT a standalone iFlow shape, it is grafted onto a primary template. **If the Phase A design includes ANY error-handling subprocess** (the user asked for one, the template you picked already has one, or the design summary mentioned exception handling / error routing / failure capture), you MUST also read [`./references/minimal-iflows/07-exception-subprocess.iflw`](../minimal-iflows/07-exception-subprocess.iflw) in full before proceeding to Phase C. This is a **SECOND mandatory Read** on top of your primary template.

The Phase B gate output must name BOTH files when this applies:

> "Phase B complete — Template selected: `<primary>.iflw` (read N chars) + `07-exception-subprocess.iflw` (read M chars for composable Exception Subprocess). Reading phase-c-generation.md."

If you forget the second Read, Phase C's §C.0b precondition check will catch it and send you back here. **Why this matters:** generating Exception Subprocess XML from memory produces a subprocess that CPI's runtime accepts but the Web UI cannot render — it shows as an empty featureless rectangle (see known-errors.md #30). The only reliable way to avoid this is to copy the subprocess block from template 07.

### B.1: Select Template

Match the confirmed requirements from Phase A against this lookup table:

| Trigger | Receivers | Routing? | Splitting? | Template |
|---------|-----------|----------|------------|----------|
| HTTPS/SOAP/ProcessDirect | 1 sync | No | No | `01-sync-request-reply` |
| Any | 1 async (SFTP/JMS/Mail) | No | No | `02-async-send-fire-and-forget` |
| Timer | 0 or 1 | No | No | `03-timer-triggered` |
| Any | 2+ | Yes (content-based) | No | `04-router-conditional-branching` |
| Any | 2+ | No (parallel fanout) | No | `05-multicast-parallel-fanout` |
| Any | 1+ | No | Yes | `06-splitter-lip-process-call` |
| (composable — add to any template) | — | — | — | `07-exception-subprocess` |
| Any | 2+ sequential | No | No | `08-multi-receiver-chain` |
| Any + mid-flow fetch | 1+ | No | No | `09-poll-enrich` |
| Any | 1+ | No | No (dedup/retry) | `10-idempotent-looping-process-call` |
| Timer | 0 (internal) | No | No | `11-data-store-and-variables` |
| AS2/B2B | 1 (security) | No | No | `12-security-encryption-signing` |
| Any | 1+ (format conversion) | Optional | No | `13-format-converters-validators` |
| IDoc/XI/AS2 | 1+ (EDI) | No | Yes | `14-edi-b2b-pipeline` |

**If no row matches exactly:** STOP. Use `AskUserQuestion` to present the 2-3 closest templates to the user with a short description of each, and let them pick. If none fit, escalate to manual CPI Web UI development. **Do NOT silently pick a "closest structural match" yourself.** (See §B.0 — this is the hard rule that prevents off-template hallucination.)

**Fast path** (skip B.2 metadata lookup and proceed directly to Phase C):
IF archetype confidence = High AND COMPLEXITY_MODIFIERS = none AND single sender + single receiver AND no mapping needed
→ Select template from table → **Read the full template file** → proceed to Phase C with the template content in context.
Even the fast path REQUIRES reading the template — the only thing you skip is metadata lookup, not the template itself.

### B.2: Read Template + Metadata Lookup

Run in parallel:

**Read the template:**
```
Read `./references/minimal-iflows/{template-name}.iflw`
```
Template files are named `{template-name}.iflw` (e.g., `01-sync-request-reply.iflw`) in `./references/minimal-iflows/`.

Use the template for: step types, sequenceFlow wiring patterns, adapter configurations, coordinate layout. **Do NOT use templates for structural boilerplate** (definitions attributes, collaboration-level properties, participant extensionElements) — use the scaffold's actual XML for these (see bpmn-generation-guide.md §0 "Scaffold-First Generation Rule"). Do NOT copy: element IDs (generate fresh), adapter property values, endpoint URLs, credential names.

**Read adapter metadata** (for each sender/receiver adapter needed):
```
Read `./references/metadata/adapters/{adapter}_{direction}.json`
```
Examples: `sftp_sender.json`, `http_receiver.json`, `soap_sender.json`, `odata_receiver.json`

For the full list of available adapter files, see `./references/metadata/adapters/` — each file contains the exact `adapterVariantURI` string plus all configurable properties.

**Read step metadata** (for each non-trivial processing step):
```
Read `./references/metadata/steps/{step}.json`
```
Examples: `content_modifier.json`, `groovy_script.json`, `router.json`, `general_splitter.json`

Each metadata file contains: name, cmdVariantUri/adapterVariantURI, BPMN element type, activityType, componentVersion, and all configurable properties with keys, valid values, defaults, and conditional visibility rules.

### Reference Priority (use in this order)

| Priority | Resource | How to access | Use for |
|----------|----------|---------------|---------|
| 1st | Template lookup table (above) | This file | Template selection (Phase B.1) |
| 2nd | Minimal iFlow templates | Read `./references/minimal-iflows/{name}.iflw` | Structural patterns (Phase B.2) |
| 3rd | Distilled adapter/step metadata | Read `./references/metadata/adapters/{a}_{dir}.json` or `steps/{s}.json` | Exact cmdVariantURI, property keys/values (Phase B.2) |
| 4th | BPMN Generation Guide | Read relevant sections of `./references/guides/bpmn-generation-guide.md` | XML wiring rules, coordinate layout (Phase C) |

**bpmn-generation-guide.md Section Map** (~850 lines — read selectively, not entirely):
| Section | Lines (approx) | When to Read |
|---------|---------------|-------------|
| §1 Namespaces | ~1-26 | ALWAYS |
| §2 Document Structure | ~27-40 | ALWAYS |
| §3 Collaboration (§3.1-§3.4) | ~41-213 | ALWAYS (participants, process properties, messageFlows) |
| §4 Process Steps & cmdVariantUri | ~214-337 | Read subsections for your step types |
| §4.2-4.6 Step-Specific Rules | ~338-451 | Timer, Content Modifier, Router, Request-Reply/Send XML, Exception Subprocess |
| §5 Sequence Flow Wiring | ~453-501 | ALWAYS |
| §6 Element ID Convention | ~502-523 | ALWAYS |
| §7 Coordinate Layout | ~524-664 | ALWAYS |
| §8 MANIFEST.MF Templates | ~665-758 | ALWAYS |
| §9 parameters.prop | ~759-783 | If using externalized parameters |
| §10 parameters.propdef | ~784-829 | If using externalized parameters |

**Supplementary guides** (read when keywords match):
| Keywords in Requirements | Guide to Read |
|--------------------------|--------------|
| timer, schedule, cron, polling interval, run once, weekdays, recurring | `./references/guides/scheduler-configuration-guide.md` |
| known error, deploy error, build error, troubleshooting | `./references/guides/known-errors.md` |


> **Phase gate:** Output: "Phase B complete — Template selected: `{template-name}.iflw` (read {N} chars){if Exception Subprocess in design: ' + 07-exception-subprocess.iflw (read {M} chars for composable Exception Subprocess)'}. Reading phase-c-generation.md."
> Then: Read `./references/phases/phase-c-generation.md` before proceeding to Phase C.
