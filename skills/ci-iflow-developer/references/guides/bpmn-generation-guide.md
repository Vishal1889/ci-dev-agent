# BPMN XML Generation Guide for SAP CPI iFlows

This guide provides everything needed to generate valid `.iflw` BPMN2 XML files, MANIFEST.MF, parameters.prop, and parameters.propdef for SAP Cloud Integration artifacts. All patterns are derived from real deployed iFlows.

---

## 0. CRITICAL: Scaffold-First Generation Rule

**For NEW iFlows, ALWAYS use the scaffold's own XML as the structural foundation.**

The `scaffold-iflow` tool generates an `.iflw` with tenant-specific structural elements that the templates in this guide may not include (e.g., `targetNamespace`, `<bpmn2:documentation>`, additional collaboration/participant properties).

**Workflow:**
1. `scaffold-iflow` → create the artifact
2. `get-iflow-content` → read the scaffold's `.iflw` XML
3. **Extract structural boilerplate**: `<bpmn2:definitions>` attributes, `<bpmn2:collaboration>` extensionElements, `<bpmn2:documentation>`, participant extensionElements
4. Generate custom BPMN content (steps, adapters, wiring) using templates + this guide
5. **Merge**: Place custom content inside the scaffold's structural shell
6. Upload via `update-iflow-content`

Templates in `./references/minimal-iflows/` show correct BPMN *content* patterns. The scaffold provides the correct *structural* shell.

---

## 1. Required XML Namespaces

Every `.iflw` file MUST declare these namespaces on the root `<bpmn2:definitions>` element:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions
    xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
    xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
    xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
    xmlns:ifl="http:///com.sap.ifl.model/Ifl.xsd"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    id="Definitions_1">
```

**Critical:** Missing any namespace will cause deployment failure.

> **WARNING:** The live CPI scaffold may add attributes not shown above (e.g., `name`, `targetNamespace`). Always preserve ALL scaffold attributes on `<bpmn2:definitions>`.

---

## 2. Top-Level Document Structure

An `.iflw` file has three main sections inside `<bpmn2:definitions>`:

```
<bpmn2:definitions>
  1. <bpmn2:collaboration>     -- Participants (sender, receiver, process pools) + message flows (adapters)
  2. <bpmn2:process> (one+)    -- Integration process logic (steps, sequence flows)
  3. <bpmndi:BPMNDiagram>      -- Visual layout coordinates
</bpmn2:definitions>
```

---

## 3. Collaboration Section

### 3.1 Collaboration Properties (iFlow-level)

```xml
<bpmn2:collaboration id="Collaboration_1" name="Default Collaboration">
    <bpmn2:extensionElements>
        <ifl:property><key>namespaceMapping</key><value/></ifl:property>
        <ifl:property><key>httpSessionHandling</key><value>None</value></ifl:property>
        <ifl:property><key>accessControlMaxAge</key><value/></ifl:property>
        <ifl:property><key>returnExceptionToSender</key><value>false</value></ifl:property>
        <ifl:property><key>log</key><value>All events</value></ifl:property>
        <ifl:property><key>corsEnabled</key><value>false</value></ifl:property>
        <ifl:property><key>exposedHeaders</key><value/></ifl:property>
        <ifl:property><key>componentVersion</key><value>1.2</value></ifl:property>
        <ifl:property><key>allowedHeaderList</key><value/></ifl:property>
        <ifl:property><key>ServerTrace</key><value>false</value></ifl:property>
        <ifl:property><key>allowedOrigins</key><value/></ifl:property>
        <ifl:property><key>accessControlAllowCredentials</key><value>false</value></ifl:property>
        <ifl:property><key>allowedHeaders</key><value/></ifl:property>
        <ifl:property><key>allowedMethods</key><value/></ifl:property>
        <ifl:property>
            <key>cmdVariantUri</key>
            <value>ctype::IFlowVariant/cname::IFlowConfiguration/version::1.2.4</value>
        </ifl:property>
    </bpmn2:extensionElements>
    <!-- Participants and MessageFlows go here -->
</bpmn2:collaboration>
```

**Key properties:**
- `allowedHeaderList` -- Comma-separated headers to preserve through the flow
- `returnExceptionToSender` -- Set `true` if sender needs error response (sync iFlows)
- `httpSessionHandling` -- `None` (default) or `onExchange` (for multi-step HTTP)
- `log` -- `All events` or `None`

> **WARNING:** The scaffold may include additional collaboration properties not listed above (e.g., `privateKeyAlias`, `traceLevel`, `errorStrategy`) and a `<bpmn2:documentation>` element. Always preserve ALL scaffold-generated properties and elements.

### 3.2 Participants

Three types of participants:

**Sender (external system sending TO the iFlow):**
```xml
<bpmn2:participant id="Participant_1" ifl:type="EndpointSender" name="Sender">
    <bpmn2:extensionElements>
        <ifl:property><key>enableBasicAuthentication</key><value>false</value></ifl:property>
        <ifl:property><key>ifl:type</key><value>EndpointSender</value></ifl:property>
    </bpmn2:extensionElements>
</bpmn2:participant>
```

> **Timer-Triggered iFlows:** Do NOT create a Sender participant from scratch, but the scaffold's Sender participant may be kept (it is harmless). There must be NO sender messageFlow connecting to the start event. See §4.2.

> **WARNING:** The scaffold may add `cmdVariantUri` and `componentVersion` properties on Sender/Receiver participants not shown in the examples above. Always preserve ALL scaffold-generated participant properties.

**Receiver (external system the iFlow sends TO):**
```xml
<bpmn2:participant id="Participant_2" ifl:type="EndpointRecevier" name="Receiver">
    <bpmn2:extensionElements>
        <ifl:property><key>ifl:type</key><value>EndpointRecevier</value></ifl:property>
    </bpmn2:extensionElements>
</bpmn2:participant>
```

**Note:** CPI uses the misspelling `EndpointRecevier` (not "Receiver"). This is intentional and MUST be preserved.

**Integration Process pool (references a `<bpmn2:process>`):**
```xml
<bpmn2:participant id="Participant_Process_1" ifl:type="IntegrationProcess"
    name="Integration Process" processRef="Process_1">
    <bpmn2:extensionElements>
        <ifl:property><key>componentVersion</key><value>1.2</value></ifl:property>
        <ifl:property>
            <key>cmdVariantUri</key>
            <value>ctype::FlowElementVariant/cname::IntegrationProcess/version::1.2.1</value>
        </ifl:property>
    </bpmn2:extensionElements>
</bpmn2:participant>
```

> **CRITICAL — Never use empty `<bpmn2:extensionElements/>` on IntegrationProcess participants.** Every `IntegrationProcess` participant MUST have `componentVersion` and `cmdVariantUri` properties. Empty extensionElements causes "Error while loading the details of the integration flow" in the CPI Web UI.

**Local Integration Process (LIP) pool participant:**
```xml
<bpmn2:participant id="Participant_Process_2" ifl:type="IntegrationProcess"
    name="LIP_MyProcess" processRef="Process_2">
    <bpmn2:extensionElements>
        <ifl:property><key>componentVersion</key><value>1.1</value></ifl:property>
        <ifl:property>
            <key>cmdVariantUri</key>
            <value>ctype::FlowElementVariant/cname::LocalIntegrationProcess/version::1.1.3</value>
        </ifl:property>
    </bpmn2:extensionElements>
