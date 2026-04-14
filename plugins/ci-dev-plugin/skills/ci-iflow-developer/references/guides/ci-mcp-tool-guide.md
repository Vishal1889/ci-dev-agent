# SAP Cloud Integration MCP Server (Custom) — Tool Reference for AI Agents

This document describes every tool available through the `ci-mcp-server-custom` MCP server for interacting with SAP Cloud Integration. This server exposes **named tools with typed parameters** that abstract away ZIP handling, CSRF tokens, base64 encoding, and deployment polling.

**Total: 23 tools** across 5 categories.

---

## Quick Reference Index

| #  | Category | Tools | Section |
|----|----------|-------|---------|
| —  | **How Tools Work** | Typed parameters, destinations, scopes | [How Tools Work](#how-tools-work) |
| 1  | **Integration Packages** | `list-all-packages`, `get-package-details`, `create-package` | [Section 1](#1-integration-packages) |
| 2  | **Integration Flows** | `get-iflow-content`, `list-iflows-in-package`, `scaffold-iflow`, `update-iflow-content`, `deploy-iflow`, `undeploy-artifact`, `get-iflow-endpoints`, `get-iflow-configurations`, `get-iflow-build-errors`, `get-deploy-error` | [Section 2](#2-integration-flows) |
| 3  | **Message Mappings** | `get-message-mapping-content`, `get-all-message-mappings`, `scaffold-message-mapping`, `update-message-mapping-content`, `deploy-message-mapping`, `create-mapping-test-iflow` | [Section 3](#3-message-mappings) |
| 4  | **Message Processing** | `get-messages`, `get-messages-count`, `send-http-message` | [Section 4](#4-message-processing) |
| 5  | **Server Meta** | `get-server-info` | [Section 5](#5-server-meta) |
| —  | **Common Workflows** | Create & Deploy, Debug Failures, Health Check, Test Mappings | [Workflows](#common-workflows) |
| —  | **Tips for AI Agents** | Best practices for efficient tool usage | [Tips](#tips-for-ai-agents) |
| A  | **Scope Matrix** | Read vs Write tools, role collections | [Appendix A](#appendix-a-scope-matrix) |
| B  | **Destination Guide** | Stdio vs HTTP mode, destination names | [Appendix B](#appendix-b-destination-guide) |
| C  | **Error Recovery** | Common errors and fixes | [Appendix C](#appendix-c-error-recovery-playbook) |
| D  | **Anti-Patterns** | Common mistakes to avoid | [Appendix D](#appendix-d-common-anti-patterns) |
| E  | **Glossary** | Cloud Integration terms for non-SAP agents | [Appendix E](#appendix-e-glossary) |

### Quick Decision Guide

| I want to... | Use this tool |
|---------------|--------------|
| See all packages | `list-all-packages` |
| See iFlows in a package | `list-iflows-in-package` with `packageId` |
| See what's inside an iFlow (BPMN, scripts) | `get-iflow-content` — returns all extracted files as text; use `filesOnly: true` to get only file paths |
| Create a new iFlow | `scaffold-iflow` then `update-iflow-content` to add content |
| Modify an existing iFlow | `get-iflow-content` to read, then `update-iflow-content` with changed files |
| Deploy an iFlow | `deploy-iflow` — auto-increments version and polls status |
| Undeploy any artifact from runtime | `undeploy-artifact` — removes from runtime, keeps design-time source |
| Update and deploy in one call | `update-iflow-content` with `autoDeploy: true` |
| Validate before deploying | `get-iflow-build-errors` — dry run, no deployment |
| Check why deployment failed | `get-deploy-error` |
| Find the runtime URL of an iFlow | `get-iflow-endpoints` |
| Check externalized parameters | `get-iflow-configurations` |
| Find failed messages | `get-messages` with `filterProps.status: "FAILED"` |
| Count messages matching a filter | `get-messages-count` |
| Send a test HTTP payload to Cloud Integration | `send-http-message` — uses runtime destination |
| Create a new message mapping | `scaffold-message-mapping` then `update-message-mapping-content` |
| Test a message mapping end-to-end | `create-mapping-test-iflow` → deploy → send test message |
| Check server transport mode / version | `get-server-info` — returns transport (stdio/http), server version, Node.js version |

---

## How Tools Work

### Tool Call Format

Every tool is called by **name** with **typed JSON parameters**. No raw OData paths, no `$filter` strings, no base64 encoding needed.

```
Tool: <tool-name>
Parameters: { key: value, key: value }
```

Example:
```
Tool: get-messages
Parameters: {
  destinationName: "CPI_API",
  filterProps: { status: "FAILED", top: 10 },
  includeDetails: true
}
```

### Key Differences from the Generic OData MCP Server

| Feature | Generic OData MCP Server | This Custom MCP Server |
|---------|--------------------------|------------------------|
| Tool naming | `EntitySet_operation` (e.g. `IntegrationPackages_list`) | Named tools (e.g. `list-all-packages`) |
| Parameters | `path`, `body`, `headers` (raw OData) | Typed parameters (e.g. `id`, `packageId`, `files`) |
| ZIP handling | You must base64-encode ZIPs manually | Server handles download → extract → patch → zip → upload |
| CSRF tokens | You must fetch and pass CSRF tokens | Server handles CSRF automatically |
| Deploy polling | You must manually poll `BuildAndDeployStatus` | `deploy-iflow` polls automatically for up to 5 minutes |
| Version management | You must save versions manually before deploy | `deploy-iflow` auto-increments patch version |
| Filtering | Raw OData `$filter` strings | Typed `filterProps` object with named fields |
| Scopes | Not enforced | Enforced per tool (Read/Write) via XSUAA |

### Destination Parameter

Every tool requires a `destinationName` parameter that tells the server which Cloud Integration tenant to connect to.

| Mode | Design-Time Destination | Runtime Destination |
|------|------------------------|---------------------|
| **Stdio (local)** | `default` | `runtime` |
| **HTTP (BTP)** | BTP Destination name (e.g. `CPI_API`) | BTP runtime destination (e.g. `CPI_RUNTIME`) |

- **Design-time destination** points to the Cloud Integration Management API (`/api/v1`) — used by most tools.
- **Runtime destination** points to the Cloud Integration runtime — used only by `send-http-message` and optionally by `get-iflow-endpoints` for full URL computation.
- **No destination needed** for `get-server-info` — it returns server metadata without connecting to Cloud Integration.

---

## 1. Integration Packages

**What:** Logical containers that group iFlows, message mappings, value mappings, and other artifacts.

### `list-all-packages`

List all integration packages in the tenant.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |

```
Tool: list-all-packages
Parameters: { destinationName: "CPI_API" }
```

**Returns:** Array of packages with `Id`, `Name`, `Description`, `Version`, `ShortText`, `Vendor`, and metadata.

### `get-package-details`

Get a single package by Id, including its artifact lists.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `id` | string | Yes | Package Id (not the display Name — Names can contain spaces) |

```
Tool: get-package-details
Parameters: { destinationName: "CPI_API", id: "MyPackage" }
```

**Returns:** Package metadata plus lists of `IntegrationDesigntimeArtifacts`, `MessageMappingDesigntimeArtifacts`, `ValueMappingDesigntimeArtifacts`, etc.

### `create-package`

Create a new integration package. **Requires Write scope.**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `id` | string | Yes | Unique package Id (alphanumeric, underscore, hyphen, dot) |
| `name` | string | No | Display name (defaults to `id`) |
| `shortText` | string | No | Short description |

```
Tool: create-package
Parameters: {
  destinationName: "CPI_API",
  id: "OrderProcessing",
  name: "Order Processing",
  shortText: "Sales order integration flows"
}
```

---

## 2. Integration Flows

**What:** The core artifacts in Cloud Integration — they define message routing, transformation, and connectivity logic. Contains BPMN XML, Groovy scripts, XSLT mappings, and schemas.

### `get-iflow-content`

Download and extract the full iflow content as text. The server handles the full binary pipeline: download ZIP → extract → return all files as delimited text.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `id` | string | Yes | IFlow artifact ID |
| `filesOnly` | boolean | No | If `true`, return only the list of file paths (no content). Use after `scaffold-iflow` to discover the exact `.iflw` filename at minimal token cost. Default: `false`. |

```
Tool: get-iflow-content
Parameters: { destinationName: "CPI_API", id: "if_order_replication" }
```

**Returns:** All files with `---begin-of-file--- <filepath>` / `---end-of-file---` delimiters. Typical files:
- `src/main/resources/scenarioflows/integrationflow/*.iflw` — BPMN flow definition
- `src/main/resources/script/*.groovy` — Groovy scripts
- `src/main/resources/mapping/*.mmap` — mappings
- `META-INF/MANIFEST.MF` — metadata

**With `filesOnly: true`:** Returns a newline-separated list of relative file paths only — no content, no delimiters. Use this after `scaffold-iflow` when you only need the `.iflw` filename:
```
Tool: get-iflow-content
Parameters: { destinationName: "CPI_API", id: "if_order_replication", filesOnly: true }
```

### `list-iflows-in-package`

List all iflow artifacts in a package.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `packageId` | string | Yes | Package Id to list iflows from |

```
Tool: list-iflows-in-package
Parameters: { destinationName: "CPI_API", packageId: "OrderProcessing" }
```

**Returns:** Array of `{ Id, Version, Name }` for each iflow.

### `scaffold-iflow`

Create a new empty iflow artifact in a package. **Requires Write scope.** After scaffolding, use `update-iflow-content` to add content.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `packageId` | string | Yes | Package Id to create the iflow in |
| `id` | string | Yes | Unique iflow artifact ID |
| `name` | string | No | Display name (defaults to `id`) |

```
Tool: scaffold-iflow
Parameters: {
  destinationName: "CPI_API",
  packageId: "OrderProcessing",
  id: "if_order_replication",
  name: "Order Replication"
}
```

### `update-iflow-content`

Update files inside an existing iflow. **Requires Write scope.** The server handles the full binary pipeline: download existing ZIP → extract → patch specified files → re-zip → base64 → upload. You only send plain text file content.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `id` | string | Yes | IFlow artifact ID |
| `files` | array | Yes | Files to create or update (min 1, see below) |
| `autoDeploy` | boolean | No | If `true`, save new version and deploy after update (default: `false`) |

**File entry structure:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filepath` | string | Yes | Relative path within the iflow project |
| `content` | string | Yes | Plain text file content — server handles ZIP/base64 |
| `appendMode` | boolean | No | If `true`, append to existing file instead of overwriting (default: `false`) |

**Common file paths:**
- `src/main/resources/scenarioflows/integrationflow/<name>.iflw` — BPMN XML
- `src/main/resources/script/<name>.groovy` — Groovy script
- `src/main/resources/mapping/<name>.xsl` — XSLT mapping
- `src/main/resources/parameters.prop` — externalized parameters

```
Tool: update-iflow-content
Parameters: {
  destinationName: "CPI_API",
  id: "if_order_replication",
  files: [
    {
      filepath: "src/main/resources/script/transform.groovy",
      content: "import com.sap.gateway.ip.core.customdev.util.Message\n\ndef Message processData(Message message) {\n    def body = message.getBody(String)\n    if (body == null) {\n        message.setBody('{\"error\": \"empty payload\"}')\n        return message\n    }\n    return message\n}"
    }
  ],
  autoDeploy: true
}
```

> **Note:** When `autoDeploy: true`, the tool internally calls `deploy-iflow` after the update. The response includes both the update status and the deployment result.

### `deploy-iflow`

Deploy an iflow to the Cloud Integration runtime. **Requires Write scope.** Automatically saves a new patch version, triggers deployment, and polls status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `id` | string | Yes | IFlow artifact ID to deploy |

```
Tool: deploy-iflow
Parameters: { destinationName: "CPI_API", id: "if_order_replication" }
```

**Behavior:**
1. Reads current version (e.g. `1.0.3`)
2. Saves new patch version (`1.0.4`)
3. Triggers deployment
4. Polls `BuildAndDeployStatus` every 1 second for up to **5 minutes**
5. Returns `SUCCESS`, `FAIL`, or `TIMEOUT`

> **Note:** Unlike the generic MCP server, you do NOT need to manually save a version, call a deploy function import, or poll `BuildAndDeployStatus`. This tool does it all.

### `undeploy-artifact`

Undeploy a runtime artifact by its ID. Works for **any artifact type** — iFlows, message mappings, script collections, etc. Removes the artifact from the Cloud Integration runtime. **Requires Write scope.**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `id` | string | Yes | Id of the deployed runtime artifact to undeploy |

```
Tool: undeploy-artifact
Parameters: { destinationName: "CPI_API", id: "if_order_replication" }
```

**Use cases:**
- Undeploy after successful verification (to avoid leaving test artifacts running)
- Clean up failed deployments
- Remove obsolete artifacts from the runtime

> **Note:** This removes the artifact from the runtime only. The design-time artifact (source) remains intact in its package. You can re-deploy at any time with `deploy-iflow`.

### `get-iflow-endpoints`

Get runtime service endpoints for an iflow. Returns endpoint URLs, protocols, and entry points.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `runtimeDestination` | string | No | Runtime destination to compute full URLs |
| `id` | string | No | IFlow ID to filter (omit to list all endpoints) |

```
Tool: get-iflow-endpoints
Parameters: {
  destinationName: "CPI_API",
  runtimeDestination: "CPI_RUNTIME",
  id: "if_order_replication"
}
```

**Returns:** Endpoint URLs, protocols (HTTP, SOAP, IDOC, etc.), and entry points. When `runtimeDestination` is provided, full runtime URLs are computed.

### `get-iflow-configurations`

Get externalized configuration parameters for an iflow.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `id` | string | Yes | IFlow artifact ID |

```
Tool: get-iflow-configurations
Parameters: { destinationName: "CPI_API", id: "if_order_replication" }
```

**Returns:** Array of `{ ParameterKey, ParameterValue, DataType }` for all externalized parameters.

### `get-iflow-build-errors`

Validate an iflow and return build errors **without deploying**. Use this as a dry run before deployment.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `id` | string | Yes | IFlow artifact ID to validate |

```
Tool: get-iflow-build-errors
Parameters: { destinationName: "CPI_API", id: "if_order_replication" }
```

**Returns:**
- `{ status: "PASSED" }` — no build errors, safe to deploy
- `{ status: "FAILED", errors: [...] }` — list of errors with descriptions

### `get-deploy-error`

Get deployment error information for a runtime artifact.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `id` | string | Yes | Artifact ID to check for deploy errors |

```
Tool: get-deploy-error
Parameters: { destinationName: "CPI_API", id: "if_order_replication" }
```

**Returns:** Error text describing the deployment failure, or `"No deployment errors."` if healthy. Returns 404 if the artifact was never deployed.

---

## 3. Message Mappings

**What:** Graphical structure-to-structure transformations between source and target message formats. Contains `.mmap` mapping definitions and `.xsd` schemas.

### `get-message-mapping-content`

Download and extract message mapping content as text.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `id` | string | Yes | Message mapping artifact ID |

```
Tool: get-message-mapping-content
Parameters: { destinationName: "CPI_API", id: "mm_order_transform" }
```

**Returns:** All files from the mapping ZIP with delimiters. Includes `.mmap` (mapping definition), `.xsd` (schemas), and metadata files.

### `get-all-message-mappings`

List all message mapping artifacts in the tenant.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |

```
Tool: get-all-message-mappings
Parameters: { destinationName: "CPI_API" }
```

### `scaffold-message-mapping`

Create a new empty message mapping artifact in a package. **Requires Write scope.**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `packageId` | string | Yes | Package Id to create the mapping in |
| `id` | string | Yes | Message mapping artifact ID |
| `name` | string | No | Display name (defaults to `id`) |
| `description` | string | No | Mapping description |

```
Tool: scaffold-message-mapping
Parameters: {
  destinationName: "CPI_API",
  packageId: "OrderProcessing",
  id: "mm_order_transform",
  name: "Order Transform",
  description: "Maps SAP order to external format"
}
```

### `update-message-mapping-content`

Update files inside an existing message mapping. **Requires Write scope.** Same binary pipeline as `update-iflow-content`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `id` | string | Yes | Message mapping artifact ID |
| `files` | array | Yes | Files to create/update (same structure as iflow files) |
| `autoDeploy` | boolean | No | Auto-deploy after update (default: `false`) |

```
Tool: update-message-mapping-content
Parameters: {
  destinationName: "CPI_API",
  id: "mm_order_transform",
  files: [{
    filepath: "src/main/resources/mapping/mapping.mmap",
    content: "..."
  }],
  autoDeploy: true
}
```

### `deploy-message-mapping`

Deploy a message mapping to the runtime. **Requires Write scope.** Saves a new patch version, deploys, and polls status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `id` | string | Yes | Message mapping artifact ID to deploy |

```
Tool: deploy-message-mapping
Parameters: { destinationName: "CPI_API", id: "mm_order_transform" }
```

**Behavior:** Same as `deploy-iflow` but polls for up to **30 seconds** (mappings deploy faster).

### `create-mapping-test-iflow`

Create the echo mapping test iflow (`if_echo_mapping`) from a bundled template. **Requires Write scope.** Used for testing message mappings end-to-end. Deletes any existing `if_echo_mapping` first.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `packageId` | string | Yes | Package Id to create the test iflow in |

```
Tool: create-mapping-test-iflow
Parameters: { destinationName: "CPI_API", packageId: "OrderProcessing" }
```

> **Usage flow:** `create-mapping-test-iflow` → `deploy-iflow` (id: `if_echo_mapping`) → `get-iflow-endpoints` → `send-http-message` to test.

---

## 4. Message Processing

**What:** Tools for monitoring message execution logs and sending test messages to Cloud Integration runtime endpoints.

### `get-messages`

Get message processing logs with optional filtering and per-message enrichment.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `filterProps` | object | No | Filter criteria (see below) |
| `includeDetails` | boolean | No | Fetch per-message enrichment (default: `false`) |

**Filter properties (all optional):**

| Field | Type | Description |
|-------|------|-------------|
| `status` | enum | `COMPLETED`, `FAILED`, `RETRY`, `PROCESSING`, `ESCALATED`, `ABANDONED`, `DISCARDED` |
| `iflowName` | string | Filter by integration flow name |
| `sender` | string | Filter by sender system |
| `receiver` | string | Filter by receiver system |
| `logStart` | string | Messages after this ISO datetime (`YYYY-MM-DDTHH:mm:ss`) |
| `logEnd` | string | Messages before this ISO datetime |
| `top` | number | Max results to return (default: 50) |
| `skip` | number | Skip first N results — use with `top` for pagination |

```
Tool: get-messages
Parameters: {
  destinationName: "CPI_API",
  filterProps: {
    status: "FAILED",
    iflowName: "Order Replication",
    logStart: "2026-03-01T00:00:00",
    top: 20
  },
  includeDetails: true
}
```

> **Warning:** `includeDetails: true` triggers **3–5 extra API calls per message** (AdapterAttributes, CustomHeaderProperties, Attachments, ErrorInformation). Use `false` for listing, `true` only for deep inspection of a small number of messages.

### `get-messages-count`

Get the count of message processing logs matching a filter. Returns a single integer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationName` | string | Yes | Design-time destination |
| `filterProps` | object | No | Same filter properties as `get-messages` |

```
Tool: get-messages-count
Parameters: {
  destinationName: "CPI_API",
  filterProps: { status: "FAILED", logStart: "2026-03-19T00:00:00" }
}
```

**Returns:** `{ "count": 42 }`

### `send-http-message`

Send an HTTP message to a Cloud Integration runtime endpoint. **Requires Write scope.** Uses the **runtime destination** (not design-time). Authorization headers are managed by the server.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `runtimeDestination` | string | Yes | BTP Destination for Cloud Integration runtime (e.g. `CPI_RUNTIME`) |
| `path` | string | Yes | URL path (e.g. `/http/my/endpoint`) |
| `method` | enum | Yes | `GET`, `POST`, or `PUT` |
| `body` | string | No | Request body (for POST/PUT) |
| `contentType` | string | No | Content-Type header (default: `application/json`) |
| `headers` | object | No | Additional headers |

```
Tool: send-http-message
Parameters: {
  runtimeDestination: "CPI_RUNTIME",
  path: "/http/order/replicate",
  method: "POST",
  body: "{\"orderId\": \"ORD-001\", \"customer\": \"ACME Corp\"}",
  contentType: "application/json"
}
```

**Security:**
- Authorization headers are injected from the BTP Destination — never pass credentials manually.
- The following headers are **stripped** if provided: `Authorization`, `Host`, `Cookie`, `X-Forwarded-*`, `X-Real-IP`, `Proxy-Authorization`.
- Path traversal (`..`) is blocked.
- Only `GET`, `POST`, `PUT` methods are allowed.

---

## 5. Server Meta

**What:** Utility tool for discovering the MCP server's transport mode, version, and runtime environment. Call this first to determine whether to use stdio or HTTP destination names.

### `get-server-info`

Returns MCP server metadata: transport mode, server version, and Node.js version.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| *(none)* | — | — | This tool takes no parameters |

```
Tool: get-server-info
Parameters: {}
```

**Returns:** `{ transport: "stdio" | "http", version: "1.2.3", nodeVersion: "v20.x.x" }`

**Use cases:**
- **Destination resolution:** Check the `transport` field to decide which destination names to use. If `"stdio"`, use `destinationName: "default"` and `runtimeDestination: "runtime"`. If `"http"`, resolve destination names from BTP configuration or ask the user.
- **Debugging:** Verify the server version and Node.js runtime when troubleshooting unexpected behavior.

> **Tip:** Call `get-server-info` once at the start of a session to determine the transport mode. Cache the result — it won't change during a session.

---

## Common Workflows

### Workflow 1: Create and Deploy a New iFlow

```
Step 1: list-all-packages               — Find the target package or verify it exists
Step 2: create-package                  — (If needed) Create a new package
Step 3: scaffold-iflow                  — Create an empty iflow in the package
Step 4: get-iflow-content (filesOnly: true)  — Discover the exact .iflw filename from the scaffold
Step 5: update-iflow-content                    — Add BPMN XML, Groovy scripts, etc.
Step 6: get-iflow-build-errors          — Validate before deploying (dry run)
Step 7: deploy-iflow                    — Deploy (auto-versions, auto-polls status)
Step 8: get-iflow-endpoints             — Get the runtime URL
Step 9: send-http-message               — Send a test payload
Step 10: get-messages                   — Verify processing was successful
Step 11: undeploy-artifact              — Undeploy after verification (unless user wants it running)
```

### Workflow 2: Modify an Existing iFlow

```
Step 1: get-iflow-content                       — Download current content
Step 2: (analyze/modify files)
Step 3: update-iflow-content (autoDeploy: true) — Update and deploy in one call
Step 4: get-deploy-error                — Check for deployment errors
Step 5: send-http-message               — Test with a payload
Step 6: get-messages                    — Verify in message logs
```

### Workflow 3: Debug a Failing Integration

```
Step 1: get-messages-count              — How many failures? (quick check)
Step 2: get-messages (status: FAILED)   — Get the failing messages
Step 3: get-messages (includeDetails)   — Deep inspect with errors, headers, attachments
Step 4: get-deploy-error                — Check for deployment-level errors
Step 5: get-iflow-content                       — Inspect the iflow source code
Step 6: get-iflow-build-errors          — Validate for build issues
Step 7: get-iflow-configurations        — Check externalized parameters
```

### Workflow 4: Test a Message Mapping

```
Step 1: create-mapping-test-iflow       — Create the echo test iflow
Step 2: deploy-iflow (if_echo_mapping)  — Deploy the test iflow
Step 3: get-iflow-endpoints             — Get the test endpoint URL
Step 4: send-http-message               — Send a test payload
Step 5: get-messages                    — Check the result in logs
```

### Workflow 5: Daily Health Check

```
Step 1: get-messages-count (FAILED)     — Count today's failures
Step 2: get-messages (FAILED, details)  — Inspect the failures
Step 3: get-deploy-error                — Check deployment errors per artifact
```

---

## Tips for AI Agents

1. **Always read before modifying.** Call `get-iflow-content` or `get-message-mapping-content` before `update-*` to understand the current structure and file paths.

2. **Use `autoDeploy: true` to reduce round-trips.** Instead of calling `update-iflow-content` then `deploy-iflow` separately, set `autoDeploy: true` on the update call.

3. **Validate before deploying.** Call `get-iflow-build-errors` before `deploy-iflow` to catch issues early without waiting for a full deployment cycle.

4. **Use `includeDetails: false` for listing, `true` for inspection.** Setting `includeDetails: true` on `get-messages` multiplies API calls by 3–5x per message. Use it only after narrowing results with filters.

5. **Filter messages aggressively.** Always pass `status`, `iflowName`, and `logStart`/`logEnd` in `filterProps` to avoid fetching thousands of log entries.

6. **Use `top` and `skip` for pagination.** Default is 50 results. Use `skip` to page through large result sets.

7. **Know the two destination types.** Most tools use the design-time destination (`CPI_API`). Only `send-http-message` uses the runtime destination (`CPI_RUNTIME`). `get-iflow-endpoints` optionally uses both. `get-server-info` needs no destination at all.

8. **Never pass credentials in `send-http-message` headers.** Authorization is managed by the BTP Destination. Headers like `Authorization`, `Cookie`, and `Host` are stripped for security.

9. **Artifact IDs are tenant-wide unique.** When creating iFlows or mappings, the `id` must be unique across the entire Cloud Integration tenant, not just within the package.

10. **File paths in `update-iflow-content` are relative.** Always use forward slashes and relative paths starting from the project root (e.g. `src/main/resources/script/transform.groovy`).

11. **The server handles all binary complexity.** You never need to base64-encode, ZIP, fetch CSRF tokens, or poll deploy status manually. Just send plain text content.

12. **Check `get-deploy-error` after deployment failures.** If `deploy-iflow` returns `FAIL`, this tool gives you the actual error message.

---

## Appendix A: Scope Matrix

### Read-Only Tools (13) — Scope: `Read`

Assigned via **CI_MCP_Viewer** role collection in BTP.

| Tool | Category |
|------|----------|
| `list-all-packages` | Packages |
| `get-package-details` | Packages |
| `get-iflow-content` | IFlows |
| `list-iflows-in-package` | IFlows |
| `get-iflow-endpoints` | IFlows |
| `get-iflow-configurations` | IFlows |
| `get-iflow-build-errors` | IFlows |
| `get-deploy-error` | IFlows |
| `get-message-mapping-content` | Mappings |
| `get-all-message-mappings` | Mappings |
| `get-messages` | Messages |
| `get-messages-count` | Messages |
| `get-server-info` | Server Meta |

### Write Tools (10) — Scope: `Write`

Assigned via **CI_MCP_Developer** role collection in BTP.

| Tool | Category |
|------|----------|
| `create-package` | Packages |
| `scaffold-iflow` | IFlows |
| `update-iflow-content` | IFlows |
| `deploy-iflow` | IFlows |
| `undeploy-artifact` | IFlows / Mappings / Any |
| `scaffold-message-mapping` | Mappings |
| `update-message-mapping-content` | Mappings |
| `deploy-message-mapping` | Mappings |
| `create-mapping-test-iflow` | Mappings |
| `send-http-message` | Messages |

> **Note:** In local stdio mode, scopes are not enforced — all 23 tools are available. Scope enforcement only applies in HTTP (BTP) mode via XSUAA.

### Fail-Closed Design

Unknown tool names are denied by default. If a tool is not in the list above, the server returns `Forbidden: tool '<name>' is not authorized`.

---

## Appendix B: Destination Guide

### Stdio Mode (Local Development)

Uses fixed destination names. Credentials come from the `.env` file.

| Destination Name | Points To | Required .env Variables |
|------------------|-----------|-------------------------|
| `default` | Cloud Integration Design-Time API (`/api/v1`) | `API_BASE_URL`, `API_OAUTH_TOKEN_URL`, `API_OAUTH_CLIENT_ID`, `API_OAUTH_CLIENT_SECRET` |
| `runtime` | Cloud Integration Runtime | `CPI_BASE_URL`, `CPI_OAUTH_TOKEN_URL`, `CPI_OAUTH_CLIENT_ID`, `CPI_OAUTH_CLIENT_SECRET` |

Alternative: Basic auth via `API_USER` / `API_PASS` (overrides OAuth if both set).

### HTTP Mode (BTP Cloud Foundry)

Uses BTP Destination Service names. Destinations are configured in the BTP Cockpit.

| Destination Name | Type | Points To |
|------------------|------|-----------|
| `CPI_API` (example) | Design-Time | `https://<tenant>.integrationsuite.cfapps.<region>.hana.ondemand.com/api/v1` |
| `CPI_RUNTIME` (example) | Runtime | `https://<tenant>.it-cpi-rt.cfapps.<region>.hana.ondemand.com` |

> **Important:** In HTTP mode, the `/api/v1` suffix is part of the BTP Destination URL configuration, not appended by the server.

### Transport Comparison

| Feature | Stdio (Local) | HTTP (BTP) |
|---------|--------------|------------|
| Destination parameter | `default` / `runtime` | BTP Destination name |
| Authentication | None (local .env) | XSUAA OAuth2 (JWT) |
| Authorization (scopes) | Not enforced | Enforced per tool |
| Rate limiting | None | 60 req/min per user |
| Payload limit | Unlimited | 10 MB |
| Multi-tenant | No | Yes (via BTP Destinations) |

---

## Appendix C: Error Recovery

For deployment and build errors (BPMN issues, adapter config, missing properties), see `./known-errors.md` — the complete error catalog with root causes and fixes.

For MCP server HTTP errors:

| HTTP Code | Common Cause | Fix |
|-----------|-------------|-----|
| 400 | Invalid artifact/destination Id | Ids: alphanumeric, underscore, hyphen, dot only |
| 401 | Missing/expired JWT | Check OAuth configuration, refresh token |
| 403 | Missing role collection | Assign CI_MCP_Developer (Write) or CI_MCP_Viewer (Read) in BTP |
| 404 | Wrong artifact/package Id | Use `list-iflows-in-package` or `list-all-packages` to verify |
| 409 | Artifact exists or locked | Use `update-*` instead of `scaffold-*`, or wait for lock |
| 429 | Rate limited (60 req/min) | Wait and retry; reduce `includeDetails` on `get-messages` |

`deploy-iflow` results: `SUCCESS` → verify with `get-iflow-endpoints`. `FAIL` → call `get-deploy-error`. `TIMEOUT` → check Web UI or retry later.

---

## Appendix D: Common Anti-Patterns

### 1. Modifying an iflow without reading it first

```
WRONG:
  update-iflow-content with a guessed filepath

CORRECT:
  Step 1: get-iflow-content → see actual file paths and content
  Step 2: update-iflow-content with the correct filepath
```

### 2. Using `includeDetails: true` on large result sets

```
WRONG:
  get-messages({ filterProps: { top: 100 }, includeDetails: true })
  → 500 extra API calls

CORRECT:
  get-messages({ filterProps: { status: "FAILED", top: 5 }, includeDetails: true })
  → 25 extra API calls
```

### 3. Deploying without validating first

```
WRONG:
  update-iflow-content → deploy-iflow → deployment fails → debug

CORRECT:
  update-iflow-content → get-iflow-build-errors → fix issues → deploy-iflow
```

### 4. Creating a duplicate artifact ID

Artifact IDs are unique across the **entire tenant**, not just within a package. Always check first:

```
Step 1: list-iflows-in-package({ packageId: "..." })  → verify Id doesn't exist
Step 2: scaffold-iflow
```

### 5. Passing credentials in send-http-message headers

```
WRONG:
  send-http-message({
    headers: { "Authorization": "Basic abc123" },
    ...
  })
  → header is stripped, auth fails

CORRECT:
  send-http-message({
    runtimeDestination: "CPI_RUNTIME",
    ...
  })
  → server injects auth from BTP Destination automatically
```

### 6. Confusing design-time and runtime destinations

```
WRONG:
  send-http-message({ runtimeDestination: "CPI_API", ... })
  → sends to the management API, not the iflow endpoint

CORRECT:
  send-http-message({ runtimeDestination: "CPI_RUNTIME", ... })
  → sends to the actual iflow runtime
```

### 7. Fetching all messages without filters

```
WRONG:
  get-messages({ destinationName: "CPI_API" })
  → returns 50 most recent of ANY status

CORRECT:
  get-messages({
    destinationName: "CPI_API",
    filterProps: { status: "FAILED", iflowName: "...", logStart: "..." }
  })
```

---

## Appendix E: Glossary

| Term | Definition |
|------|-----------|
| **iFlow** | Integration Flow — a visual pipeline that receives, transforms, routes, and sends messages between systems. The core building block in Cloud Integration. |
| **Integration Package** | A folder/container that groups related iFlows, mappings, scripts, and other artifacts. |
| **Designtime Artifact** | The editable, pre-deployment version of an iFlow/mapping. Think of it as "source code." |
| **Runtime Artifact** | The deployed, running version of an artifact. Think of it as the "compiled binary." |
| **BPMN XML** | Business Process Model and Notation XML — the underlying format that defines iFlow logic (steps, routing, adapters). File extension: `.iflw`. |
| **Adapter** | A connector that handles protocol-specific communication (HTTP, SFTP, SOAP, OData, AS2, etc.). |
| **Sender Channel** | The inbound adapter that receives messages into the iFlow. |
| **Receiver Channel** | The outbound adapter that sends messages from the iFlow to an external system. |
| **Externalized Parameter** | A configuration value extracted from the iFlow so it can be changed without editing the flow. Managed via `get-iflow-configurations`. |
| **Content Modifier** | An iFlow step that sets/modifies message headers, properties, or body content. |
| **Message Processing Log (MPL)** | A record of a single iFlow execution — includes status, timestamps, and optional attachments. |
| **Message Mapping** | A graphical transformation that maps fields from a source to a target message structure. |
| **Groovy Script** | A JVM-based script used in iFlows for custom transformation, routing, or error handling logic. |
| **CSRF Token** | Cross-Site Request Forgery token required by Cloud Integration for all write operations. This server handles CSRF automatically. |
| **Scaffold** | Creating an empty artifact structure (iFlow or mapping) that can then be populated with content via `update-*`. |
| **autoDeploy** | A parameter on `update-iflow-content` / `update-message-mapping-content` that saves a new version and deploys in one call. |
| **Build Errors** | Validation errors found by `get-iflow-build-errors` — syntax issues, missing references, or configuration problems that would cause deployment to fail. |
| **Deploy Error** | Runtime error information retrieved by `get-deploy-error` — issues that occurred during or after deployment. |
| **Destination (BTP)** | A BTP Destination Service entry that stores the URL and credentials for connecting to an external system (Cloud Integration in this case). |
| **XSUAA** | SAP Authorization and Trust Management service — provides OAuth2 JWT tokens for authentication. |
| **Scope** | A permission level (`Read` or `Write`) checked by the server before executing a tool. Assigned via BTP role collections. |
