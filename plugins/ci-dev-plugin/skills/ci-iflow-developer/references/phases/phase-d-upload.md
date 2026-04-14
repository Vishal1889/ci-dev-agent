## Phase D: Upload to Cloud Integration

This server provides **dedicated tools** for upload. You do NOT need to manually ZIP, base64-encode, or handle CSRF tokens. The server does it all.

### Upload Sequence

> **Parallelization:** Run `get-package-details` and `list-iflows-in-package` in parallel. If `list-iflows-in-package` returns HTTP 404, the package doesn't exist — create it with `create-package`, then re-run `list-iflows-in-package`. Both calls are read-only lookups; the 404 case is a known-safe failure.

1. **Verify package exists:**
   ```
   Tool: get-package-details
   Parameters: { destinationName: "<dest>", id: "<PackageId>" }
   ```
   If not found: create with `create-package`.

2. **Check if artifact already exists** in the package:
   ```
   Tool: list-iflows-in-package
   Parameters: { destinationName: "<dest>", packageId: "<PackageId>" }
   ```

3. **Branch based on result:**

   **IF NEW (artifact does not exist):**
   - Scaffold: `scaffold-iflow` with `packageId`, `id`, `name`
   - **Read scaffolded content and extract structural boilerplate:** Call `get-iflow-content`. Extract: (a) the exact `.iflw` filepath (display Name with spaces, not artifact ID), (b) the `<bpmn2:definitions>` opening tag with ALL attributes, (c) the `<bpmn2:collaboration>` extensionElements properties list, (d) any `<bpmn2:documentation>` element, (e) participant extensionElements. **Pass this structural data back to Phase C step 3** for scaffold-first BPMN generation. See `bpmn-generation-guide.md` §0 "Scaffold-First Generation Rule".
   - **Use that exact `.iflw` filepath** in `update-iflow-content` — see ⛔ CRITICAL in Step 4.
   - Then upload content: `update-iflow-content` (see step 4)

   **IF EXISTS (artifact already present):**
   - Read current content: `get-iflow-content` to see what's deployed
   - **Record the current design-time version** from the API response (e.g., `version: "1.0.5"`)
   - Show the user what exists and the version, get confirmation before overwriting
   - Then upload content: `update-iflow-content` (see step 4)
   - If Phase E deployment fails repeatedly and the user chooses to abort in Phase G, offer: *"The previous version was {version}. Would you like me to attempt restoring it?"*

4. **Upload content via update:**

   > **⛔ CRITICAL: Use the exact `.iflw` filepath from `get-iflow-content`.** After scaffolding (new artifact) or reading (existing artifact), the `.iflw` filename is known. Use that exact path — do NOT generate a new filename. The filename typically uses the **display Name with spaces** (e.g., `CHS OTC RackManifest SemStream to S4.iflw`), not the artifact ID with underscores.

   ```
   Tool: update-iflow-content
   Parameters: {
     destinationName: "<dest>",
     id: "<ArtifactId>",
     files: [
       { filepath: "src/main/resources/scenarioflows/integrationflow/<EXACT_NAME_FROM_GET_IFLOW_CONTENT>.iflw", content: "..." },
       { filepath: "src/main/resources/script/transform.groovy", content: "..." },
       { filepath: "src/main/resources/parameters.prop", content: "#key=value format\nreceiver.Address=https://..." },
       { filepath: "src/main/resources/parameters.propdef", content: "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?><parameters>...</parameters>" }
     ]
   }
   ```

   > **CRITICAL: Do NOT overwrite the scaffolded MANIFEST.MF** unless you need to add `Require-Capability` for Script Collection references. The scaffold generates the correct `Import-Package` and `Import-Service` for the tenant. Hand-crafted MANIFEST.MF with different `Import-Package` versions (e.g., `org.apache.camel;version="2.8"`) or missing `Import-Service` entries causes deployment failures on some tenants. If you must modify MANIFEST.MF, ensure formatting rules (72-byte line limit, continuation lines start with single space, file ends with newline).

   > **Uploading `parameters.prop`/`parameters.propdef` to fresh scaffolds is safe.** The previously documented UI corruption was caused by `&amp;` in `schedule1` getting decoded to bare `&` during the upload pipeline — not by the upload itself. **After every upload containing a `Scheduler` parameter, verify with `get-iflow-content` that `schedule1` contains `&amp;trigger.timeZone` (not `&trigger.timeZone`).** See `known-errors.md` "SAXParseException / &amp; decoding in schedule1".

   > **Key advantage over generic MCP server:** You send plain text file content. The server handles download → extract → patch → ZIP → base64 → upload → CSRF automatically.