</bpmn2:participant>
```

> **Note:** The participant `cmdVariantUri` uses `FlowElementVariant` (matching the `<bpmn2:process>` cmdVariantUri), NOT `FlowstepVariant`. Main process uses `IntegrationProcess/version::1.2.1`, LIPs use `LocalIntegrationProcess/version::1.1.3`. Both use `ifl:type="IntegrationProcess"` on the participant element — the difference is only in the cmdVariantUri value.

**Multiple participants:** Use unique IDs and descriptive names for each (e.g., `Participant_2` = "SAP_S4HANA", `Participant_3` = "SFTP_Payroll"). For multi-sender patterns (e.g., Poll Enrich from a second source), add a second `EndpointSender` participant with its own messageFlow.

### 3.3 Process-Level Properties

Every `<bpmn2:process>` element requires these extensionElements:

**Integration Process (main):**
```xml
<bpmn2:process id="Process_1" name="Integration Process" processType="None">
    <bpmn2:extensionElements>
        <ifl:property><key>transactionTimeout</key><value>30</value></ifl:property>
        <ifl:property><key>componentVersion</key><value>1.2</value></ifl:property>
        <ifl:property>
            <key>cmdVariantUri</key>
            <value>ctype::FlowElementVariant/cname::IntegrationProcess/version::1.2.1</value>
        </ifl:property>
        <ifl:property><key>transactionalHandling</key><value>Not Required</value></ifl:property>
    </bpmn2:extensionElements>
    <!-- StartEvent, steps, EndEvent, SequenceFlows go here -->
</bpmn2:process>
```

**Local Integration Process (LIP):**
```xml
<bpmn2:process id="Process_4" name="Local Integration Process" processType="None">
    <bpmn2:extensionElements>
        <ifl:property><key>componentVersion</key><value>1.1</value></ifl:property>
        <ifl:property>
            <key>cmdVariantUri</key>
            <value>ctype::FlowElementVariant/cname::LocalIntegrationProcess/version::1.1.3</value>
        </ifl:property>
        <ifl:property><key>processType</key><value>directCall</value></ifl:property>
        <ifl:property><key>transactionalHandling</key><value>From Calling Process</value></ifl:property>
    </bpmn2:extensionElements>
    <!-- StartEvent (no messageEventDefinition), steps, EndEvent (no messageEventDefinition) -->
</bpmn2:process>
```

**Key differences:**
- Main process: `transactionalHandling=Not Required` (or `Required` for JMS/JDBC transacted flows)
- LIP: `transactionalHandling=From Calling Process`, `processType=directCall`
- LIP start/end events do NOT have `<messageEventDefinition/>`
- LIP start event uses `ctype::FlowstepVariant/cname::StartEvent` (no version), `activityType=StartEvent`
- LIP end event uses `ctype::FlowstepVariant/cname::EndEvent` (no version), `activityType=EndEvent`

### 3.4 Message Flows (Adapters)

Message flows connect participants to process start/end events. They carry all adapter configuration.

> **Timer-Triggered iFlows: Do NOT create a sender message flow.** The Timer is configured as a start event type (§4.2), not as an adapter on a message flow. Only receiver message flows apply.

**Sender adapter (Sender -> StartEvent) — for message-triggered iFlows only:**
```xml
<bpmn2:messageFlow id="MessageFlow_1" name="HTTPS" sourceRef="Participant_1" targetRef="StartEvent_1">
    <bpmn2:extensionElements>
        <ifl:property><key>ComponentType</key><value>HTTPS</value></ifl:property>
        <ifl:property><key>ComponentNS</key><value>sap</value></ifl:property>
        <ifl:property><key>ComponentSWCVName</key><value>external</value></ifl:property>
        <ifl:property><key>ComponentSWCVId</key><value>1.5.2</value></ifl:property>
        <ifl:property><key>Name</key><value>HTTPS</value></ifl:property>
        <ifl:property><key>direction</key><value>Sender</value></ifl:property>
        <ifl:property><key>system</key><value>Sender</value></ifl:property>
        <ifl:property><key>TransportProtocol</key><value>HTTPS</value></ifl:property>
        <ifl:property><key>TransportProtocolVersion</key><value>1.5.2</value></ifl:property>
        <ifl:property><key>MessageProtocol</key><value>None</value></ifl:property>
        <ifl:property><key>MessageProtocolVersion</key><value>1.5.2</value></ifl:property>
        <ifl:property>
            <key>cmdVariantUri</key>
            <value>ctype::AdapterVariant/cname::sap:HTTPS/tp::HTTPS/mp::None/direction::Sender/version::1.5.2</value>
        </ifl:property>
        <!-- Adapter-specific properties from metadata JSON -->
    </bpmn2:extensionElements>
</bpmn2:messageFlow>
```

**Receiver adapter (EndEvent/ServiceTask -> Receiver):**
```xml
<bpmn2:messageFlow id="MessageFlow_2" name="HTTP" sourceRef="EndEvent_1" targetRef="Participant_2">
    <bpmn2:extensionElements>
        <ifl:property><key>ComponentType</key><value>HTTP</value></ifl:property>
        <ifl:property><key>ComponentNS</key><value>sap</value></ifl:property>
        <ifl:property><key>ComponentSWCVName</key><value>external</value></ifl:property>
        <ifl:property><key>ComponentSWCVId</key><value>1.17.0</value></ifl:property>
        <ifl:property><key>direction</key><value>Receiver</value></ifl:property>
        <ifl:property><key>system</key><value>Receiver</value></ifl:property>
        <ifl:property><key>TransportProtocol</key><value>HTTP</value></ifl:property>
        <ifl:property><key>TransportProtocolVersion</key><value>1.17.0</value></ifl:property>
        <ifl:property><key>MessageProtocol</key><value>None</value></ifl:property>
        <ifl:property><key>MessageProtocolVersion</key><value>1.17.0</value></ifl:property>
        <ifl:property>
            <key>cmdVariantUri</key>
            <value>ctype::AdapterVariant/cname::sap:HTTP/tp::HTTP/mp::None/direction::Receiver/version::1.17.0</value>
        </ifl:property>
        <ifl:property><key>httpAddressWithoutQuery</key><value>{{receiver.Address}}</value></ifl:property>
        <ifl:property><key>httpMethod</key><value>POST</value></ifl:property>
        <ifl:property><key>authenticationMethod</key><value>{{receiver.AuthMethod}}</value></ifl:property>
        <ifl:property><key>credentialName</key><value>{{receiver.Credential}}</value></ifl:property>
        <!-- More adapter properties from metadata JSON -->
    </bpmn2:extensionElements>
</bpmn2:messageFlow>
```

**Request-Reply (ServiceTask -> Receiver, mid-flow):**
```xml
<bpmn2:messageFlow id="MessageFlow_3" name="HTTP" sourceRef="ServiceTask_1" targetRef="Participant_2">
    <!-- Same adapter properties as receiver adapter -->
