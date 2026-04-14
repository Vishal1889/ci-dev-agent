## Phase F: Escalation & Advanced Error Resolution (Attempts 11-20)

If Phase E fails after 10 attempts, escalate with additional investigation techniques:

### Strategy: Attempts 11-15 — Tenant Reference Study
1. **Ask permission** to read existing deployed iFlows from the tenant for reference.
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
Present these concrete choices:

**Option A — Keep current state:**
- Artifact remains uploaded (design-time) but undeployed (not running).
- User can open it in the CPI Web UI to inspect and fix manually.
- Provide: the exact error, which XML section to examine, and suggested fix.

**Option B — Continue manual debugging:**
- Provide the user with: complete error log, generated artifact files (`.iflw`, scripts, manifests), and diff of changes attempted during Phase E/F.
- The user can modify files externally and re-upload via `update-iflow-content`.

**Option C — Abandon:**
- Ask user: *"Should I delete the artifact from the package, or leave it for later?"*
- If delete: call `undeploy-artifact` (if deployed) and confirm with user before deleting the design-time artifact.
- If keep: leave as-is, note it in the completion summary.

### Step 3: Multi-Artifact Handling
If part of a set: report which artifacts succeeded/failed individually. Successfully deployed artifacts are NOT rolled back unless the user explicitly requests it.

**Ask user before any cleanup — never auto-delete.**

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

Adapt the summary based on actual execution — omit sections that don't apply.

**Mandatory user action items for polling adapters (SFTP, FTP, Mail, etc.):**
When the iFlow uses a polling sender adapter, ALWAYS include this action item in the completion summary:
> **Configure Polling Schedule:** The iFlow was deployed with a default polling schedule (every 5 minutes). If you need a specific schedule (e.g., cron-based, weekdays only, specific time windows), open the iFlow in the **Cloud Integration Web UI** → click the **sender adapter channel** (e.g., SFTP) → go to the **Scheduler tab** → configure the desired schedule → **Save and Redeploy**.
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
| Assume destination name in HTTP mode | Names vary per tenant | Resolve via tenant config (`tenant-destination-config.json`) or ask the user on the first call |

## Execution Mechanics

### Temp Directory

> **⛔ NEVER use system temp directories (`/tmp`, `C:\tmp`, `C:\Users\*\AppData\Local\Temp`, or any other path outside the project directory).** All temporary files MUST be created inside `skills/ci-iflow-developer/.tmp/`. This includes files created by sub-agents, extracted archives, intermediate processing files, and any other temporary artifacts.

**Use the `.tmp` folder inside the skill directory — always.**

All paths below are relative to the skill root: `skills/ci-iflow-developer/`. Adjust for your platform (bash shown, adapt for PowerShell/Python as needed).

```bash
SKILL_DIR="skills/ci-iflow-developer"
TMPDIR="${SKILL_DIR}/.tmp/${ARTIFACT_ID}"
mkdir -p "$TMPDIR/META-INF" "$TMPDIR/src/main/resources/scenarioflows/integrationflow" "$TMPDIR/src/main/resources/script"
# Build artifact in $TMPDIR
```

**For sub-agents that need temp directories** (e.g., unzipping sample iFlows for study):
- Include this in the sub-agent prompt: `"Create any temp files under skills/ci-iflow-developer/.tmp/ — NEVER use /tmp or C:\tmp"`
- Sub-agents should clean up their temp files when done

**Cleanup — MANDATORY after successful completion:**
```bash
[[ -n "${ARTIFACT_ID}" ]] && rm -rf "${SKILL_DIR}/.tmp/${ARTIFACT_ID}"
rmdir "${SKILL_DIR}/.tmp" 2>/dev/null
```
On failure, leave `.tmp` intact for debugging. Inform the user of the path.

### Cross-Skill References
- MCP tool details: `./references/guides/ci-mcp-tool-guide.md`
- Known errors: `./references/guides/known-errors.md` (consult during Phase E error resolution)
- Template lookup: `./references/minimal-iflows/` (14 minimal .iflw templates, read directly in Phase B)
- Adapter/step metadata: `./references/metadata/adapters/` and `./references/metadata/steps/`
