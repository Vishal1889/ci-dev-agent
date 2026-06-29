## Phase E: Deploy & Error Resolution (Attempts 1-10, Local Fixes)

> **Multi-artifact execution:** When deploying multiple artifacts, run Phase D + Phase E **sequentially for each artifact** in dependency order (from Phase C.2). Deploy artifact 1 fully (upload → build validate → deploy → verify) before starting artifact 2. This ensures dependencies are live before dependents are deployed. Example for ProcessDirect chain: deploy receiver iFlow first (Phase D+E), then deploy caller iFlow (Phase D+E).

### Deploy Sequence

1. **Deploy:**
   ```
   Tool: deploy-iflow
   Parameters: { destinationName: "<dest>", id: "<ArtifactId>" }
   ```
   This tool automatically: saves a new design-time version → triggers the CPI runtime deployment → polls the deployment status API for up to 5 minutes → returns SUCCESS, FAIL, or TIMEOUT.

   > **You do NOT need to manually save a version, trigger deployment, or poll status.** The tool handles the entire CPI deployment lifecycle. If it returns TIMEOUT (still in progress after 5 minutes), check the Cloud Integration web UI to monitor further.

2. **If SUCCESS:** Verify the endpoint:
   ```
   Tool: get-iflow-endpoints
   Parameters: { destinationName: "<dest>", runtimeDestination: "<runtime-dest>", id: "<ArtifactId>" }
   ```

3. **Post-Deploy Validation — verify against requirements:**

   > **⚡ Context optimization:** If the artifact's local `.tmp/` files are still available (i.e., this is a fresh generation in the current session), validate against those local files — do NOT call `get-iflow-content`. The local files represent exactly what was just uploaded and deployed, and fetching the full artifact from the API again consumes ~15-20k tokens unnecessarily. Only call `get-iflow-content` if the local `.tmp/` files are unavailable (e.g., updating a pre-existing artifact, or the `.tmp/` directory was cleaned up early).

   Compare the Phase A Gate summary table fields against the generated/deployed artifact:
   - **Participants:** Sender/receiver participant names present and matching Phase A source/target system names (allow PascalCase/underscore normalization, e.g., "SAP S/4HANA" → `SAP_S4HANA`)
   - **Adapters:** Correct adapter types on each messageFlow, matching Phase A adapter types
   - **Flow steps:** All steps from Phase A "Processing Steps" table present in correct order
   - **Sequence flows:** Steps wired correctly — start → steps → end, no orphaned elements
   - **Exception handling:** Exception subprocess present if Phase A specified error handling = Yes
   - **Externalized parameters:** All `{{paramName}}` values have entries in both `parameters.prop` and `parameters.propdef`
   - **Scripts/Mappings:** All referenced script and mapping files exist in the artifact
   - **Timer schedule:** If timer-triggered, schedule configuration matches Phase A trigger specification

   If any discrepancy is found between the deployed iFlow and the original requirements, fix the issue and re-upload/re-deploy before proceeding.

4. **After successful validation — ASK the user** whether to keep the iFlow deployed or undeploy it, using the `AskUserQuestion` tool:

   Use `AskUserQuestion` with:
   - question: "The iFlow deployed and verified successfully against requirements. Should I keep it deployed, or undeploy it?"
   - header: `Deploy`
   - options:
     - label: "Keep deployed", description: "Leave the iFlow running on the runtime"
     - label: "Undeploy", description: "Remove from runtime — design-time source remains intact and can be re-deployed later"

   If user wants to undeploy:
   ```
   Tool: undeploy-artifact
   Parameters: { destinationName: "<dest>", id: "<ArtifactId>" }
   ```
   This removes the artifact from the runtime only. The design-time source remains intact and can be re-deployed at any time.

   > **Phase gate:** After step 4 completes (user confirmed deploy/undeploy decision), proceed to **Phase H: Completion Summary**.

**If deploy (step 1) returns FAIL:** Skip steps 2-4 and execute the error resolution loop below.

### Or use autoDeploy shortcut

**When to use `autoDeploy`:** Only on retry attempts (attempt 2+) where `get-iflow-build-errors` already returned clean in Phase D. **Never** use on the first deployment attempt — always run the full Phase D validation → Phase E deploy sequence first.

Combine upload and deploy in one call:
```
Tool: update-iflow-content
Parameters: {
  destinationName: "<dest>",
  id: "<ArtifactId>",
  files: [...],
  autoDeploy: true
}
```

### Error Resolution Loop

1. **Get the deployment error:**
   ```
   Tool: get-deploy-error
   Parameters: { destinationName: "<dest>", id: "<ArtifactId>" }
   ```