</bpmn2:messageFlow>
```

> **Standard adapter channel properties (MUST be on every messageFlow):** `ComponentType`, `ComponentNS`, `ComponentSWCVName`, `ComponentSWCVId`, `Name`, `direction`, `system`, `TransportProtocol`, `TransportProtocolVersion`, `MessageProtocol`, `MessageProtocolVersion`, `cmdVariantUri`. Read `ComponentNS`, `ComponentSWCVName`, `ComponentSWCVId` from `./references/metadata/adapters/{adapter}_{direction}.json`. Then add ALL adapter-specific properties from the same metadata file — **never omit properties to "simplify"**, as missing mandatory properties cause deployment failures.

---

## 4. Process Steps & cmdVariantUri Reference

### 4.1 Step-to-BPMN Element Mapping

For adapter property keys and full property definitions, read:
- `./references/metadata/steps/{step}.json` — per-step distilled metadata
- `./references/metadata/adapters/{adapter}_{direction}.json` — per-adapter distilled metadata

#### Flow-level

| Element | cmdVariantUri |
|---------|--------------|
| IFlow Configuration | `ctype::IFlowVariant/cname::IFlowConfiguration/version::1.2.4` |
| Integration Process | `ctype::FlowElementVariant/cname::IntegrationProcess/version::1.2.1` |
| Local Integration Process | `ctype::FlowElementVariant/cname::LocalIntegrationProcess/version::1.1.3` |

#### Events

| Element | cmdVariantUri | Used In | Notes |
|---------|--------------|---------|-------|
| Message Start Event | `ctype::FlowstepVariant/cname::MessageStartEvent/version::1.0` | Main process | Sender-triggered start |
| Message End Event | `ctype::FlowstepVariant/cname::MessageEndEvent/version::1.1.0` | Main process | Normal flow end |
| Timer Start Event | `ctype::FlowstepVariant/cname::intermediatetimer/version::1.4.0` | Main process | Timer-triggered start |
| Start Event (local) | `ctype::FlowstepVariant/cname::StartEvent` | Local Integration Process | |
| End Event (local) | `ctype::FlowstepVariant/cname::EndEvent` | Local Integration Process | |
| Error Start Event | `ctype::FlowstepVariant/cname::ErrorStartEvent` | Exception Subprocess ONLY | Inside `<errorEventDefinition>`, with `activityType: StartErrorEvent` |
| Error End Event | `ctype::FlowstepVariant/cname::ErrorEndEvent` | Exception Subprocess ONLY | Inside `<errorEventDefinition>`, with `activityType: EndErrorEvent`. **Always use this for exception subprocess end events.** |
| Terminate End Event | `ctype::FlowstepVariant/cname::TerminateEndEvent` | Main process | Stops all processing |

> **WARNING:** Do NOT use `EscalationEndEvent` in exception subprocesses. It causes the subprocess to render as an empty box in the CPI Web UI. Always use `ErrorEndEvent` instead. See known-errors.md #30.
>
> **Note:** Some deployed iFlows use `MessageEndEvent` (with `<messageEventDefinition/>`) inside exception subprocesses — this also works. The critical rule is: NEVER use `EscalationEndEvent` or `escalationEventDefinition`.

#### Steps — callActivity

| Step Type | activityType | subActivityType | cmdVariantUri |
|-----------|-------------|----------------|--------------|
| Content Modifier | `Enricher` | -- | `ctype::FlowstepVariant/cname::Enricher/version::1.6.3` |
| Groovy Script | `Script` | `GroovyScript` | `ctype::FlowstepVariant/cname::GroovyScript/version::1.1.2` |
| JavaScript | `Script` | `JavaScript` | `ctype::FlowstepVariant/cname::JavaScript/version::1.1.2` |
| XSLT Mapping | `Mapping` | `XSLTMapping` | `ctype::FlowstepVariant/cname::XSLTMapping/version::1.2.0` |
| Message Mapping | `Mapping` | `MessageMapping` | `ctype::FlowstepVariant/cname::MessageMapping/version::1.3.1` |
| Process Call | `ProcessCallElement` | `NonLoopingProcess` | `ctype::FlowstepVariant/cname::NonLoopingProcess/version::1.0.4` |
| Looping Process Call | `ProcessCallElement` | `LoopingProcess` | `ctype::FlowstepVariant/cname::LoopingProcess/version::1.3.0` |
| Idempotent Process Call | `IdempotentProcessCall` | -- | `ctype::FlowstepVariant/cname::IdempotentProcessCall/version::1.1.2` |
| JSON to XML | `JsonToXmlConverter` | -- | `ctype::FlowstepVariant/cname::JsonToXmlConverter/version::1.1.2` |
| XML to JSON | `XmlToJsonConverter` | -- | `ctype::FlowstepVariant/cname::XmlToJsonConverter/version::1.0.8` |
| CSV to XML | `CsvToXmlConverter` | -- | `ctype::FlowstepVariant/cname::CsvToXmlConverter/version::1.4.0` |
| XML to CSV | `XmlToCsvConverter` | -- | `ctype::FlowstepVariant/cname::XmlToCsvConverter/version::1.2.0` |
| XML Modifier | `XmlModifier` | -- | `ctype::FlowstepVariant/cname::XmlModifier/version::1.1.0` |
| Filter | `Filter` | -- | `ctype::FlowstepVariant/cname::Filter/version::1.1.0` |
| Iterating Splitter | `Splitter` | -- | `ctype::FlowstepVariant/cname::Camel/version::1.6.0` |
| General Splitter | `Splitter` | -- | `ctype::FlowstepVariant/cname::GeneralSplitter/version::1.6.0` |
| EDI Splitter | `Splitter` | -- | `ctype::FlowstepVariant/cname::EDISplitter/version::2.11.0` |
| Gather | `Gather` | -- | `ctype::FlowstepVariant/cname::Gather/version::1.2.0` |
| Write Variables | `Variables` | -- | `ctype::FlowstepVariant/cname::Variables/version::1.2.0` |
| Exception Subprocess | `ErrorEventSubProcessTemplate` | -- | `ctype::FlowstepVariant/cname::ErrorEventSubProcessTemplate/version::1.1.0` |

#### Steps — serviceTask

> **These use `<bpmn2:serviceTask>`, NOT `<bpmn2:callActivity>`.** They connect to receiver adapters via messageFlow.

| Step Type | activityType | cmdVariantUri |
|-----------|-------------|--------------|
| Request-Reply | `ExternalCall` | `ctype::FlowstepVariant/cname::ExternalCall/version::1.0.4` |
| Send | `Send` | `ctype::FlowstepVariant/cname::Send/version::1.0.4` |
| Poll Enrich | `PollEnrich` | `ctype::FlowstepVariant/cname::PollEnrich/version::1.1.0` |
| Content Enricher | `contentEnricherWithLookup` | `ctype::FlowstepVariant/cname::contentEnricherWithLookup/version::1.2.0` |

#### Gateways

> **These use `<bpmn2:exclusiveGateway>` or `<bpmn2:parallelGateway>`, NOT `<bpmn2:callActivity>`.**

| Step Type | BPMN Element | activityType | subActivityType | cmdVariantUri |
|-----------|-------------|-------------|----------------|--------------|
| Router | `exclusiveGateway` | `ExclusiveGateway` | -- | `ctype::FlowstepVariant/cname::ExclusiveGateway/version::1.1.2` |
| Gateway Route | (on sequenceFlow) | -- | -- | `ctype::FlowstepVariant/cname::GatewayRoute/version::1.0.0` |
| Parallel Multicast | `parallelGateway` | `Multicast` | `parallel` | `ctype::FlowstepVariant/cname::Multicast/version::1.1.1` |
| Sequential Multicast | `parallelGateway` | `SequentialMulticast` | `parallel` | `ctype::FlowstepVariant/cname::SequentialMulticast/version::1.1.0` |
| Join | `parallelGateway` | `Join` | `parallel` | `ctype::FlowstepVariant/cname::Join/version::1.0.0` |

#### Additional callActivity Steps

| Step Type | activityType | cmdVariantUri |
|-----------|-------------|--------------|
| Data Store Write | `DBstorage` | `ctype::FlowstepVariant/cname::put/version::1.7.1` |
| Data Store Get | `DBstorage` | `ctype::FlowstepVariant/cname::get/version::1.7.1` |
| Data Store Select | `DBstorage` | `ctype::FlowstepVariant/cname::select/version::1.7.1` |
| Data Store Delete | `DBstorage` | `ctype::FlowstepVariant/cname::delete/version::1.7.1` |
| Persist Message | `Persist` | `ctype::FlowstepVariant/cname::Persist/version::1.0.2` |
| PGP Decryptor | `PgpDecrypt` | `ctype::FlowstepVariant/cname::PgpDecrypt/version::1.2.0` |
| PGP Encryptor | `PgpEncrypt` | `ctype::FlowstepVariant/cname::PgpEncrypt/version::1.3.1` |
| PKCS7/CMS Encryptor | `Encrypt` | `ctype::FlowstepVariant/cname::Encrypt/version::1.3.0` |
| PKCS7/CMS Decryptor | `Decrypt` | `ctype::FlowstepVariant/cname::Decrypt/version::1.2.0` |
| PKCS7/CMS Signer | `SignMessage` | `ctype::FlowstepVariant/cname::SignMessage/version::1.5.0` |
| Simple Signer | `SimpleSignMessage` | `ctype::FlowstepVariant/cname::SimpleSignMessage/version::1.3.0` |
| XML Digital Signer | `XMLDigitalSignMessage` | `ctype::FlowstepVariant/cname::XMLDigitalSignMessage/version::1.3.3` |
| PKCS7 Signature Verifier | `VerifySign` | `ctype::FlowstepVariant/cname::VerifySign/version::1.2.0` |
| XML Signature Verifier | `XMLDigitalVerifySign` | `ctype::FlowstepVariant/cname::XMLDigitalVerifySign/version::1.1.0` |
| Message Digest | `MessageDigest` | `ctype::FlowstepVariant/cname::MessageDigest/version::1.1.1` |
| Base64 Encoder | `Encoder` | `ctype::FlowstepVariant/cname::Base64 Encode/version::1.0.1` |
| Base64 Decoder | `Decoder` | `ctype::FlowstepVariant/cname::Base64 Decode/version::1.0.1` |
| GZIP Compress | `Encoder` | `ctype::FlowstepVariant/cname::GZIP Compress/version::1.0.1` |
| GZIP Decompress | `Decoder` | `ctype::FlowstepVariant/cname::GZIP Decompress/version::1.0.1` |
| ZIP Compress | `Encoder` | `ctype::FlowstepVariant/cname::ZIP Compress/version::1.0.1` |
| ZIP Decompress | `Decoder` | `ctype::FlowstepVariant/cname::ZIP Decompress/version::1.0.2` |
| MIME Multipart Encoder | `Encoder` | `ctype::FlowstepVariant/cname::MIME Multipart Message Encode/version::1.2.0` |
| MIME Multipart Decoder | `Decoder` | `ctype::FlowstepVariant/cname::MIME Multipart Message Decode/version::1.0.2` |
| EDI Extractor | `EDIExtractor` | `ctype::FlowstepVariant/cname::EDIExtractor/version::2.2.0` |
| EDI to XML Converter | `EDItoXMLConverter` | `ctype::FlowstepVariant/cname::EDItoXMLConverter/version::2.8.0` |
| XML to EDI Converter | `XMLtoEDIConverter` | `ctype::FlowstepVariant/cname::XMLtoEDIConverter/version::2.8.0` |
| EDI Validator | `EDIValidator` | `ctype::FlowstepVariant/cname::EDIValidator/version::1.7.0` |
| XML Validator | `XmlValidator` | `ctype::FlowstepVariant/cname::XmlValidator/version::2.2.3` |
| Tar Splitter | `Splitter` | `ctype::FlowstepVariant/cname::TarSplitter/version::1.0.0` |
| Zip Splitter | `Splitter` | `ctype::FlowstepVariant/cname::ZipSplitter/version::1.0.0` |
| PKCS#7/CMS Splitter | `Splitter` | `ctype::FlowstepVariant/cname::PKCS#7/CMS Signature-Content Splitter/version::1.1.1` |
| IDoc Splitter | `Splitter` | `ctype::FlowstepVariant/cname::IDoc/version::1.1.0` |
| Aggregator | `Aggregator` | `ctype::FlowstepVariant/cname::Aggregator/version::1.0.5` |
| ID Mapping | `IDMapper` | `ctype::FlowstepVariant/cname::IDMapper/version::1.0.0` |
| Operation Mapping | `Mapping` | `ctype::FlowstepVariant/cname::OperationMapping/version::1.1.0` |

