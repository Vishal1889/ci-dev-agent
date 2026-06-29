## Phase F: Escalation & Advanced Error Resolution (Attempts 11-20)

If Phase E fails after 10 attempts, escalate with additional investigation techniques:

### Strategy: Attempts 11-15 — Tenant Reference Study
1. **Ask permission** to read existing deployed iFlows from the tenant for reference, using the `AskUserQuestion` tool:

   Use `AskUserQuestion` with:
   - question: "Can I read existing deployed iFlows from the tenant to find working reference patterns for debugging?"
   - header: `Permission`
   - options:
     - label: "Yes — read tenant iFlows", description: "Browse and study similar working iFlows for reference"
     - label: "No — skip", description: "Skip tenant study, continue with other debugging approaches"
2. Use `list-all-packages` and `list-iflows-in-package` to browse, find similar working iFlows.
3. Download and study with `get-iflow-content` — examine adapter properties, BPMN structure.
4. **Read distilled metadata** for all adapters/steps involved in the failing flow — `./references/metadata/adapters/{a}_{dir}.json` and `./references/metadata/steps/{s}.json`. Compare expected vs actual configuration.
5. Apply learnings from working iFlows + metadata files to fix the failing artifact.

### Strategy: Attempts 16-20 — Alternative Approaches
If tenant reference study did not resolve the issue:
1. **Simplify the iFlow:** Strip down to minimal working version (e.g., sender → Content Modifier → EndEvent). Deploy and verify the skeleton works. Then add steps back one at a time to isolate the failure.
2. **Try alternative adapter configurations:** If the error is adapter-specific, try a different authentication method, proxy type, or protocol version.
3. **Check for infrastructure issues:** If the error pattern suggests infrastructure (certificate, permissions, Cloud Connector), escalate early to the user — these cannot be fixed by artifact changes.

### Early Escalation Criteria
Escalate to user immediately (skip remaining attempts) if:
- Error is clearly infrastructure-related (certificate expired, HTTP 403 role-based, Cloud Connector unreachable)
- Error is credential-related and the user has not created the credential in Security Material
- The same error persists unchanged across 3+ consecutive attempts despite different fixes

### Continue / Exit
- **If SUCCESS at any attempt:** Proceed to Phase E step 2 (verify endpoint + post-deploy validation).
- **If attempt 20 still fails:** Proceed to Phase G.

## Phase G: User Decision — Partial Completion

If all attempts exhausted:

### Step 1: Present Current State
Summarize concretely:
- **What is deployed:** Which artifacts are successfully deployed and operational
- **What failed:** Which artifact(s) failed, the last error message, and what fixes were attempted
- **Root cause assessment:** Best understanding of why it's failing (BPMN structure issue, adapter configuration, infrastructure, credential)

### Step 2: Offer Options

Present the choices using the `AskUserQuestion` tool:

Use `AskUserQuestion` with:
- question: "All deployment attempts exhausted. How would you like to proceed with the failed artifact?"
- header: `Decision`
- options:
  - label: "Keep for manual fix", description: "Artifact stays uploaded (design-time) but undeployed. You can open it in the CPI Web UI to inspect and fix manually. I will provide the exact error, XML section to examine, and suggested fix."
  - label: "Continue debugging", description: "I will provide complete error log, generated artifact files (.iflw, scripts, manifests), and diff of changes attempted. You can modify files externally and re-upload via update-iflow-content."
  - label: "Abandon", description: "Give up on this artifact. I will ask whether to delete it or leave it for later."

**If user selects "Abandon"**, follow up with another `AskUserQuestion`:

Use `AskUserQuestion` with:
- question: "Should I delete the artifact from the package, or leave it for later?"
- header: `Cleanup`
- options:
  - label: "Delete from package", description: "Remove the artifact from design-time (undeploy first if deployed)"
  - label: "Keep for later", description: "Leave the artifact as-is in the package — you can return to it later"

If delete: call `undeploy-artifact` (if deployed) and confirm with user before deleting the design-time artifact.
If keep: leave as-is, note it in the completion summary.

### Step 3: Multi-Artifact Handling
If part of a set: report which artifacts succeeded/failed individually. Successfully deployed artifacts are NOT rolled back unless the user explicitly requests it.

**Always use `AskUserQuestion` before any cleanup — never auto-delete.**

> **Phase gate:** After user decision is complete, proceed to **Phase H: Completion Summary**.

## Phase H: Completion Summary

**MANDATORY — always present this at the end of every skill execution, whether successful or failed.**