2. **Check known errors FIRST:** Read `./references/guides/known-errors.md` and match the error message. If a match is found, apply the documented fix directly — skip further investigation.
3. **MANDATORY: Read metadata before attempting any fix.** For adapter/step configuration errors, ALWAYS read the distilled metadata file BEFORE making changes:
   ```
   Read `./references/metadata/adapters/{adapter}_{direction}.json`   (for adapter issues)
   Read `./references/metadata/steps/{step}.json`                     (for step issues)
   ```
   These files contain exact property keys, valid values, defaults, and conditional requirements. Use them as the source of truth — do NOT fix properties from memory.
   - **If the metadata file does not exist** for the failing adapter/step, or the error involves a property not listed in the metadata: **STOP immediately.** Tell the user: *"The deployment error involves {adapter/step} which I don't have complete metadata for. The error is: {error}. Please fix this manually in the CPI Web UI or provide the correct configuration."* Log it as a user action item and proceed to Phase H with PARTIAL status.
4. For structural issues (sequence flow errors, missing steps), read current iflow content:
   ```
   Tool: get-iflow-content
   Parameters: { destinationName: "<dest>", id: "<ArtifactId>" }
   ```
5. Fix the issue in the artifact source files.
6. Re-upload via `update-iflow-content`, re-validate, re-deploy. For minor property changes, use `autoDeploy: true`. For structural fixes, always re-run `get-iflow-build-errors` before deploying.

   > **Large iFlow re-uploads (40KB+ .iflw):** When fixing errors on large iFlows, do NOT re-read the full artifact content into the main context. Instead: (a) edit the local `.tmp/` file with the targeted fix using the Edit tool, (b) delegate the re-upload to a **sub-agent** using the "Large iFlow Upload Strategy" pattern from Phase D. The sub-agent reads the file, uploads it, and returns the exact build-error response for the main agent to evaluate.