---

### 4.2 Timer-Triggered iFlows

**Timer Start Event** (`ctype::FlowstepVariant/cname::intermediatetimer/version::1.4.0`):
- Timer schedule configured on `<bpmn2:startEvent>` via `timerEventDefinition` child element
- `scheduleKey` — if user opted for externalization: use `{{Scheduler}}` with `parameters.prop` type `custom:schedule`. If hardcoding: use full schedule table inline with `&amp;amp;` double-encoding for the `&` separator in `schedule1`.

**Comparison: Timer vs Message-Triggered iFlows:**

| Aspect | Message-Triggered (HTTPS, SOAP, etc.) | Timer-Triggered |
|--------|---------------------------------------|-----------------|
| Sender Participant | Required (`EndpointSender`) | **Keep scaffold's participant (harmless) — do NOT add a sender messageFlow** |
| Sender MessageFlow | Required (adapter config on message flow) | **NONE — omit entirely** |
| Sender BPMNShape | Required in diagram | **Keep scaffold's shape (harmless)** |
| Start Event type | `MessageStartEvent` + `<messageEventDefinition/>` | `intermediatetimer` + `<timerEventDefinition/>` |
| Schedule config | N/A | Properties on startEvent extensionElements |
| Receiver side | Normal (participants + message flows) | Normal (participants + message flows) |

---

### 4.3 Content Modifier Table Row Format

**Table row format** (HTML-encoded in XML):
```
<row>
  <cell id='Action'>Create|Delete</cell>
  <cell id='Type'>constant|expression|header|property</cell>
  <cell id='Value'>the-value</cell>
  <cell id='Default'>default-value</cell>
  <cell id='Name'>header-or-property-name</cell>
  <cell id='Datatype'>java.lang.String|java.lang.Integer|java.lang.Boolean</cell>
</row>
```
Multiple rows are concatenated. In XML, `<` becomes `&lt;` and `>` becomes `&gt;`.

**Body content:** `bodyType=expression` uses Camel expression in `wrapContent`; `bodyType=constant` uses literal content in `wrapContent`. See phase-c-generation.md "Content Modifier BPMN Configuration" for full examples.

---

### 4.4 Router Condition Expressions

Routing conditions go on **outgoing sequenceFlows** (not on the exclusiveGateway).

Each outgoing sequenceFlow from a Router has extensionElements with `GatewayRoute` cmdVariantUri and an `expressionType`:

```xml
<bpmn2:sequenceFlow id="SequenceFlow_9" name="Route A"
    sourceRef="ExclusiveGateway_8" targetRef="ServiceTask_11">
    <bpmn2:extensionElements>
        <ifl:property><key>expressionType</key><value>NonXML</value></ifl:property>
        <ifl:property><key>componentVersion</key><value>1.0</value></ifl:property>
        <ifl:property>
            <key>cmdVariantUri</key>
            <value>ctype::FlowstepVariant/cname::GatewayRoute/version::1.0.0</value>
        </ifl:property>
    </bpmn2:extensionElements>
    <bpmn2:conditionExpression xsi:type="bpmn2:tFormalExpression">${property.orderType} = 'RUSH'</bpmn2:conditionExpression>
</bpmn2:sequenceFlow>
```