5. **Validate uploaded artifact (build check):**
   ```
   Tool: get-iflow-build-errors
   Parameters: { destinationName: "<dest>", id: "<ArtifactId>" }
   ```
   If `FAILED`: check `./references/guides/known-errors.md` for known build issues before attempting custom fixes. Loop within Phase D — fix artifact files → re-upload (step 4) → re-validate (step 5). Only exit Phase D to Phase E when build errors are clean. This is an inner loop within Phase D, not a phase regression.

### For Message Mappings

Same pattern but with mapping-specific tools:
```
Tool: scaffold-message-mapping → update-message-mapping-content → deploy-message-mapping
```


### Workflow Anti-Patterns — Avoid These

| Anti-Pattern | Why | Correct Approach |
|-------------|-----|-----------------|
| Skip `get-iflow-content` after scaffold | `.iflw` filename uses display Name (with spaces), not artifact ID. Wrong name causes "must contain only one integration flow" error | Always `get-iflow-content` after `scaffold-iflow` to discover the exact `.iflw` filepath |
| Skip package existence check | `scaffold-iflow` will fail | Verify with `list-all-packages` or `get-package-details` first |
| Update without reading first | Will overwrite blindly | Always `get-iflow-content` before `update-iflow-content` |
| Deploy without validating | Wastes a deployment cycle | Always `get-iflow-build-errors` before `deploy-iflow` |
| Deploy iFlow before mapping | Will fail on missing references | Deploy mappings first, then iFlows |
| Retry without reading error | Wastes attempts on same error | Always `get-deploy-error` before retrying |
| Copy-paste sample iFlow without adapting | Silent BPMN errors at deployment | Reuse structure only; generate fresh element IDs and populate all properties from metadata lookups |
| Deploy iFlow with ScriptCollection ref without checking | `Cannot find ScriptCollection` error | Verify Script Collection is deployed first. Check `scriptBundleId` matches exactly. |
| Create circular Process Call chain | `Circular reference detected` / infinite loop | Trace full call chain before generating. No LIP may call back to a previous caller. |
| Combine OAuth2 with on-premise proxy | `Invalid value` deployment error | `OAuth2 Client Credentials` requires `proxyType=default`. Never combine with `on-premise`. |
| Write >10MB payload to Data Store | `Data store entry too large` error | Split payload with Splitter step before Data Store Write. 10MB per entry limit. |
| Pass artifact ID to `get-messages` iflowName filter | Returns no results — API uses display name | Use iFlow display name (e.g., `Order Replication`), NOT artifact ID (e.g., `IF_Order_Replication`) |
| Upload `parameters.prop` with decoded `&amp;` in `schedule1` | "Error while loading" in Web UI — `&amp;` decoded to bare `&` breaks schedule parser | After upload, verify `schedule1` contains `&amp;trigger.timeZone` via `get-iflow-content` |
| Generate BPMN purely from templates without reading scaffold | `GenerationFailed` — missing scaffold structural boilerplate | Use scaffold-first workflow: read scaffold XML, preserve its structure, merge custom content |


> **Phase gate:** Output: "Phase D complete — artifact {ArtifactId} uploaded and build-validated. Reading phase-e-deploy.md."
> Then: Read `./references/phases/phase-e-deploy.md` before proceeding to Phase E.