8. **If the error was resolved and is NOT already in `known-errors.md`**, capture the discovery in working memory — **do NOT modify `known-errors.md` or any other file in the skill tree.** This skill is shipped as an immutable npm package; writes to `references/guides/known-errors.md` are blocked by the plugin's `PreToolUse` hook and would not propagate to other users even if they slipped through.

   Record these fields for the Phase H "New Error Discoveries" report:
   - **Exact error string** (verbatim from `get-deploy-error` output)
   - **Phase:** D / E / runtime
   - **Root cause:** short paragraph
   - **Fix that worked:** what you actually did to resolve it
   - **Grep key:** a short fragment (3-8 words) that uniquely matches the error string for future grep-based lookup

   These are emitted in the Phase H completion summary under the "New Error Discoveries" block. The user forwards them to the package maintainer (https://github.com/Vishal1889/ci-dev-agent/issues) for inclusion in the next ci-dev-agent release, after which all users get the new entry on `npm update`.
9. Track attempt count. An "attempt" = one complete cycle: (1) read error, (2) fix artifact, (3) re-upload, (4) re-deploy. **Phase E covers attempts 1-10.** If attempt 10 still fails, proceed to Phase F. If SUCCESS at any attempt, proceed to Phase E step 2 (verify endpoint + post-deploy validation).

**Context management during retries:** Before each retry attempt, summarize the previous error and fix in 1-2 lines (e.g., *"Attempt 3: Missing `httpMethod` property on HTTP adapter → added"*). Do NOT re-read `get-iflow-content` (full XML) unless the error specifically requires examining the overall BPMN structure. For adapter property errors, if the artifact source files are still in `.tmp/`, use Grep on the local `.iflw` file to extract only the relevant `<bpmn2:messageFlow>` block. If local files are unavailable (e.g., fixing an already-uploaded artifact), use `get-iflow-content` but focus analysis on the specific adapter section — do not examine the entire XML. For script errors, read only the referenced script file.

### Common Error Responses

| Error | Meaning | Action |
|-------|---------|--------|
| `deploy-iflow` returns `FAIL` | Deployment failed | Call `get-deploy-error` for details |
| `deploy-iflow` returns `TIMEOUT` | Taking > 5 minutes | Check Cloud Integration web UI or retry later |
| `get-iflow-build-errors` returns `FAILED` | Validation errors | Fix errors before deploying |
| HTTP 404 from `get-deploy-error` | Never deployed | Deploy the artifact first |
| HTTP 409 on `scaffold-iflow` | ID already exists | Use `update-iflow-content` instead |
| HTTP 403 on any Write tool | Insufficient scope | User needs CI_MCP_Developer role collection |


### E.6: Post-deploy runtime check (MANDATORY on SUCCESS)

`deploy-iflow` returning SUCCESS only means the artifact transitioned to "Started" state. It does NOT mean the iFlow is processing messages correctly. Polling adapters can fail their first poll, timer iFlows can fail their first scheduled execution, and configuration errors (credential aliases, parameter decoding) only surface at runtime. **Run this check BEFORE Phase H.**

#### E.6 Step 1: Capture deploy timestamp

Capture an ISO timestamp immediately after the `deploy-iflow` SUCCESS return:

```bash
DEPLOY_TS=$(date -u +"%Y-%m-%dT%H:%M:%S")
```

> **Note on Bash dates:** SKILL.md's "do not rely on bash `date` for timing" rule applies to *measuring phase durations* across tool calls (where clock drift between calls breaks accuracy). Capturing a single snapshot timestamp here is fine — `date -u` is identical across Windows git-bash, macOS, and Linux. Store `DEPLOY_TS` in working memory; you'll pass it to `get-messages-count` in Step 3.

#### E.6 Step 2: Wait 30 seconds

```bash
sleep 30
```

30 seconds is the right window for catching:
- Scheduler initialization errors (timer schedule parsing, cron expression validation)
- Credential lookup failures (Security Material alias resolution on first use)
- Polling adapters with sub-30s schedules

It is NOT long enough for default 5-minute polling intervals or far-future timer schedules — those are handled by the Phase H user-action item ("Verify first execution").

#### E.6 Step 3: Check for FAILED messages

```
Tool: get-messages-count
Parameters: {
  destinationName: "<design-time-dest>",
  filterProps: {
    iflowName: "<DISPLAY NAME>",
    status: "FAILED",
    logStart: "<DEPLOY_TS captured in Step 1>"
  }
}
```

> **CRITICAL:** `iflowName` is the **display name** of the iFlow (the `name` attribute on the participant or process), NOT the artifact ID. If you pass the artifact ID by mistake, the filter silently matches zero messages and you get a false PASS. The display name was captured in Phase A and is part of the design summary.

#### E.6 Step 4: Decision

- **If count == 0:** No runtime errors in the 30-second post-deploy window. Output: `"E.6 PASS — 0 failed messages in 30s post-deploy window."` Set `Runtime Status: CLEAN` for the Phase H summary. Proceed to Step 5 (optional smoke test) if applicable, otherwise jump to Step 6.

- **If count > 0:** Runtime errors are happening. Fetch details:
  ```
  Tool: get-messages
  Parameters: {
    destinationName: "<dest>",
    filterProps: {
      iflowName: "<display-name>",
      status: "FAILED",
      logStart: "<DEPLOY_TS>",
      top: 5
    },
    includeDetails: true
  }
  ```
  (`top: 5` keeps the cost bounded — `includeDetails: true` triggers 3-5 API calls per message per the MCP tool guide.) Set `Runtime Status: ERRORS_DETECTED` and capture the message ID, time, error text, and adapter for each failing message in working memory; the Phase H "Runtime Errors" block will render them.

  **Do NOT enter the Phase E error resolution loop.** These are runtime errors visible only after deploy. They almost always require user intervention (creating a credential in Security Material, fixing a destination in BTP cockpit, correcting a parameter decoding bug). The skill cannot fix them autonomously — report and let the user act.

#### E.6 Step 5: Optional synthetic smoke test (HTTP/SOAP/ProcessDirect senders only)

Skip this step entirely if EITHER:
- The iFlow's sender is NOT HTTP, SOAP, or ProcessDirect (e.g. SFTP, Mail, Timer, JMS, AMQP senders — no synchronous endpoint to POST to), OR
- The user did NOT opt in during Phase A by providing a `smokeTestPayload` (see [phase-a-requirements.md](./phase-a-requirements.md) — "Optional: Smoke-test payload").

When both conditions are met (sync sender + user-provided payload), and Step 4 passed:

```
Tool: get-iflow-endpoints       — already called earlier in Phase E; reuse the URL path
Tool: send-http-message
Parameters: {
  runtimeDestination: "<runtime-dest>",
  path: "<path from get-iflow-endpoints>",
  method: "POST",
  body: "<user-provided smokeTestPayload from Phase A>",
  contentType: "<user-provided contentType, default application/json>"
}
```

Then re-call `get-messages-count` with `status: FAILED, logStart: <DEPLOY_TS>` to confirm the synthetic message succeeded. If the count is now > 0, the synthetic call surfaced an error that the passive check missed — fetch details with `get-messages` and surface in the Phase H "Runtime Errors" block.

#### E.6 Step 6: Phase E → Phase H gate

> **Phase gate:** Output: "Phase E complete — {ArtifactId} deployed AND runtime check {PASS|FAIL}. Reading phase-fgh-completion.md."
> Then: Read `./references/phases/phase-fgh-completion.md` before proceeding to Phase F/G/H.