**expressionType values:**
- `NonXML` -- Camel Simple expression: `${property.x} = 'value'`, `${header.type} = 'A'`
- `XML` -- XPath expression (for XML payloads)

**Default route:** One outgoing sequenceFlow has no `<bpmn2:conditionExpression>`. The Router's `default` attribute references this flow's ID.

---

### 4.5 Request-Reply vs Send — XML Templates

For adapter compatibility rules and the full Wiring Lookup Table, see phase-c-generation.md "Receiver Adapter Wiring Rules."

**Request-Reply (`ExternalCall`) XML:**
```xml
<bpmn2:serviceTask id="ServiceTask_1" name="Call External API">
    <bpmn2:extensionElements>
        <ifl:property><key>componentVersion</key><value>1.0</value></ifl:property>
        <ifl:property><key>activityType</key><value>ExternalCall</value></ifl:property>
        <ifl:property>
            <key>cmdVariantUri</key>
            <value>ctype::FlowstepVariant/cname::ExternalCall/version::1.0.4</value>
        </ifl:property>
    </bpmn2:extensionElements>
    <bpmn2:incoming>SequenceFlow_in</bpmn2:incoming>
    <bpmn2:outgoing>SequenceFlow_out</bpmn2:outgoing>
</bpmn2:serviceTask>
```

**Send XML:**
```xml
<bpmn2:serviceTask id="ServiceTask_2" name="Send to Receiver">
    <bpmn2:extensionElements>
        <ifl:property><key>componentVersion</key><value>1.0</value></ifl:property>
        <ifl:property><key>activityType</key><value>Send</value></ifl:property>
        <ifl:property>
            <key>cmdVariantUri</key>
            <value>ctype::FlowstepVariant/cname::Send/version::1.0.4</value>
        </ifl:property>
    </bpmn2:extensionElements>
    <bpmn2:incoming>SequenceFlow_in</bpmn2:incoming>
    <bpmn2:outgoing>SequenceFlow_out</bpmn2:outgoing>
</bpmn2:serviceTask>
```

> Both use `<bpmn2:serviceTask>`. The adapter configuration goes on the `<bpmn2:messageFlow>` connecting the ServiceTask to the Receiver participant.

---

### 4.6 Exception Subprocess Rules

> **CRITICAL:** Do NOT add `triggeredByEvent="true"` to the subProcess element. Do NOT use `escalationEventDefinition` or `EscalationEndEvent` — always use `errorEventDefinition` with `ErrorEndEvent`. Violating these rules causes the subprocess to render as an empty box in the CPI Web UI. See known-errors.md #30.

See `./references/minimal-iflows/07-exception-subprocess.iflw` for the correct structure.

---

## 5. Sequence Flow Wiring Rules

### Basic Sequence Flow

```xml
<bpmn2:sequenceFlow id="SequenceFlow_1" sourceRef="StartEvent_1" targetRef="CallActivity_CM1"/>
```

### Rules

1. **Every element** (except subProcess containers) MUST have `<bpmn2:incoming>` and/or `<bpmn2:outgoing>` that match a `sequenceFlow`
2. **StartEvent** has only `<bpmn2:outgoing>`, no `<bpmn2:incoming>`
3. **EndEvent** has only `<bpmn2:incoming>`, no `<bpmn2:outgoing>`
4. **All other elements** have both `<bpmn2:incoming>` and `<bpmn2:outgoing>`
5. **`sourceRef` and `targetRef`** must match element IDs exactly
6. **Router outgoing flows** reference `default` attribute on the gateway
7. **Each element reference** in incoming/outgoing must contain the sequence flow ID as text content

### Wiring Example

```
StartEvent_1 --[SF_1]--> CallActivity_CM1 --[SF_2]--> CallActivity_GS1 --[SF_3]--> EndEvent_1
```

Produces:
```xml
<bpmn2:startEvent id="StartEvent_1">
    <bpmn2:outgoing>SF_1</bpmn2:outgoing>
    <bpmn2:messageEventDefinition/>
</bpmn2:startEvent>
<bpmn2:callActivity id="CallActivity_CM1">
    <bpmn2:incoming>SF_1</bpmn2:incoming>
    <bpmn2:outgoing>SF_2</bpmn2:outgoing>
</bpmn2:callActivity>
<bpmn2:callActivity id="CallActivity_GS1">
    <bpmn2:incoming>SF_2</bpmn2:incoming>
    <bpmn2:outgoing>SF_3</bpmn2:outgoing>
</bpmn2:callActivity>
<bpmn2:endEvent id="EndEvent_1">
    <bpmn2:incoming>SF_3</bpmn2:incoming>
    <bpmn2:messageEventDefinition/>
</bpmn2:endEvent>
<bpmn2:sequenceFlow id="SF_1" sourceRef="StartEvent_1" targetRef="CallActivity_CM1"/>
<bpmn2:sequenceFlow id="SF_2" sourceRef="CallActivity_CM1" targetRef="CallActivity_GS1"/>
<bpmn2:sequenceFlow id="SF_3" sourceRef="CallActivity_GS1" targetRef="EndEvent_1"/>
```

---

## 6. Element ID Generation Convention

Use these prefixes for element IDs:

| Element Type | ID Pattern | Example |
|-------------|-----------|---------|
| Participant (Sender) | `Participant_1`, `Participant_{n}` | `Participant_1` |
| Participant (Receiver) | `Participant_2`, `Participant_{n}` | `Participant_2` |
| Participant (Process) | `Participant_Process_{n}` | `Participant_Process_1` |
| Start Event | `StartEvent_{n}` | `StartEvent_1` |
| End Event | `EndEvent_{n}` | `EndEvent_1` |
| Call Activity | `CallActivity_{n}` | `CallActivity_1` |
| Service Task | `ServiceTask_{n}` | `ServiceTask_1` |
| Exclusive Gateway | `ExclusiveGateway_{n}` | `ExclusiveGateway_1` |
| SubProcess | `SubProcess_{n}` | `SubProcess_1` |
| Sequence Flow | `SequenceFlow_{n}` | `SequenceFlow_1` |
| Message Flow | `MessageFlow_{n}` | `MessageFlow_1` |

Use sequential numbering. CPI also accepts large random numbers (e.g., `Participant_8565926`), but sequential is clearer.

---

## 7. BPMNDiagram Coordinate Layout

### Layout Strategy: Horizontal Left-to-Right

All CPI iFlows use a horizontal left-to-right layout. The BPMNDiagram section provides coordinates for visual rendering.