```
═══════════════════════════════════════════════════
  EXECUTION SUMMARY — {Artifact Name}
═══════════════════════════════════════════════════

  Transport Mode: Stdio / HTTP (BTP)
  Tenant: {tenant name or "N/A (direct)"}
  Destination(s): {design-time dest} / {runtime dest}
  Status: SUCCESS / PARTIAL / FAILED
  Runtime Status: CLEAN / ERRORS_DETECTED / NOT_CHECKED

  Steps Completed:
    [DONE] Phase A: Requirement analysis and sub-agent extraction
    [DONE] Phase B: Pattern matching — Template: {template-name}
    [DONE] Phase C: BPMN XML generation (iflw, scripts, manifest)
    [DONE] Phase D: Package verified/created, artifact uploaded: {ArtifactId}
    [DONE] Phase E: Deployment successful ({N} attempts)
    [SKIP] Phase F: Escalation — not needed
    [SKIP] Phase G: User decision — not needed

  Steps Not Completed:
    [TODO] Credential setup (user action required in Cloud Integration web UI)
    [TODO] Configuration values not updated (defaults used)

  Artifacts Created:
    - iFlow: {Id} in package {PackageId}
    - Scripts: transform.groovy, errorHandler.groovy

  Errors Encountered & Resolved:
    - [Attempt 2] Missing adapter property → added to BPMN XML
    - [Attempt 4] Schema reference not found → corrected filepath

  Runtime Errors (post-deploy check at T+30s):
    ─────────────────────────────────────────────────────────────
    Message ID: {messageId}
    Time: {logEnd}
    Error: "{exact error text from MPL detail}"
    Adapter: {sender or receiver where it failed}
    ─────────────────────────────────────────────────────────────
    (Repeat for each failing message, up to 5)

    These errors occurred AFTER deployment but within the 30-second
    post-deploy window. Common causes: missing credentials in Security
    Material, wrong destination names in BTP cockpit, parameter
    decoding bugs (e.g. `&amp;` in schedule values), schema reference
    paths that don't match the artifact ZIP layout.

    The skill did NOT enter the Phase E error resolution loop because
    runtime errors usually require user intervention (BTP cockpit,
    CPI Web UI) — they can't be fixed by changing the .iflw XML.

    Next steps:
    1. Categorize each error. Credential errors → create the missing
       alias in CPI Web UI → Security Material.
    2. Destination errors → check the BTP cockpit destination is
       correctly configured.
    3. Configuration runtime errors → review with
       `get-iflow-configurations` and re-deploy with corrected values.
    4. If the root cause is a structural skill bug (recurring across
       runs), capture it in the "New Error Discoveries" block below.

  New Error Discoveries (forward to maintainer for next release):
    ─────────────────────────────────────────────────────────────
    ## Error: "{exact error string}"
    - **Phase:** {D/E/runtime}
    - **Root Cause:** {one-paragraph explanation}
    - **Fix:** {what actually resolved it}
    - **Grep key:** `{3-8 word fragment for future matching}`
    ─────────────────────────────────────────────────────────────

    These errors were NOT in known-errors.md. Send the block(s) above
    to the ci-dev-agent maintainer so they can be added to
    known-errors.md in the next release. File at:
      https://github.com/Vishal1889/ci-dev-agent/issues
    (Suggested labels: known-errors, triage)

  User Action Required:
    - Update credential '{alias}' with real values in Cloud Integration web UI
    - Review externalized parameters via get-iflow-configurations
    - [IF POLLING ADAPTER] Configure polling schedule: Open iFlow in Web UI → click sender adapter channel → Scheduler tab → set desired schedule (cron, daily, weekly, etc.)

  Timing:
    Phase A: 12s | Phase B: 5s | Phase C: 40s
    Phase D: 15s | Phase E: 25s
    Total: 1m 37s

  Temp files cleaned up: Yes
═══════════════════════════════════════════════════
```

Adapt the summary based on actual execution — omit sections that don't apply. In particular:

