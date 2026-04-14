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

4. **After successful validation — ASK the user** whether to keep the iFlow deployed or undeploy it:
   > "The iFlow deployed and verified successfully against requirements. Should I keep it deployed, or undeploy it?"

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
8. **If the error was resolved and is NOT already in `known-errors.md`**, append a new entry using the `## Error:` heading format:
   ```
   File: ./references/guides/known-errors.md
   Format:
   ## Error: "{exact error string}"
   - **Phase:** {D/E/runtime}
   - **Root Cause:** {root cause}
   - **Fix:** {fix applied}
   - **Grep key:** `{key fragment}`
   - **Category:** DISCOVERED — {date}
   ```
   This builds a growing knowledge base of deployment issues and their resolutions.
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


> **Phase gate:** After successful deployment (Phase E step 4 complete), output: "Phase E complete — {ArtifactId} deployed. Reading phase-fgh-completion.md."
> Then: Read `./references/phases/phase-fgh-completion.md` before proceeding to Phase F/G/H.