> **CRITICAL — Complete Diagram Coverage Rule:** The `<bpmndi:BPMNDiagram>` section MUST contain a `<bpmndi:BPMNShape>` for **every** BPMN element across **all** processes — the main Integration Process AND every Local Integration Process (LIP). It MUST also contain a `<bpmndi:BPMNEdge>` for **every** `sequenceFlow` and `messageFlow`. Missing shapes or edges causes "Error while loading the details of the integration flow" in the CPI Web UI. The iFlow may deploy and run successfully at runtime, but the Web UI designer will refuse to render it.
>
> **Checklist:** Before finalizing the BPMNDiagram section, verify:
> - Every `<bpmn2:participant>` has a BPMNShape (sender, receivers, main process pool, ALL LIP pools)
> - Every `<bpmn2:startEvent>`, `<bpmn2:endEvent>`, `<bpmn2:callActivity>`, `<bpmn2:serviceTask>`, `<bpmn2:exclusiveGateway>`, `<bpmn2:parallelGateway>`, `<bpmn2:subProcess>` has a BPMNShape — including those **inside LIPs and exception subprocesses**
> - Every `<bpmn2:sequenceFlow>` has a BPMNEdge — including those **inside LIPs and exception subprocesses**
> - Every `<bpmn2:messageFlow>` has a BPMNEdge

### Generation Strategy: Build Diagram Alongside Process

To prevent forgetting elements in the BPMNDiagram section:

**Approach A (Recommended for complex flows with >8 steps):** Generate the XML using a Python script that programmatically builds both the process elements AND their corresponding BPMNShape/BPMNEdge entries in lockstep. This guarantees 1:1 coverage by construction — you cannot add a process element without its diagram entry.

**Approach B (Simple flows ≤8 steps):** Generate inline, but immediately after writing each process element, write its diagram entry. Do NOT defer all diagram entries to the end.

**Why scripts are better for complex flows:** When generating 30+ BPMN elements inline, the LLM's attention drifts — it often generates the process definition fully but then produces an incomplete diagram section (forgetting LIP elements, subprocess elements, or later sequence flows). A Python script eliminates this failure mode because the script explicitly iterates over all elements to generate both halves of the XML.

**After generation, ALWAYS run the Phase C.1b validation gate** (see `phase-c-generation.md`) before uploading.

### Standard Dimensions

| Element | Width | Height |
|---------|-------|--------|
| Sender/Receiver participant | 100.0 | 140.0 |
| Integration Process pool | 540.0+ (auto-size) | 220.0-280.0 |
| Local Integration Process pool | 400.0-700.0 (auto-size) | 150.0-250.0 (180 base + 70 per exception subprocess) |
| Start/End Event | 32.0 | 32.0 |
| CallActivity (step) | 100.0 | 60.0 |
| ServiceTask (Request-Reply/Send) | 100.0 | 60.0 |
| ExclusiveGateway | 40.0 | 40.0 |
| ParallelGateway (Multicast) | 40.0 | 40.0 |
| SubProcess (Exception Subprocess) | 414.0 | 100.0 |

### Coordinate Formulas

**Sender participant:** Fixed left position
```xml
<dc:Bounds height="140.0" width="100.0" x="40.0" y="100.0"/>
```

**Receiver participant:** Fixed right position
```xml
<dc:Bounds height="140.0" width="100.0" x="900.0" y="100.0"/>
```

**Integration Process pool:** Contains all steps
```xml
<dc:Bounds height="220.0" width="{pool_width}" x="250.0" y="60.0"/>
```
Pool width formula: `(number_of_steps * 150) + 200` (minimum 540)

**Start Event:** Left side of process pool
```xml
<dc:Bounds height="32.0" width="32.0" x="280.0" y="142.0"/>
```

**Steps (CallActivity):** Evenly spaced, 150px apart
```xml
<!-- Step 1 -->
<dc:Bounds height="60.0" width="100.0" x="360.0" y="128.0"/>
<!-- Step 2 -->
<dc:Bounds height="60.0" width="100.0" x="510.0" y="128.0"/>
<!-- Step N -->
<dc:Bounds height="60.0" width="100.0" x="{280 + (N * 150)}" y="128.0"/>
```

**End Event:** Right side of process pool
```xml
<dc:Bounds height="32.0" width="32.0" x="{pool_x + pool_width - 80}" y="142.0"/>
```

### Edge (Sequence Flow) Waypoints

Each edge has two waypoints connecting source center-right to target center-left:
```xml
<bpmndi:BPMNEdge bpmnElement="SequenceFlow_1" id="BPMNEdge_SequenceFlow_1"
    sourceElement="BPMNShape_StartEvent_1" targetElement="BPMNShape_CallActivity_1">
    <di:waypoint x="{source_x + source_width}" xsi:type="dc:Point" y="{source_center_y}"/>
    <di:waypoint x="{target_x}" xsi:type="dc:Point" y="{target_center_y}"/>
</bpmndi:BPMNEdge>
```

### Message Flow Edges

```xml
<bpmndi:BPMNEdge bpmnElement="MessageFlow_1" id="BPMNEdge_MessageFlow_1"
    sourceElement="BPMNShape_Participant_1" targetElement="BPMNShape_StartEvent_1">
    <di:waypoint x="90.0" xsi:type="dc:Point" y="170.0"/>
    <di:waypoint x="280.0" xsi:type="dc:Point" y="158.0"/>
</bpmndi:BPMNEdge>
```

### Complete BPMNDiagram Example

For a 3-step flow (Sender → Start → ContentModifier → GroovyScript → End → Receiver):

```xml
<bpmndi:BPMNDiagram id="BPMNDiagram_1" name="Default Collaboration Diagram">
    <bpmndi:BPMNPlane bpmnElement="Collaboration_1" id="BPMNPlane_1">
        <!-- Sender Participant (left) -->
        <bpmndi:BPMNShape bpmnElement="Participant_1" id="BPMNShape_Participant_1">
            <dc:Bounds height="140.0" width="100.0" x="40.0" y="100.0"/>
        </bpmndi:BPMNShape>
        <!-- Receiver Participant (right) -->
        <bpmndi:BPMNShape bpmnElement="Participant_2" id="BPMNShape_Participant_2">
            <dc:Bounds height="140.0" width="100.0" x="900.0" y="100.0"/>
        </bpmndi:BPMNShape>
        <!-- Integration Process Pool -->
        <bpmndi:BPMNShape bpmnElement="Participant_Process_1" id="BPMNShape_Participant_Process_1">
            <dc:Bounds height="220.0" width="600.0" x="250.0" y="60.0"/>
        </bpmndi:BPMNShape>
        <!-- Start Event -->
        <bpmndi:BPMNShape bpmnElement="StartEvent_1" id="BPMNShape_StartEvent_1">
            <dc:Bounds height="32.0" width="32.0" x="280.0" y="142.0"/>
        </bpmndi:BPMNShape>
        <!-- Step 1: Content Modifier (x=360, spaced 150px from start) -->
        <bpmndi:BPMNShape bpmnElement="CallActivity_CM1" id="BPMNShape_CallActivity_CM1">
            <dc:Bounds height="60.0" width="100.0" x="360.0" y="128.0"/>
        </bpmndi:BPMNShape>
        <!-- Step 2: Groovy Script (x=510, spaced 150px from step 1) -->
        <bpmndi:BPMNShape bpmnElement="CallActivity_GS1" id="BPMNShape_CallActivity_GS1">
            <dc:Bounds height="60.0" width="100.0" x="510.0" y="128.0"/>
        </bpmndi:BPMNShape>
        <!-- End Event -->
        <bpmndi:BPMNShape bpmnElement="EndEvent_1" id="BPMNShape_EndEvent_1">
            <dc:Bounds height="32.0" width="32.0" x="700.0" y="142.0"/>
        </bpmndi:BPMNShape>
        <!-- Sequence Flow Edges (source center-right → target center-left) -->
        <bpmndi:BPMNEdge bpmnElement="SequenceFlow_1" id="BPMNEdge_SequenceFlow_1"
            sourceElement="BPMNShape_StartEvent_1" targetElement="BPMNShape_CallActivity_CM1">
            <di:waypoint x="312.0" xsi:type="dc:Point" y="158.0"/>
            <di:waypoint x="360.0" xsi:type="dc:Point" y="158.0"/>
        </bpmndi:BPMNEdge>
        <bpmndi:BPMNEdge bpmnElement="SequenceFlow_2" id="BPMNEdge_SequenceFlow_2"
            sourceElement="BPMNShape_CallActivity_CM1" targetElement="BPMNShape_CallActivity_GS1">
            <di:waypoint x="460.0" xsi:type="dc:Point" y="158.0"/>
            <di:waypoint x="510.0" xsi:type="dc:Point" y="158.0"/>
        </bpmndi:BPMNEdge>
        <bpmndi:BPMNEdge bpmnElement="SequenceFlow_3" id="BPMNEdge_SequenceFlow_3"
            sourceElement="BPMNShape_CallActivity_GS1" targetElement="BPMNShape_EndEvent_1">
            <di:waypoint x="610.0" xsi:type="dc:Point" y="158.0"/>
            <di:waypoint x="700.0" xsi:type="dc:Point" y="158.0"/>
        </bpmndi:BPMNEdge>
        <!-- Message Flow Edges (Sender→Start, End→Receiver) -->
        <bpmndi:BPMNEdge bpmnElement="MessageFlow_1" id="BPMNEdge_MessageFlow_1"
            sourceElement="BPMNShape_Participant_1" targetElement="BPMNShape_StartEvent_1">
            <di:waypoint x="90.0" xsi:type="dc:Point" y="170.0"/>
            <di:waypoint x="280.0" xsi:type="dc:Point" y="158.0"/>
        </bpmndi:BPMNEdge>
        <bpmndi:BPMNEdge bpmnElement="MessageFlow_2" id="BPMNEdge_MessageFlow_2"
            sourceElement="BPMNShape_EndEvent_1" targetElement="BPMNShape_Participant_2">
            <di:waypoint x="732.0" xsi:type="dc:Point" y="158.0"/>
            <di:waypoint x="900.0" xsi:type="dc:Point" y="158.0"/>
        </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
</bpmndi:BPMNDiagram>
```