- **Show the "New Error Discoveries" block only when at least one new error was encountered AND resolved AND is not already in `known-errors.md`** (see [phase-e-deploy.md step 8](./phase-e-deploy.md) for the capture step). If every error you hit was already documented in `known-errors.md`, omit the block entirely. If you encountered no errors at all, omit both this and the "Errors Encountered & Resolved" section.
- **Always include the block when there ARE new discoveries** — even on a SUCCESS run. This is the only way new findings reach the package maintainer; under no circumstances should you "fix it locally" by editing `known-errors.md` (which is blocked by the plugin's `PreToolUse` hook and would not propagate anyway).
- **Show the "Runtime Errors" block only when `Runtime Status: ERRORS_DETECTED`** (§E.6 Step 4 found `count > 0`). Omit it entirely when `Runtime Status: CLEAN`. The `Runtime Status:` line itself is always shown — it's the at-a-glance answer to "did the deploy actually work, or just transition to Started state?"

**Mandatory user action items for polling and timer adapters (SFTP, FTP, Mail, JMS, AMQP, IBM MQ, Timer, etc.):**

When the iFlow uses a polling sender adapter OR a timer-triggered start event, ALWAYS include BOTH of these action items:

> **Configure Polling Schedule:** The iFlow was deployed with a default polling schedule (every 5 minutes). If you need a specific schedule (e.g., cron-based, weekdays only, specific time windows), open the iFlow in the **Cloud Integration Web UI** → click the **sender adapter channel** (e.g., SFTP) → go to the **Scheduler tab** → configure the desired schedule → **Save and Redeploy**.

> **Verify first execution:** The §E.6 post-deploy runtime check only covers the first **30 seconds** after deploy. Polling adapters with default 5-minute intervals, and timer iFlows scheduled for later times, **will not have fired yet within that window**. Open the iFlow in CPI Web UI → **Monitor → Message Monitoring** and verify the first execution succeeded within a few minutes of its expected start time. If the first run failed (status FAILED), check the error message — common causes are missing credentials, unreachable hosts, and wrong destination configurations.
>
> This is required because the CPI Web UI schedule editor uses an internal serialization format that cannot be reliably set via API upload.

---

## Additional Operations

### Test an iFlow End-to-End

```
Step 1: get-iflow-endpoints  — get the runtime URL
Step 2: send-http-message    — send a test payload
Step 3: get-messages          — check the processing log
```

### Test a Message Mapping

```
Step 1: create-mapping-test-iflow  — create echo test iflow
Step 2: deploy-iflow (if_echo_mapping)  — deploy the test infra
Step 3: get-iflow-endpoints  — get the endpoint URL
Step 4: send-http-message    — send test data
Step 5: get-messages          — verify results
```

### Monitor / Health Check

```
Step 1: get-messages-count (status: FAILED)  — count failures
Step 2: get-messages (status: FAILED, includeDetails: true)  — inspect
Step 3: get-deploy-error  — check deployment errors per artifact
```

---

## Anti-Patterns — Performance & API

| Anti-Pattern | Why | Correct Approach |
|-------------|-----|-----------------|
| Use `includeDetails: true` on 50+ messages | 250+ API calls, slow and costly | Filter to <10 messages first, then enable details |
| Pass `Authorization` header in `send-http-message` | Header is stripped for security | Let the server inject auth from BTP Destination |
| Use design-time destination for `send-http-message` | Sends to management API, not iflow | Use the runtime destination (`CPI_RUNTIME`) |
| Assume destination name in HTTP mode | Names vary per tenant | Resolve via tenant config (`config/tenant-destination-config.json`) or ask the user on the first call |

## Execution Mechanics

### Working Directory

> **⛔ NEVER use system temp directories (`/tmp`, `C:\tmp`, `%TEMP%`, `%LOCALAPPDATA%\Temp`, or any other path outside the project directory). NEVER write inside the installed plugin tree** (`skills/ci-iflow-developer/` — the plugin's `PreToolUse` hook rejects writes there). All working files MUST go under `<cwd>/.ci-dev-agent/runs/<artifact-id>/`, where `<cwd>` is the user's current project directory. This includes files created by sub-agents, extracted archives (e.g. DOCX embeddings), intermediate processing files, and any other temporary artifacts.

**Use `<cwd>/.ci-dev-agent/runs/<artifact-id>/` — always.**

```bash
WORK_DIR="$(pwd)/.ci-dev-agent/runs/${ARTIFACT_ID}"
mkdir -p "$WORK_DIR/META-INF" "$WORK_DIR/src/main/resources/scenarioflows/integrationflow" "$WORK_DIR/src/main/resources/script"
# On first creation of .ci-dev-agent/, drop a self-ignoring .gitignore (idempotent):
[[ -f "$(pwd)/.ci-dev-agent/.gitignore" ]] || echo "*" > "$(pwd)/.ci-dev-agent/.gitignore"
# Build artifact in $WORK_DIR
```

**For sub-agents that need temp directories** (e.g., unzipping sample iFlows for study):
- Pass the absolute working directory path in the sub-agent prompt — sub-agents do NOT inherit the main agent's working directory reliably.
- Sub-agents should clean up their own temp files when done; they should NOT clean up the parent `<cwd>/.ci-dev-agent/runs/<artifact-id>/` (the main agent handles that at end of run).

**Cleanup — clean on success, KEEP on failure:**
```bash
if [[ "$FINAL_STATUS" == "SUCCESS" && -n "${ARTIFACT_ID}" ]]; then
  rm -rf "$(pwd)/.ci-dev-agent/runs/${ARTIFACT_ID}"
  # Only remove the parent `runs/` dir if it has no other in-progress artifacts:
  rmdir "$(pwd)/.ci-dev-agent/runs" 2>/dev/null
  # Keep .ci-dev-agent/ and its .gitignore so subsequent runs reuse them.
else
  echo "Working directory kept at $(pwd)/.ci-dev-agent/runs/${ARTIFACT_ID} for debugging."
  echo "Inspect the generated files there. To clean up manually:"
  echo "  rm -rf $(pwd)/.ci-dev-agent/runs/${ARTIFACT_ID}"
fi
```
On PARTIAL or FAILED outcomes, leave the working directory intact so the user can inspect the generated `.iflw`, scripts, and other artifacts. Tell the user the path explicitly in the Phase H summary.

### Cross-Skill References
- MCP tool details: `./references/guides/ci-mcp-tool-guide.md`
- Known errors: `./references/guides/known-errors.md` (consult during Phase E error resolution)
- Template lookup: `./references/minimal-iflows/` (14 minimal .iflw templates, read directly in Phase B)
- Adapter/step metadata: `./references/metadata/adapters/` and `./references/metadata/steps/`