### LIP Layout Rules (Local Integration Processes)

When the iFlow contains Local Integration Processes (LIPs), each LIP is rendered as a **separate pool** stacked vertically below the main Integration Process pool. Every element inside each LIP — including elements inside exception subprocesses — MUST have its own BPMNShape and BPMNEdge entries.

**LIP pool positioning:** Stack LIP pools vertically below the main process pool with ~60px gaps:
```
Main Process Pool:     y=30,   height=280
LIP_1 Pool:            y=380,  height=180  (gap: 380 - (30+280) = 70)
LIP_2 Pool:            y=620,  height=250  (gap: 620 - (380+180) = 60)
LIP_3 Pool:            y=930,  height=250  (gap: 930 - (620+250) = 60)
```

**LIP pool height:** Base height = 180 (for LIPs without exception subprocesses). Add +70 for each exception subprocess inside the LIP (subprocess height ~100 + gap).

**Elements inside LIPs:** Use the same coordinate formulas as the main process, but offset the y-coordinates to fall within the LIP pool's vertical bounds. Each LIP's elements start at `pool_y + 60` for start events and `pool_y + 48` for steps.

**Exception subprocess elements:** Exception subprocesses inside LIPs need shapes for:
- The `<bpmn2:subProcess>` container itself
- The `ErrorStartEvent` inside it
- All callActivities and serviceTasks inside it
- The `ErrorEndEvent` inside it
- All sequenceFlows inside it

**MessageFlow edges from LIP elements:** When a serviceTask inside a LIP has a messageFlow to a receiver participant, the BPMNEdge connects from the serviceTask's position (inside the LIP pool) to the receiver participant. The y-coordinate of the source waypoint must match the serviceTask's y-center within the LIP.

**Complete LIP BPMNDiagram Example (3-step LIP with exception subprocess):**

```xml
<!-- LIP Pool shape -->
<bpmndi:BPMNShape bpmnElement="Participant_Process_3" id="BPMNShape_Participant_Process_3">
    <dc:Bounds height="250.0" width="600.0" x="250.0" y="620.0"/>
</bpmndi:BPMNShape>
<!-- LIP main flow elements (y within pool bounds: 620+62=682 for events, 620+48=668 for steps) -->
<bpmndi:BPMNShape bpmnElement="StartEvent_3" id="BPMNShape_StartEvent_3">
    <dc:Bounds height="32.0" width="32.0" x="280.0" y="682.0"/>
</bpmndi:BPMNShape>
<bpmndi:BPMNShape bpmnElement="CallActivity_20" id="BPMNShape_CallActivity_20">
    <dc:Bounds height="60.0" width="100.0" x="360.0" y="668.0"/>
</bpmndi:BPMNShape>
<bpmndi:BPMNShape bpmnElement="ServiceTask_1" id="BPMNShape_ServiceTask_1">
    <dc:Bounds height="60.0" width="100.0" x="510.0" y="668.0"/>
</bpmndi:BPMNShape>
<bpmndi:BPMNShape bpmnElement="EndEvent_4" id="BPMNShape_EndEvent_4">
    <dc:Bounds height="32.0" width="32.0" x="660.0" y="682.0"/>
</bpmndi:BPMNShape>
<!-- Exception Subprocess container (below the main flow, still inside pool) -->
<bpmndi:BPMNShape bpmnElement="SubProcess_1" id="BPMNShape_SubProcess_1">
    <dc:Bounds height="100.0" width="414.0" x="280.0" y="760.0"/>
</bpmndi:BPMNShape>
<!-- Exception Subprocess internal elements -->
<bpmndi:BPMNShape bpmnElement="StartEvent_10" id="BPMNShape_StartEvent_10">
    <dc:Bounds height="32.0" width="32.0" x="300.0" y="786.0"/>
</bpmndi:BPMNShape>
<bpmndi:BPMNShape bpmnElement="CallActivity_30" id="BPMNShape_CallActivity_30">
    <dc:Bounds height="60.0" width="100.0" x="380.0" y="772.0"/>
</bpmndi:BPMNShape>
<bpmndi:BPMNShape bpmnElement="ServiceTask_4" id="BPMNShape_ServiceTask_4">
    <dc:Bounds height="60.0" width="100.0" x="530.0" y="772.0"/>
</bpmndi:BPMNShape>
<bpmndi:BPMNShape bpmnElement="EndEvent_10" id="BPMNShape_EndEvent_10">
    <dc:Bounds height="32.0" width="32.0" x="660.0" y="786.0"/>
</bpmndi:BPMNShape>
<!-- LIP main flow edges -->
<bpmndi:BPMNEdge bpmnElement="SequenceFlow_30" id="BPMNEdge_SequenceFlow_30"
    sourceElement="BPMNShape_StartEvent_3" targetElement="BPMNShape_CallActivity_20">
    <di:waypoint x="312.0" xsi:type="dc:Point" y="698.0"/>
    <di:waypoint x="360.0" xsi:type="dc:Point" y="698.0"/>
</bpmndi:BPMNEdge>
<!-- ... (all sequenceFlow edges for main flow + exception subprocess) -->
<!-- MessageFlow from LIP serviceTask to external receiver -->
<bpmndi:BPMNEdge bpmnElement="MessageFlow_2" id="BPMNEdge_MessageFlow_2">
    <di:waypoint x="610.0" xsi:type="dc:Point" y="698.0"/>
    <di:waypoint x="1400.0" xsi:type="dc:Point" y="-30.0"/>
</bpmndi:BPMNEdge>
```

---

## 8. MANIFEST.MF

> **For iFlow artifacts: Do NOT hand-craft MANIFEST.MF.** The `scaffold-iflow` tool generates the correct MANIFEST.MF with the right `Import-Package` and `Import-Service` for the tenant. Use the scaffolded version as-is. Only modify to add `Require-Capability`.

> **For Message Mapping / Script Collection artifacts:** Use the templates below — these artifact types have simpler MANIFEST.MF without Import-Package/Import-Service.

**Formatting rules:**
- Lines MUST NOT exceed 72 bytes; continuation lines start with a single space
- File MUST end with a newline; no blank lines between headers

### iFlow MANIFEST.MF (scaffold-generated — do not hand-craft)

The scaffold produces this structure. **Do not overwrite** — the `Import-Package` and `Import-Service` values vary by tenant:
```
Manifest-Version: 1.0
Bundle-ManifestVersion: 2
Bundle-Name: {Display Name}
Bundle-SymbolicName: {Artifact_ID}; singleton:=true
Bundle-Version: 1.0.0
SAP-BundleType: IntegrationFlow
SAP-NodeType: IFLMAP
SAP-RuntimeProfile: iflmap
Origin-Bundle-Name: {Display Name}
Origin-Bundle-SymbolicName: {Artifact_ID}
Import-Package: ... (tenant-specific boilerplate — use scaffold value)
Import-Service: ... (tenant-specific boilerplate — use scaffold value)
```

**Script Collection Reference** — append to scaffolded iFlow MANIFEST.MF if needed:
```
Require-Capability: scriptcollection.{SC_ArtifactId};resolution:=opt
 ional;bundleType:String="ScriptCollection";source:String="reference"
```

### Message Mapping MANIFEST.MF

```
Manifest-Version: 1.0
Bundle-ManifestVersion: 2
Bundle-Name: {MM_Display_Name}
Bundle-SymbolicName: {MM_Artifact_ID}; singleton:=true
Bundle-Version: 1.0.0
SAP-BundleType: MessageMapping
SAP-NodeType: IFLMAP
SAP-RuntimeProfile: iflmap
```

### Script Collection MANIFEST.MF

```
Manifest-Version: 1.0
Bundle-ManifestVersion: 2
Bundle-Name: {SC_Display_Name}
Bundle-SymbolicName: {SC_Artifact_ID}; singleton:=true
Bundle-Version: 1.0.0
SAP-BundleType: ScriptCollection
SAP-NodeType: IFLMAP
SAP-RuntimeProfile: iflmap
```

---

## 9. parameters.prop Format

**Parameter naming convention:** Use `{participantOrAdapter}.{PropertyLabel}` — e.g., `receiver.Address`, `sender.Authorization`, `sftp.Credential`, `mail.receiver.Server`. Timer/polling schedules use `Scheduler` or `{adapter}.Scheduler`. Flow step params (Content Modifier, Data Store, PGP) use descriptive names (e.g., `headerValue`, `datastoreName`). See `parameters-generation-guide.md` §1 for the full naming table.

Java properties file. Generated timestamp comment, then `key=value` pairs:

```properties
#Mon Mar 09 12:04:12 UTC 2026
receiver.Address=https\://api.example.com/endpoint
receiver.AuthMethod=OAuth2ClientCredentials
receiver.Credential=myCredentialAlias
source.Address=/api/v1/inbound
source.AuthType=RoleBased
source.UserRole=ESBMessaging.send
error.MailTo=alerts@company.com
jms.QueueName=MyQueue
```

**Rules:**
- One parameter per line
- Colons in values escaped: `\:`
- Spaces in keys escaped: `\ `
- Empty file is valid (just timestamp comment)
- Parameters here set the DEFAULT values; they can be overridden via Configuration API after upload

---

## 10. parameters.propdef Format

XML file that defines parameter metadata and binds parameters to adapter attributes:

```xml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<parameters>
  <parameter>
    <key/>
    <name>receiver.Address</name>
    <type>xsd:string</type>
    <isRequired>false</isRequired>
    <constraint/>
    <description>Receiver endpoint URL</description>
    <additionalMetadata/>
  </parameter>
  <parameter>
    <key/>
    <name>receiver.Credential</name>
    <type>xsd:string</type>
    <isRequired>false</isRequired>
    <constraint/>
    <description>Credential alias for receiver authentication</description>
    <additionalMetadata/>
  </parameter>
  <param_references>
    <!-- Receiver adapter: FULL cmdVariantUri in attribute_id, attribute_category = participant name (with optional sub-path) -->
    <reference
      attribute_category="Receiver"
      attribute_id="ctype::AdapterVariant/cname::HTTP/tp::HTTP/mp::None/direction::Receiver/version::1.17.0/attrId::httpAddressWithoutQuery"
      attribute_uilabel="Address"
      param_key="receiver.Address"/>
    <reference
      attribute_category="Receiver.Receiver.Auth"
      attribute_id="ctype::AdapterVariant/cname::HTTP/tp::HTTP/mp::None/direction::Receiver/version::1.17.0/attrId::credentialName"
      attribute_uilabel="Credential Name"
      param_key="receiver.Credential"/>
  </param_references>
</parameters>
```

**Parameter types:** `xsd:string`, `xsd:integer`, `xsd:boolean`
**Combobox dropdown:** Add `<isCombobox>true</isCombobox>` inside `<additionalMetadata>` (used for fields like Authentication, Proxy Type).

**param_references** bind UI externalized parameters to the specific adapter attribute they control. **Sender and receiver adapters use DIFFERENT `attribute_id` formats.** See `parameters-generation-guide.md` §2 for full rules with examples.

**Generation rule for RECEIVER adapter parameters** (`{{paramName}}` used in a receiver messageFlow adapter property):
1. Add a `<reference>` entry to `<param_references>`
2. Set `attribute_category` to the participant name, optionally with sub-path (e.g., `Receiver`, `Receiver.Receiver.Auth`, `Receiver1.Receiver.System`)
3. Set `attribute_id` to: the adapter's `cmdVariantUri` + `/attrId::{propertyKey}` (note: use `cname::` without the `sap:` prefix — e.g., `cname::HTTP` not `cname::sap:HTTP`)
4. Set `attribute_uilabel` to the property's `label` from the metadata JSON
5. Set `param_key` to the parameter name from `parameters.prop`

**Generation rule for SENDER adapter parameters** (`{{paramName}}` used in a sender messageFlow adapter property):
1. Add a `<reference>` entry to `<param_references>`
2. Set `attribute_category` to `"Sender"` (or `"Sender.Receiver.System"` for address-type properties)
3. Set `attribute_id` to SHORT form: `/attrId::{propertyKey}` — NO cmdVariantUri prefix
4. Set `attribute_uilabel` to `""` (empty)
5. Set `param_key` to the parameter name from `parameters.prop`

**Flow step parameters** (Content Modifier, Data Store, PGP Encryptor, etc.): Add `<parameter>` entries in propdef but do NOT add any `<reference>` in `<param_references>`. Flow step params have no adapter binding.

**Empty `<param_references/>` is INVALID** when externalized parameters exist. It causes the CPI Web UI to fail to bind parameters to adapter fields, resulting in `"Enter adapter details for channel"` errors.

---
