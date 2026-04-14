# CI-Developer Skill Test Script

## Purpose

This test script validates the completeness and accuracy of the `ci-developer` SKILL.md by simulating 46 complex iFlow scenarios and checking 364 specific checkpoints. Run this script after ANY change to SKILL.md to catch regressions.

## How to Use

Instruct the LLM:

> "Read the test script at `skills/ci-developer/tests/ci-developer-skill-test-script.md` and the skill at `skills/ci-developer/SKILL.md`. Execute ALL test rounds. For each checkpoint, verify against the ACTUAL content of SKILL.md — do not assume from memory. Report PASS/FAIL per checkpoint with line number evidence. At the end, report the total score and list any FAILs."

## Pass Criteria

- **Full pass:** 364/364 checkpoints PASS
- **Acceptable:** 357+/364 (98%+) with only minor/cosmetic FAILs
- **Needs fixes:** Any FAIL on a Critical or High severity checkpoint
- **After fixes:** Re-run ALL checkpoints (not just the fixed ones) to catch regressions

## Severity Levels

- **CRITICAL:** Would cause invalid BPMN XML generation or deployment failure
- **HIGH:** Would cause incorrect iFlow behavior or missing required configuration
- **MEDIUM:** Would degrade quality or require LLM inference to fill gaps
- **LOW:** Nice-to-have, cosmetic, or edge cases

---

# Test Round 1: Core Trigger Types & Patterns (Scenarios 1-6, 64 checks)

## Scenario 1: Timer → HTTP Fetch → Splitter → Router → SOAP/SFTP/Discard

**Description:** Timer-triggered (every 10 min), calls REST API (OAuth2), splits JSON into individual orders, routes by status: approved→SOAP, pending→Groovy→SFTP, rejected→discard. Exception handling. Package: EQUATE_ORDER_PROCESSING.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 1 | Timer sender fields N/A | HIGH | Extraction checklist fields 4,6,7 say "For Timer-triggered iFlows: set to N/A" |
| 2 | Mapping vs transformation clarification | MEDIUM | Field 13 distinguishes formal Message Mapping (.mmap) from Groovy/XSLT transformation |
| 3 | Archetype partial match guidance | HIGH | Text exists for "closest archetype partially matches" with customization during Phase C |
| 4 | B.6 Timer skip note | HIGH | B.6 sender adapter Grep says "For Timer-triggered iFlows: skip sender adapter Grep" with hardcoded cmdVariantUri |
| 5 | Many Grep calls guidance | LOW | B.6 flow steps note says "5-8+ parallel Grep calls. This is fine" |
| 6 | Router condition wiring | CRITICAL | Common Integration Patterns has "Content-based Router" with conditionExpression on sequenceFlow |
| 7 | Intermediate Request-Reply | HIGH | Common Integration Patterns has "Intermediate Request-Reply" pattern |
| 8 | Discard pattern | MEDIUM | Common Integration Patterns has "Discard pattern (log and drop)" |
| 9 | JSON→XML pipeline | HIGH | Common Integration Patterns has "JSON API → XML processing pipeline" |
| 10 | TIMER_ROUTING flow pattern | MEDIUM | FLOW_PATTERN definitions include "TIMER_ROUTING: Timer-triggered, multiple receivers or routing" |

## Scenario 2: HTTPS → XML Validate → 2x Enrichment → Mapping → Multicast → IDoc/SFTP/DataStore

**Description:** HTTPS-triggered (RoleBased auth), validate XML, enrich from SOAP (on-prem, ClientCert) + HTTP (OAuth2), Message Mapping, multicast to IDoc/SFTP/DataStore. Exception with escalation. Package: EQUATE_PRC_SupplierPO.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 11 | Data Store as flow step | HIGH | Field 8 says "Data Store operations and Persist Message steps are NOT receivers" |
| 12 | Exception handling type | MEDIUM | Field 16 captures specific exception type (e.g., terminate), default is ErrorEnd |
| 13 | Sync/async field (12b) | HIGH | Field 12b asks sync/async for HTTPS/SOAP-triggered, N/A for others |
| 14 | XML Validator in step list | MEDIUM | Processing steps list includes "XML Validator" |
| 15 | Multicast fan-out pattern | CRITICAL | Common Integration Patterns has "Multicast fan-out" with parallelGateway, fork/join |
| 16 | Data Store operations pattern | HIGH | Common Integration Patterns documents Data Store Write/Select/Get/Delete with flavors |
| 17 | Proxy+auth compatibility | CRITICAL | OAuth2 requires proxyType=default; ClientCert+on-premise OK; positive compatibility statement |
| 18 | Exception Subprocess reference | MEDIUM | Exception Subprocess pattern references bpmn-generation-guide.md §5 |

## Scenario 3: SFTP → PGP → CSV → Splitter → LIP → JDBC + ProcessDirect (multi-artifact)

**Description:** PGP-encrypted CSV via SFTP (key-based auth), decrypt, CSV-to-XML, split, Idempotent Process Call, LIP validates via JDBC (on-prem), XSLT, ProcessDirect to second iFlow for IDoc posting. Script Collection. Multi-artifact. Package: EQUATE_FIN_BOCOM.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 19 | SFTP publickey auth | HIGH | Field 6 maps "PublicKey/KeyPair(SFTP)→publickey" |
| 20 | Field 12b N/A for SFTP | MEDIUM | Field 12b says "N/A for SFTP/Timer/IDoc/XI/JMS-triggered iFlows" |
| 21 | FLOW_PATTERN for SFTP | LOW | P2P definition includes SFTP, with splitter note |
| 22 | PGP/CSV in Less common steps | MEDIUM | Less common steps note includes PGP and CSV converters |
| 23 | Idempotent Process Call in step list | MEDIUM | Processing steps list includes "Idempotent Process Call" |
| 24 | LIP + Process Call pattern | CRITICAL | Common Integration Patterns documents LIP as separate bpmn2:process, Process Call with processId |
| 25 | XSLT file location in zip | MEDIUM | Zip folder structure shows mapping/ folder includes .xsl/.xslt files |
| 26 | Script Collection reference | HIGH | Common Integration Patterns documents scriptBundleId, Require-Bundle in MANIFEST.MF |
| 27 | MULTI_ARTIFACT output format | HIGH | Sub-agent output has MULTI_ARTIFACT section with per-artifact details and DEPLOY_ORDER |
| 28 | Phase C.1b generation order | HIGH | Phase C.1b documents generation in dependency order |
| 29 | Multi-artifact D-E execution | HIGH | Guidance says run Phase D+E sequentially per artifact in dependency order |

## Scenario 4: IDoc → JMS → JMS Consumer → Poll Enrich → MIME → AS2 (multi-artifact)

**Description:** 2-iFlow async pipeline. iFlow 1: IDoc sender (on-prem), writes to JMS queue. iFlow 2: JMS consumer, Poll Enrich from SFTP, XSLT to EDI, MIME multipart, AS2 send. Looping Process Call for retry. Package: EQUATE_SCM_DeliveryASN.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 30 | IDoc sender auth | HIGH | Field 6 says "For IDoc/XI-triggered: typically ClientCertificate or None" |
| 31 | IDoc sender endpoint | MEDIUM | Field 7 says "For IDoc/XI-triggered: endpoint is auto-assigned by CPI" |
| 32 | JMS sender auth N/A | MEDIUM | Field 6 says "For JMS-triggered: set to N/A" |
| 33 | JMS sender system name | LOW | Field 4 says "For JMS-triggered: set to JMS Queue" |
| 34 | JMS queue as receiver | MEDIUM | Field 8 says "JMS queue writes ARE adapter-based receivers" |
| 35 | Per-artifact archetype | HIGH | MULTI_ARTIFACT section has Archetype field per artifact |
| 36 | JMS deploy order flexible | MEDIUM | MULTI_ARTIFACT DEPLOY_ORDER note says JMS deploy order is flexible (queue buffers) |
| 37 | Poll Enrich pattern | HIGH | Common Integration Patterns documents PollEnrich activityType, merge strategy |
| 38 | MIME Multipart pattern | MEDIUM | Common Integration Patterns documents MIME Encoder/Decoder |
| 39 | Looping Process Call pattern | HIGH | Common Integration Patterns documents LoopProcess activityType, maxIterations, loopCondition |
| 40 | JMS async decoupling | HIGH | Common Integration Patterns documents writer + consumer + queue name alignment |
| 41 | IDoc/XI-Triggered Rules | HIGH | Dedicated section covers IDoc/XI sender participant, SAP headers, acknowledgment |

## Scenario 5: SOAP sync → Filter → OData + RFC → Aggregator → JSON → AMQP side-channel

**Description:** Sync SOAP-triggered (RoleBased), ID Mapping, Filter, OData stock check (on-prem Basic), RFC pricing (on-prem Basic), aggregate, XML-to-JSON, publish to AMQP (async parallel), return JSON sync response. returnExceptionToSender=true. Package: EQUATE_SCM_MaterialAvailability.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 42 | ID Mapping in step list | MEDIUM | Processing steps list includes "ID Mapping" |
| 43 | Aggregator in step list | MEDIUM | Processing steps list includes "Aggregator" |
| 44 | Multicast covers async side-channels | MEDIUM | Complexity modifier 'multicast' includes "OR async side-channel parallel to main flow" |
| 45 | ID Mapping + Aggregator in Less common note | LOW | Less common steps note includes ID Mapping and Aggregator |
| 46 | Sync response pattern | CRITICAL | Common Integration Patterns has "Synchronous request-response" with returnExceptionToSender, EndEvent body = response |
| 47 | Preserving intermediate results | HIGH | Common Integration Patterns has "Preserving intermediate results" with Solution A (save to property) and Solution B (Multicast+Gather) |
| 48 | Multicast with sync response | HIGH | Common Integration Patterns has "Multicast with sync response" with branch ordering (main branch LAST) |
| 49 | Filter step behavior | HIGH | Common Integration Patterns has "Filter step behavior" with throwExceptionOnFilterFailure |
| 50 | OData in Wiring Table | CRITICAL | Wiring Lookup Table lists OData = Request-Reply + serviceTask |
| 51 | RFC in Wiring Table | CRITICAL | Wiring Lookup Table lists RFC = Request-Reply + serviceTask |
| 52 | AMQP in Wiring Table | CRITICAL | Wiring Lookup Table lists AMQP = Request-Reply + serviceTask |

## Scenario 6: Timer → Router → 2x ProcessDirect sub-flows (3-iFlow set)

**Description:** 3-iFlow employee sync. iFlow 1: Timer→SuccessFactors OData→split→route NEW_HIRE→iFlow 2, TERMINATION→iFlow 3. iFlow 2: PD sender, SF OData enrich, XML Digital Sig, XML-to-CSV, SFTP, Persist Message. iFlow 3: PD sender, OData to S/4 (on-prem), Kafka (SASL), Terminate End Event. Package: EQUATE_HRM_EmployeeSync.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 53 | ProcessDirect sender auth N/A | MEDIUM | Field 6 says "For ProcessDirect-triggered: set to N/A" |
| 54 | ProcessDirect is SYNCHRONOUS | CRITICAL | Field 12b says "For ProcessDirect-triggered iFlows: ASK_USER — ProcessDirect calls are synchronous" |
| 55 | Kafka SASL auth | HIGH | Field 6 maps "SASL(Kafka)→PLAIN or SCRAM-SHA-256" |
| 56 | XML Digital Signer in step list | MEDIUM | Processing steps includes "XML Digital Signer/Verifier" |
| 57 | Persist Message in step list | MEDIUM | Processing steps includes "Persist Message" |
| 58 | Terminate End Event in step list | MEDIUM | Processing steps includes "Terminate End Event" |
| 59 | PD + SFTP archetype heuristic | LOW | Archetype heuristic has "ProcessDirect trigger + SFTP target → partial match A1/A2" |
| 60 | ProcessDirect-Triggered Rules | HIGH | Dedicated section covers address matching, sync behavior, exchange propagation, deploy order |
| 61 | Terminate End Event pattern | HIGH | Common Integration Patterns documents terminateEventDefinition, kills all branches |
| 62 | Persist Message pattern | MEDIUM | Common Integration Patterns documents Persist as callActivity for audit |
| 63 | XML Digital Signature pattern | HIGH | Common Integration Patterns documents keystore alias, Signer/Verifier |
| 64 | C.1 validation callActivity list | MEDIUM | Validation check #3 has generalized list including Data Store, Persist, PGP, XML Sig, etc. |

---

# Test Round 2: Niche Adapters & Advanced Patterns (Scenarios 7-11, 57 checks)

## Scenario 7: XI Sender → EDI Processing → PKCS7 Signing → AS2 B2B

**Description:** SAP PI migration. XI sender (on-prem), EDI-to-XML, EDI validator, Message Mapping, XML-to-EDI, PKCS7/CMS sign, AS2 send. WSDL/XSD in zip. Package: EQUATE_SCM_PIEDI_Migration.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 65 | XI in sender adapter list | HIGH | Field 5 includes "XI" in the adapter type options |
| 66 | XI auth/endpoint handled | HIGH | Fields 6-7 have IDoc/XI-specific notes for auth and endpoint |
| 67 | EDI converters discoverable | MEDIUM | EDI-to-XML Converter and XML-to-EDI Converter in step list OR discoverable via Less common steps Grep |
| 68 | PKCS7 in Less common note | MEDIUM | Less common steps note includes "PKCS7" |
| 69 | WSDL/XSD in zip structure | HIGH | Zip folder structure includes src/main/resources/xsd/* and src/main/resources/wsdl/* |
| 70 | AS2 in Wiring Table | CRITICAL | Wiring Lookup Table lists AS2 = Send OR Request-Reply |
| 71 | XI trigger → A13 archetype | MEDIUM | Archetype heuristic maps "IDoc/XI trigger → A13 (IDoc/XI Bridge)" |
| 72 | IDoc/XI Rules for XI | HIGH | IDoc/XI-Triggered Rules section explicitly mentions XI |
| 73 | FLOW_PATTERN for XI | LOW | P2P definition includes XI in the trigger list |
| 74 | EDI Validator in step list | MEDIUM | Processing steps includes "EDI Splitter/Validator" |

## Scenario 8: HTTPS Sync JSON → Large Flow (12+ steps) → Nested LIP → Error End Event

**Description:** HTTPS-triggered sync API (OAuth2 CC — but OAuth2 is receiver-only, so actually RoleBased sender). 12+ steps including 2 LIPs, Message Mapping, OData (on-prem). Exception subprocess uses ErrorEnd. returnExceptionToSender=true. Package: EQUATE_ORDER_API.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 75 | Sender/receiver auth direction | CRITICAL | Auth section states OAuth2 CC is NOT valid for sender adapters; RoleBased is sender-only |
| 76 | JSON converters discoverable | MEDIUM | JSON-to-XML and XML-to-JSON in step list or discoverable via Grep |
| 77 | Multiple LIPs in same iFlow | HIGH | LIP pattern says "multiple bpmn2:process elements" in same .iflw |
| 78 | LIP can call external systems | HIGH | LIP pattern says receiver participants are in main collaboration, not inside LIP |
| 79 | Sync response pattern | CRITICAL | EndEvent body = response, returnExceptionToSender documented with BPMN XML |
| 80 | ErrorEnd in exception subprocess | CRITICAL | Exception Subprocess mandates ErrorEnd, NOT EscalationEnd, with explicit warning |
| 81 | Field 12b for HTTPS sync | HIGH | Field 12b asks sync/async for HTTPS-triggered |
| 82 | Large iFlow guidance | MEDIUM | "Large iFlow Considerations" section exists with 12+ step threshold, splitting advice |
| 83 | XSD in zip structure | MEDIUM | Zip folder structure includes src/main/resources/xsd/* |
| 84 | OAuth2 + proxyType=default | CRITICAL | Auth section says OAuth2 requires proxyType=default |

## Scenario 9: Timer → SuccessFactors → Data Store Dedup → Gather → 2 LIPs

**Description:** Timer (hourly), poll SuccessFactors OData, Data Store Select for dedup, split, parallel LIP calls, Gather/Join, SOAP to S/4HANA, Data Store Write + Delete for cleanup. Package: EQUATE_HRM_SFSFSync.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 85 | Timer + OData → A8 archetype | MEDIUM | Archetype heuristic maps "Timer + HTTP/OData → A8 (Timer API Poller)" |
| 86 | Data Store Select flavor | HIGH | Data Store pattern documents `"flavor": "select"` (lowercase) |
| 87 | Data Store Delete flavor | HIGH | Data Store pattern documents `"flavor": "delete"` (lowercase, NOT "delete_op") |
| 88 | Data Store Write flavor | HIGH | Data Store pattern documents `"flavor": "put"` |
| 89 | Gather/Join in step list | MEDIUM | Processing steps includes "Gather/Join" |
| 90 | Multicast + Gather for parallel LIPs | HIGH | Multicast pattern documents parallelGateway fork + optional join |
| 91 | Timer-Triggered Rules | HIGH | Dedicated section covers no sender participant, intermediatetimer cmdVariantUri |
| 92 | SuccessFactors in Wiring Table | CRITICAL | Wiring Lookup Table lists SuccessFactors = Request-Reply |
| 93 | Multiple Data Store ops guidance | MEDIUM | Data Store pattern says multiple operations supported, no transaction boundaries |
| 94 | Timer hourly schedule | MEDIUM | Timer Schedule Format has cron field documentation sufficient for hourly derivation |

## Scenario 10: SFTP → Splitter → Idempotent → Looping → JMS Dead Letter

**Description:** SFTP (user_password), split batch payments, Idempotent Process Call, Looping Process Call wrapping HTTP call (OAuth2) with 3 retries, failed → JMS DLQ, success → SFTP (publickey). Package: EQUATE_FIN_PaymentRetry.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 95 | SFTP user_password auth | HIGH | Field 6 and auth table map user_password correctly |
| 96 | Nesting Idempotent + Looping | HIGH | Nesting guidance exists explaining multi-LIP BPMN structure |
| 97 | Looping maxIterations=3 | HIGH | Looping Process Call pattern documents maximumIterations property |
| 98 | JMS dead-letter queue pattern | HIGH | Common Integration Patterns has "JMS dead-letter queue" with DLQ naming, error headers |
| 99 | Same protocol sender+receiver | MEDIUM | "Same Protocol on Sender and Receiver" section covers distinct naming, parameter prefixes |
| 100 | JMS Send in Wiring Table | CRITICAL | Wiring Table lists JMS = Send OR Request-Reply |
| 101 | Idempotent Process Call in step list | MEDIUM | Processing steps includes "Idempotent Process Call" |
| 102 | Partial failure per record | HIGH | LIP pattern includes "Partial failure handling (Splitter + LIP)" with ErrorEnd absorption |
| 103 | SFTP publickey receiver auth | HIGH | Auth mapping includes publickey; auth table has Public Key row |
| 104 | OAuth2 + proxyType=default | CRITICAL | Auth rules document OAuth2 requires proxyType=default |

## Scenario 11: ProcessDirect Chain (A→B→C) → External Mapping → Shared Credentials

**Description:** 3-iFlow PD chain. HTTPS sender → PD → PD → SOAP (on-prem). External Message Mapping artifact. Shared credential alias. Package: EQUATE_CHAIN_Demo.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 105 | PD chain deploy order C→B→A | HIGH | Phase C.2 + PD chain rule document leaf-first deploy order |
| 106 | External mapping reference | HIGH | Mapping Placement documents mappingSrcExternal + Require-Capability |
| 107 | 4 artifacts in MULTI_ARTIFACT | HIGH | Output format supports arbitrary number of artifacts |
| 108 | Generation order mapping→C→B→A | HIGH | Phase C.1b documents generation in dependency order |
| 109 | 4 sequential D-E rounds | HIGH | Multi-artifact execution guidance says sequential per artifact |
| 110 | PD address exact match | CRITICAL | PD rules + Phase C.2 document exact address matching (case-sensitive) |
| 111 | Shared credential alias guidance | MEDIUM | Externalization section has shared credentials guidance for multi-artifact sets |
| 112 | PD-Triggered Rules for B and C | HIGH | PD-Triggered Rules section applies to any PD sender iFlow |
| 113 | Sync response through PD chain | HIGH | PD rules document sync behavior + response flows back to caller |
| 114 | PD chain error propagation | HIGH | Exception Subprocess documents ProcessDirect error propagation |

---

# Test Round 3: CPI Runtime & Step Configuration (Scenarios 12-16, 38 checks)

## Scenario 12: HTTPS → Content Modifier (multi-header/property) → XPath Router → 3 receivers

**Description:** HTTPS sync API (RoleBased). CM#1 sets properties + headers using CPI expressions. XPath Router with 3 routes (STANDARD→HTTP, RETURN→SOAP, default→400 error). returnExceptionToSender. Package: EQUATE_ORDER_Router.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 115 | Content Modifier BPMN properties | CRITICAL | CPI Runtime Fundamentals has "Content Modifier BPMN Configuration" with headerTable, propertyTable, bodyType, body XML examples |
| 116 | Properties vs headers difference | HIGH | Exchange Model table explains scope, persistence, sent externally, when to use |
| 117 | CPI expression syntax | CRITICAL | Expression Syntax table documents ${in.body}, ${header.X}, ${property.X}, ${xpath:...}, ${date:...} |
| 118 | XPath Router conditions | HIGH | Router pattern documents conditionExpression on sequenceFlow with XPath/NonXML expressionType |
| 119 | routeCondition on sequenceFlow | CRITICAL | Router pattern says conditionExpression on sequenceFlow (NOT routeCondition{N} on callActivity) |
| 120 | Default route (otherwise) | MEDIUM | Router pattern documents default route with no condition |
| 121 | CamelHttpResponseCode | HIGH | Standard SAP/Camel Headers table includes CamelHttpResponseCode |
| 122 | Multiple Content Modifiers | LOW | No warning against multiple CMs; patterns use them in sequence |
| 123 | SAP_MessageProcessingLogID header | MEDIUM | Standard SAP/Camel Headers table includes SAP_MessageProcessingLogID |
| 124 | HTTPS sender RoleBased | HIGH | Auth direction section confirms RoleBased for HTTPS sender |

## Scenario 13: SOAP → Groovy (header manipulation) → HTTP → Response headers

**Description:** SOAP sync (RoleBased). CM extracts SOAP headers to properties. Groovy validates + sets headers. Router on header value. CM builds error from properties. CM removes internal headers before response. returnExceptionToSender. Package: EQUATE_MDM_VendorSync.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 125 | Groovy Script API | CRITICAL | CPI Runtime Fundamentals has Groovy API with getHeader, setHeader, getProperty, setProperty, getBody, setBody |
| 126 | Header-based routing | HIGH | Router pattern mentions "XPath or Camel Simple expressions" including ${header.X} |
| 127 | Header Delete action | HIGH | Content Modifier config documents Delete action in headerTable |
| 128 | Body from property expression | HIGH | Content Modifier config documents bodyType=expression with ${property.X} |
| 129 | SAP standard headers | MEDIUM | Standard SAP/Camel Headers table includes SAP_Sender, SAP_Receiver, SAP_MessageProcessingLogID |
| 130 | Groovy file naming/path | HIGH | Generation Steps document camelCase.groovy in src/main/resources/script/ with case-sensitive match |
| 131 | Router dual trigger types | MEDIUM | Router pattern mentions "XPath or Camel Simple expressions" (body-based and header-based) |

## Scenario 14: Timer → HTTP fetch → CM (tracking from response) → Splitter → per-record headers → Router → HTTP/SFTP

**Description:** Timer (15 min). Request-Reply HTTP (OAuth2). CM sets property from response header. Splitter. Per-record: CM sets header from XPath + CamelSplitIndex. Header-based Router. HTTP/SFTP receivers. Package: EQUATE_BATCH_Processor.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 132 | Response headers after Request-Reply | HIGH | Standard headers note says "After Request-Reply: HTTP response headers from the external system become available as exchange headers" |
| 133 | CamelSplitIndex/CamelSplitSize | HIGH | Standard SAP/Camel Headers table includes CamelSplitIndex, CamelSplitSize, CamelSplitComplete |
| 134 | ${xpath:...} syntax | CRITICAL | Expression Syntax table includes ${xpath:expression} with examples |
| 135 | Post-Splitter per-record behavior | HIGH | After Splitter note says "All steps after a Splitter operate on each individual split record" |
| 136 | TIMER_ROUTING flow pattern | MEDIUM | FLOW_PATTERN includes TIMER_ROUTING |
| 137 | Timer 15min schedule | MEDIUM | Timer Schedule Format cron fields support minute=0/15 derivation |
| 138 | Content-Type before HTTP receiver | HIGH | Anti-pattern and pattern document Content Modifier setting Content-Type before HTTP receiver |

## Scenario 15: SFTP → Filename extraction → Groovy (parse metadata) → Header-based Router → JDBC/SFTP/discard

**Description:** SFTP (user_password, /inbound/payments/). CM extracts CamelFileName. Groovy parses filename pattern. Router on header X-FileType. Routes to JDBC/SFTP/discard. Package: EQUATE_FIN_FileRouter.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 139 | CamelFileName from SFTP sender | HIGH | Standard SAP/Camel Headers table includes CamelFileName with "SFTP/FTP sender" |
| 140 | Groovy common use cases | MEDIUM | Groovy API Reference lists string parsing, JSON building, XML parsing, header manipulation, validation |
| 141 | SFTP directory in field 7 | MEDIUM | Field 7 has SFTP-triggered note about directory path and externalization |
| 142 | CSV-to-XML discoverable | MEDIUM | Step list includes CSV-to-XML; Less common note covers it |
| 143 | JDBC in Wiring Table | CRITICAL | Wiring Table lists JDBC = Request-Reply |
| 144 | Same protocol sender+receiver | MEDIUM | "Same Protocol on Sender and Receiver" section exists with naming guidance |
| 145 | Groovy XmlSlurper documented | HIGH | Groovy API has XmlSlurper example with field access patterns |

## Scenario 16: ProcessDirect → Read caller properties → OData query → Build response → Return

**Description:** ProcessDirect-triggered. Parent sets properties. CM reads properties, sets OData query headers. Request-Reply SuccessFactors OData (OAuth2). CM extracts response fields. Groovy builds JSON. Return to caller. Package: EQUATE_HRM_EmployeeLookup.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 146 | PD exchange propagation | CRITICAL | PD-Triggered Rules says "calling iFlow's exchange (headers AND properties) is passed to the called iFlow" |
| 147 | OData query parameters | HIGH | "OData Receiver Query Parameters" section documents $filter, $select, $expand, resourcePath, queryOptions |
| 148 | SuccessFactors in Wiring Table | CRITICAL | Wiring Table lists SuccessFactors = Request-Reply |
| 149 | Groovy JSON building | HIGH | Groovy API documents JsonBuilder import and usage |
| 150 | PD-Triggered Rules section | HIGH | Dedicated section exists with address, sync, auth, deploy rules |
| 151 | OData V2 vs V4 JSON warning | HIGH | OData section warns V4 returns JSON, needs JSON-to-XML for XPath |
| 152 | returnExceptionToSender XML | HIGH | Sync response pattern gives exact BPMN XML property placement |

---

# Test Round 4: Deep Step Configuration (Scenarios 17-21, 38 checks)

## Scenario 17: Content Modifier Deep Test — Headers, Properties, Body, Delete

**Description:** HTTPS sync. CM#1: set properties (${date:now:...}, ${in.body}) + headers (${header.SAP_MessageProcessingLogID}). CM#2: set body to XML with ${property.X}. Request-Reply HTTP (OAuth2). CM#3: Delete headers, set CamelHttpResponseCode=200. Return. Package: EQUATE_CM_DeepTest.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 153 | ${date:now:...} syntax | HIGH | Expression Syntax table includes ${date:now:yyyyMMdd} with format example |
| 154 | bodyType=expression with ${property.X} | CRITICAL | Content Modifier config documents bodyType + body with expression value |
| 155 | headerTable Delete rows | HIGH | Content Modifier config documents Delete action with cleanup guidance |
| 156 | CamelHttpResponseCode setting | HIGH | Headers table + sync pattern document setting response code |
| 157 | Each CM is separate callActivity | MEDIUM | Content Modifier uses callActivity with its own ifl:property entries |
| 158 | returnExceptionToSender BPMN XML | HIGH | Exact ifl:property inside bpmn2:collaboration extensionElements shown |
| 159 | OAuth2 receiver-only (not sender) | CRITICAL | Auth direction section explicitly states OAuth2 CC is NOT valid for sender adapters |

## Scenario 18: Groovy Script Deep Test — Parse, Validate, Build JSON

**Description:** ProcessDirect-triggered. Groovy#1: XmlSlurper validate, set property/header. Router on header. Groovy#2: build JSON from properties. CM: Content-Type. Request-Reply HTTP (Basic). Return. Package: EQUATE_HRM_EmployeeValidator.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 160 | XmlSlurper/XmlParser in Groovy API | HIGH | Groovy API has XML parsing example with XmlSlurper, field access (.text(), @attribute) |
| 161 | Groovy setProperty/setHeader | CRITICAL | Groovy API boilerplate shows setProperty and setHeader usage |
| 162 | Groovy setBody for JSON | HIGH | Groovy API boilerplate shows setBody with JSON string |
| 163 | Header-based routing syntax | HIGH | Router pattern covers Camel Simple expressions on sequenceFlow conditionExpression |
| 164 | CM body from property | HIGH | Content Modifier config documents bodyType=expression + ${property.X} |
| 165 | PD exchange propagation | CRITICAL | PD rules document caller properties available in called iFlow |
| 166 | Two scripts in same iFlow | MEDIUM | Zip structure supports multiple .groovy files; each CM is separate callActivity |
| 167 | Script filenames camelCase | MEDIUM | Generation Steps specify camelCase.groovy naming convention |

## Scenario 19: Splitter + Per-Record Processing — Properties, CamelSplitIndex, Error Per Record

**Description:** Timer. HTTP fetch JSON. JSON-to-XML. Splitter. Per-record: CM sets property from CamelSplitIndex + header from XPath. Request-Reply HTTP. Groovy accumulates failed orders. Post-split summary. SFTP send. LIP error handling. Package: EQUATE_ORDER_BatchValidator.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 168 | CamelSplitIndex documented | HIGH | Standard SAP/Camel Headers table has CamelSplitIndex |
| 169 | ${xpath:...} in CM | CRITICAL | Expression Syntax table has ${xpath:expression} |
| 170 | Properties persist across split records | HIGH | After Splitter note confirms properties set before Splitter accessible in all records |
| 171 | Property mutation across split records | HIGH | "Property mutation" note explains sequential (shared) vs parallel (copy) behavior |
| 172 | Post-Splitter per-record behavior | HIGH | After Splitter note says steps operate on individual records |
| 173 | LIP error absorption with ErrorEnd | CRITICAL | Exception Subprocess documents LIP exception subprocess with ErrorEnd, error absorbed |
| 174 | JSON-to-XML before Splitter | HIGH | JSON→XML pipeline pattern documented |
| 175 | Timer + Splitter → A9 | MEDIUM | Archetype heuristic maps Timer + splitting → A9 |

## Scenario 20: Router BPMN Deep Test — 4 Routes with XPath + Default

**Description:** HTTPS sync. Router with 4 routes (RUSH→HTTP, STANDARD→SOAP, RETURN→SFTP Send, default→400 error). Each route has own EndEvent. Sync response. Package: EQUATE_ORDER_MultiRouter.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 176 | Router = exclusiveGateway | CRITICAL | Router pattern says bpmn2:exclusiveGateway (NOT callActivity) |
| 177 | conditionExpression on sequenceFlow | CRITICAL | Router pattern documents conditionExpression with expressionType, references bpmn-generation-guide §5 |
| 178 | Default route (otherwise) | MEDIUM | Router pattern documents default route with no condition |
| 179 | Each route ends with EndEvent | HIGH | Router pattern says "Each branch ends with its own EndEvent" |
| 180 | Sync response from any route | HIGH | Sync response pattern says EndEvent body = response, whichever route executes |
| 181 | Mixed receiver types per route | HIGH | Wiring Table covers HTTP (Request-Reply), SOAP (Request-Reply), SFTP (Send) |
| 182 | HTTPS RoleBased → SOAP Basic on-prem | HIGH | Auth direction + proxy rules cover this combination |
| 183 | SFTP Send valid | MEDIUM | Wiring Table lists SFTP = Send OR Request-Reply; Send for fire-and-forget |

## Scenario 21: End-to-End Property Lifecycle — Preserve, Transform, Return

**Description:** SOAP sync. CM#1: save body to property. Request-Reply #1 OData (replaces body). CM#2: save OData response to property. CM#3: restore original body from property. Request-Reply #2 HTTP (replaces body). CM#4: save pricing to property. Groovy: combine 3 properties. CM#5: set Content-Type + status 200. Return. Package: EQUATE_ORDER_PropertyLifecycle.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 184 | Solution A (save to property) | HIGH | Preserving intermediate results pattern documents saving body to property before Request-Reply |
| 185 | Restore body from property | CRITICAL | Content Modifier config documents bodyType=expression, body=${property.X} |
| 186 | Request-Reply replaces body | HIGH | Preserving results pattern explicitly states "Each Request-Reply REPLACES the message body" |
| 187 | Groovy reading 3 properties | HIGH | Groovy API documents message.getProperty() |
| 188 | 8 steps — large iFlow guidance | LOW | Large iFlow section exists (threshold is 12+, 8 is under it) |
| 189 | returnExceptionToSender BPMN | HIGH | Exact XML property placement documented |
| 190 | SOAP sender RoleBased | HIGH | Auth direction confirms RoleBased for SOAP sender |
| 191 | Properties survive Request-Reply | CRITICAL | Exchange Model explicitly says properties persist across all steps and adapter calls |

---

# Test Round 5: Validation & Regression (Scenarios 22-26, 32 checks)

## Scenario 22: HTTPS API with Groovy validation + property-based error building

**Description:** HTTPS sync (RoleBased). CM save body. Groovy validates XML (XmlSlurper), builds error JSON (JsonBuilder), sets header X-Valid. Router on header. Error: CM body=${property.errors}, CamelHttpResponseCode=400. Success: Request-Reply HTTP (OAuth2), CamelHttpResponseCode=200. Package: EQUATE_API_Validate.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 192 | XmlSlurper in Groovy API | HIGH | Groovy API has XmlSlurper example |
| 193 | JsonBuilder in Groovy API | HIGH | Groovy API has JsonBuilder import and usage |
| 194 | Router = exclusiveGateway + conditionExpression | CRITICAL | Router pattern is correct |
| 195 | CM body=${property.errors} + bodyType=expression | HIGH | Content Modifier config covers this |
| 196 | CamelHttpResponseCode for 200 and 400 | HIGH | Headers table documents this |
| 197 | Auth direction: HTTPS RoleBased sender, HTTP OAuth2 receiver | CRITICAL | Auth direction section covers both |

## Scenario 23: SFTP → filename → CSV-to-XML → per-record JDBC + property preservation

**Description:** SFTP (publickey). CM: property fileName=${header.CamelFileName}. CSV-to-XML. Splitter. Per-record: CM with CamelSplitIndex + ${xpath:...}. JDBC (on-prem, Basic). Post-split: CM body summary. SFTP send (user_password). Package: EQUATE_FIN_CSVImport.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 198 | CamelFileName documented | HIGH | Headers table has CamelFileName |
| 199 | CamelSplitIndex/Size documented | HIGH | Headers table has both |
| 200 | ${xpath:...} syntax | CRITICAL | Expression table has it |
| 201 | Properties persist across split | HIGH | After Splitter note confirms |
| 202 | Same protocol (SFTP) sender+receiver | MEDIUM | Same Protocol section applies |
| 203 | CSV-to-XML discoverable | MEDIUM | Step list + Less common note |
| 204 | JDBC Request-Reply | CRITICAL | Wiring Table |

## Scenario 24: Timer → OData V4 → JSON-to-XML → Multicast (SOAP + AMQP) → Gather

**Description:** Timer (hourly). SuccessFactors OData V4 (OAuth2, returns JSON). JSON-to-XML. Multicast: SOAP to S/4 (on-prem) + AMQP event. Gather. Summary via SFTP. Package: EQUATE_HRM_SFSync.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 205 | OData V4 JSON → needs converter | HIGH | OData section warns V4 returns JSON |
| 206 | SuccessFactors OAuth2 + proxyType=default | HIGH | Auth rules + OData section |
| 207 | Multicast fork + Gather join | HIGH | Multicast pattern + Preserving results Solution B |
| 208 | AMQP in Wiring Table | CRITICAL | Wiring Table |
| 209 | Timer Rules (no sender) | HIGH | Timer-Triggered Rules section |
| 210 | Hourly timer derivable | MEDIUM | Cron format documentation |

## Scenario 25: ProcessDirect → property propagation → OData query → JSON response

**Description:** PD-triggered. Parent sets employeeId property. CM builds OData $filter. Request-Reply SuccessFactors OData. CM extracts. Groovy builds JSON. Return. Package: EQUATE_HRM_Lookup.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 211 | PD exchange propagation | CRITICAL | PD rules document property passing |
| 212 | OData $filter/$select | HIGH | OData Query Parameters section |
| 213 | PD sync response | HIGH | PD rules document sync behavior |
| 214 | Groovy properties→JSON | HIGH | Groovy API documents getProperty + JsonBuilder |
| 215 | PD-Triggered Rules exist | HIGH | Dedicated section |

## Scenario 26: SOAP sync → Exception ErrorEnd → PD chain error propagation

**Description:** 3-iFlow PD chain. A (SOAP) → B (PD) → C (PD → OData on-prem). Each has exception subprocess with ErrorEnd. Errors propagate C→B→A. A returns SOAP Fault. Package: EQUATE_CHAIN_ErrorProp.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 216 | ErrorEnd (not EscalationEnd) | CRITICAL | Exception Subprocess mandates ErrorEnd |
| 217 | PD error propagation | HIGH | Exception Subprocess documents PD error chain |
| 218 | returnExceptionToSender + ErrorEnd | HIGH | Sync response pattern documents error return |
| 219 | Each iFlow exception subprocess | MEDIUM | Building blocks present for per-iFlow exception handling |
| 220 | Deploy order C→B→A | HIGH | Phase C.2 + PD chain rule |
| 221 | LIP vs main exception behavior | HIGH | Exception Subprocess documents LIP error absorption |

---

# Bonus Regression Checks (15 checks)

These verify cross-cutting concerns and internal consistency.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 222 | No "EscalationEnd" as recommended | CRITICAL | Only occurrence is in "NOT EscalationEnd" warning |
| 223 | Router is exclusiveGateway everywhere | CRITICAL | No place says Router = callActivity |
| 224 | Pre-Flight Checklist says "via Grep" for B.6 | HIGH | Not "via sub-agent" |
| 225 | Pre-Flight Checklist says "via sub-agent" for B.5 | MEDIUM | Sample zip study uses sub-agent |
| 226 | Reference Priority table says "Direct Grep lookup" | HIGH | Not "Agent tool lookup" |
| 227 | Phase D gate says "build-validated" | MEDIUM | Not just "uploaded" |
| 228 | Phase E starts with Deploy (not build validation) | HIGH | Build validation moved to Phase D step 5 |
| 229 | Phase E step numbers: Deploy=1, Verify=2, Post-deploy=3, User ask=4 | MEDIUM | Sequential numbering |
| 230 | Phase F references "Phase E step 2" | MEDIUM | Not "step 3" |
| 231 | autoDeploy restriction documented | HIGH | "Only on retry attempts 2+" |
| 232 | known-errors.md append uses table format | MEDIUM | Not ### header format |
| 233 | known-errors.md 50-entry cap | LOW | Maintenance rule documented |
| 234 | No bash date commands in Execution Tracking | MEDIUM | Platform-agnostic timing |
| 235 | Anti-Patterns reference Phase C sections | MEDIUM | Not duplicating rules |
| 236 | Metadata README.md uses Grep (not sub-agent) | HIGH | Consistent with SKILL.md |

---

---

# Test Round 6: Edge Cases & Combinations (Scenarios 27-31, 31 checks)

## Scenario 27: HTTPS → CM (5+ headers + 3 properties) → Groovy reads all → XML response

**Description:** HTTPS sync (RoleBased). CM#1: 5 headers (X-TrackingID, X-Timestamp, Content-Type, X-Source, X-Version) + 3 properties (originalBody, requestTime, sourceSystem). Groovy reads all, builds XML response. CM#2: CamelHttpResponseCode=200. Package: EQUATE_API_HeaderTest.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 237 | CM headerTable supports 5+ rows | HIGH | No documented row limit; HTML row format is extensible |
| 238 | CM propertyTable supports 3+ rows | HIGH | Same extensible row format as headerTable |
| 239 | All expression syntaxes documented | CRITICAL | Expression table covers ${header.X}, ${date:now:...}, ${in.body}, constants |
| 240 | Groovy reads multiple headers + properties | HIGH | Groovy API covers getHeader/getProperty |
| 241 | Groovy building XML (not just JSON) | MEDIUM | Groovy use cases or API sufficient for XML string building |
| 242 | CamelHttpResponseCode in headers | HIGH | Standard headers table includes it |

## Scenario 28: SFTP → PGP Decrypt → EDI-to-XML → EDI Validator → Message Mapping → IDoc

**Description:** SFTP (publickey). PGP Decrypt. EDI-to-XML (X12 850). EDI Validate. Message Mapping (in-iFlow). Request-Reply IDoc (on-prem, ClientCert). Package: EQUATE_SCM_EDI_Import.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 243 | PGP Decryptor in step list + Less common | HIGH | Listed in both locations |
| 244 | EDI-to-XML Converter in step list | MEDIUM | Listed in processing steps or discoverable via Grep |
| 245 | EDI Validator in step list | MEDIUM | Listed as EDI Splitter/Validator |
| 246 | In-iFlow Message Mapping placement | HIGH | mmap in zip under mapping/ documented |
| 247 | IDoc receiver in Wiring Table | CRITICAL | Request-Reply + serviceTask |
| 248 | ClientCert + on-premise valid | HIGH | Auth compatibility confirms |
| 249 | SFTP publickey in auth mapping | MEDIUM | publickey mapped |

## Scenario 29: Timer → 2 Sequential Request-Reply (save intermediates) → Groovy merge → SOAP

**Description:** Timer (hourly). RR#1 HTTP (OAuth2) fetch orders. CM save to property. RR#2 HTTP (Basic) fetch inventory. CM save to property. Groovy merge both. RR SOAP to S/4HANA (on-prem Basic). Package: EQUATE_ORDER_Merge.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 250 | Preserving results Solution A | CRITICAL | Save to property before each RR documented |
| 251 | Each RR replaces body | HIGH | Explicitly stated in preserving results pattern |
| 252 | Properties survive across RR | HIGH | Exchange model confirms persistence |
| 253 | Groovy reads multiple properties | HIGH | getProperty API documented |
| 254 | Timer-Triggered Rules | MEDIUM | No sender participant |
| 255 | SOAP Request-Reply never Send | CRITICAL | Wiring Table + Send restriction |

## Scenario 30: ProcessDirect chain (A→B) where B has LIP + exception subprocess

**Description:** iFlow A: HTTPS (RoleBased) → PD to iFlow B. iFlow B: PD sender, LIP-A (CM+Groovy+RR HTTP). LIP-A has exception subprocess with ErrorEnd (absorbs error). Main process continues. Package: EQUATE_CHAIN_LIPError.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 256 | LIP has own exception subprocess | CRITICAL | Documented in Exception Subprocess section |
| 257 | LIP ErrorEnd absorbs error | CRITICAL | Main process continues documented |
| 258 | PD error propagation | HIGH | Error from B → A's exception subprocess |
| 259 | LIP calls external systems | HIGH | Receiver participant in main collaboration |
| 260 | returnExceptionToSender BPMN | HIGH | Exact XML documented |
| 261 | PD-Triggered Rules exist | MEDIUM | Dedicated section |

## Scenario 31: HTTPS sync → Idempotent Process Call → Request-Reply → JMS DLQ

**Description:** HTTPS sync (RoleBased). Idempotent wraps LIP. LIP: CM + RR HTTP (OAuth2). On failure, JMS DLQ write. returnExceptionToSender. Package: EQUATE_API_Idempotent.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 262 | Idempotent Process Call pattern | HIGH | componentId, expirationDays documented |
| 263 | JMS DLQ pattern | HIGH | Dead-letter queue with naming convention |
| 264 | Sync + error handling + returnExceptionToSender | CRITICAL | ErrorEnd returns error response |
| 265 | JMS Send in Wiring Table | HIGH | Send OR Request-Reply |
| 266 | Idempotent wrapping LIP structure | MEDIUM | BPMN structure documented |
| 267 | OAuth2 for HTTP receiver | HIGH | Direction-correct per auth rules |

---

# Test Round 7: Multi-Step CM Workflows (Scenarios 32-36, 26 checks)

## Scenario 32: SOAP → CM extracts headers → Router 3 XPath conditions → 3 receivers

**Description:** SOAP sync (RoleBased). CM: property from SAP_Sender. Router: //Order/Priority HIGH→HTTP, NORMAL→SOAP (on-prem), default→422 error. returnExceptionToSender. Package: EQUATE_ORDER_PriorityRouter.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 268 | Router = exclusiveGateway | CRITICAL | Not callActivity |
| 269 | XPath conditions on sequenceFlow | HIGH | conditionExpression, not routeCondition on callActivity |
| 270 | SAP_Sender in headers table | MEDIUM | Standard SAP/Camel headers |
| 271 | Default route (otherwise) | HIGH | Documented |
| 272 | Each route ends with EndEvent | HIGH | Branches independent |
| 273 | CamelHttpResponseCode for rejection | HIGH | Settable via CM |
| 274 | Auth direction correct | CRITICAL | SOAP sender=RoleBased, HTTP receiver valid |

## Scenario 33: SFTP → CM filename → Groovy parse → Header Router → JDBC/SFTP

**Description:** SFTP (user_password). CM: CamelFileName to property. Groovy parses filename. Router on X-Type. MT940→CSV-to-XML→JDBC (on-prem), MT103→SFTP (publickey). Package: EQUATE_FIN_FileRouter.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 275 | CamelFileName documented | HIGH | Headers table |
| 276 | Groovy string parsing use case | HIGH | Listed in common use cases |
| 277 | Header-based routing | HIGH | Camel Simple expressions documented |
| 278 | CSV-to-XML discoverable | MEDIUM | Step list + Less common note |
| 279 | JDBC Request-Reply | CRITICAL | Wiring Table |
| 280 | Same protocol guidance | MEDIUM | Same Protocol section |
| 281 | SFTP directory in field 7 | HIGH | SFTP-specific note |

## Scenario 34: Timer → HTTP fetch → CM save → Poll Enrich SFTP → Groovy merge → SOAP

**Description:** Timer (30min). RR HTTP (OAuth2) fetch data. CM save body. Poll Enrich from SFTP. Groovy merge. RR SOAP (on-prem Basic). Package: EQUATE_ORDER_Enrich.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 282 | Poll Enrich pattern | HIGH | PollEnrich activityType, merge strategy |
| 283 | Poll Enrich via messageFlow | HIGH | Connects to receiver like Request-Reply |
| 284 | Poll Enrich merges vs replaces | CRITICAL | Explicitly documented as MERGE not REPLACE |
| 285 | Groovy merge property + body | HIGH | API covers both |
| 286 | Timer + intermediate calls | MEDIUM | Patterns combinable |

## Scenario 35: HTTPS → Filter (throwException=true) → error response → OData success

**Description:** HTTPS sync (RoleBased). Filter: XPath check. throwExceptionOnFilterFailure=true. Reject→exception→ErrorEnd→400 response. Pass→RR OData V4 (OAuth2)→JSON-to-XML→return 200. Package: EQUATE_API_FilterTest.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 287 | throwExceptionOnFilterFailure | HIGH | Documented in Filter pattern |
| 288 | Filter rejection triggers exception | HIGH | Returns error response in sync flow |
| 289 | OData V4 JSON needs converter | HIGH | Documented in OData section |
| 290 | ErrorEnd returns error in sync | CRITICAL | Documented in Exception Subprocess |
| 291 | Filter as standard palette step | MEDIUM | In step list |
| 292 | OAuth2 + proxyType=default | HIGH | Auth rules |

## Scenario 36: ProcessDirect → 4 caller properties → OData $filter → Groovy JSON

**Description:** PD-triggered. Parent sets employeeId, companyCode, startDate, endDate. CM builds $filter. RR SuccessFactors OData (OAuth2). Groovy builds JSON. Return. Package: EQUATE_HRM_Lookup.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 293 | PD propagation — 4 properties | CRITICAL | Exchange propagation documented |
| 294 | OData $filter complex expression | HIGH | queryOptions documented |
| 295 | Groovy reads 4+ properties → JSON | HIGH | API covers getProperty + JsonBuilder |
| 296 | PD sync response | HIGH | Body at EndEvent = response |
| 297 | Content-Type before return | MEDIUM | Settable via CM |

---

# Test Round 8: Complex Multi-Artifact & Error Handling (Scenarios 37-41, 32 checks)

## Scenario 37: 3-iFlow JMS Pipeline (SFTP→JMS→JMS→SFTP)

**Description:** 3-iFlow chain via 2 JMS queues. iFlow 1: SFTP→JMS. iFlow 2: JMS→process→JMS. iFlow 3: JMS→SFTP. Shared queue names externalized. Package: EQUATE_FIN_JMSPipeline.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 298 | JMS decoupling covers multi-queue | HIGH | 2-queue pattern composable |
| 299 | JMS deploy order flexible | HIGH | Queue buffers documented |
| 300 | JMS sender auth N/A | MEDIUM | Documented |
| 301 | JMS queue externalization | HIGH | {{queueName}} pattern |
| 302 | JMS Send in Wiring Table | CRITICAL | Listed |
| 303 | JMS MULTI_ARTIFACT | MEDIUM | JMS dependency type |
| 304 | 3-iFlow D-E execution | HIGH | Sequential per artifact |

## Scenario 38: HTTPS → Multicast 3 branches → Gather → combined sync response

**Description:** HTTPS sync (RoleBased). Multicast: HTTP(OAuth2) + SOAP(on-prem) + AMQP. Gather. Groovy merge. Return combined JSON. returnExceptionToSender. Package: EQUATE_ORDER_MultiBranch.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 305 | Multicast = parallelGateway | CRITICAL | Documented |
| 306 | Gather = parallelGateway join | HIGH | Documented |
| 307 | Solution B (Multicast+Gather) | HIGH | Documented |
| 308 | Gather output format | HIGH | Last branch body + save to properties pattern documented |
| 309 | 3 receiver types in Wiring Table | MEDIUM | HTTP, SOAP, AMQP all listed |
| 310 | returnExceptionToSender BPMN | HIGH | Documented |
| 311 | Sync response after Gather | CRITICAL | EndEvent body = response after Gather |

## Scenario 39: Timer → Splitter → Looping (retry 3x) → Terminate on final fail

**Description:** Timer. HTTP fetch. Splitter. Looping Process Call (maxIterations=3). On exhaustion → Terminate. Package: EQUATE_ORDER_RetryTerminate.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 312 | Looping maxIterations=3 | HIGH | Documented |
| 313 | Terminate End Event | HIGH | Kills entire iFlow |
| 314 | Terminate behavior | CRITICAL | Stops all branches/records |
| 315 | Splitter + Looping per record | HIGH | Post-Splitter behavior |
| 316 | Timer + Splitter → A9 | MEDIUM | Archetype heuristic |
| 317 | Loop exhaustion detection | HIGH | Property-based detection + Router documented |

## Scenario 40: IDoc → Groovy validation → Router (SOAP/Mail) → exception

**Description:** IDoc (on-prem ClientCert). Groovy validates. Router: valid→SOAP, invalid→Mail notification. ErrorEnd exception handling. Package: EQUATE_MDM_IDocRouter.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 318 | IDoc + ClientCert + on-premise | HIGH | IDoc/XI Rules + auth compatibility |
| 319 | SapIDocType header | MEDIUM | Mentioned in IDoc Rules section |
| 320 | Mail in Wiring Table | HIGH | Listed |
| 321 | Router = exclusiveGateway | CRITICAL | Documented |
| 322 | IDoc/XI-Triggered Rules | HIGH | Dedicated section |
| 323 | ErrorEnd in exception subprocess | MEDIUM | Mandated |

## Scenario 41: 2-Artifact: External Mapping + iFlow

**Description:** Standalone MM_PO_to_IDoc.mmap + iFlow referencing via mappingSrcExternal + Require-Capability. Deploy mapping first. Package: EQUATE_SCM_ExtMapping.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 324 | scaffold-message-mapping tool | HIGH | Listed in available tools |
| 325 | mappingSrcExternal + Require-Capability | HIGH | Documented in Mapping Placement |
| 326 | C.1b: mapping first | HIGH | Generation order |
| 327 | C.2: deploy mapping before iFlow | HIGH | Deploy order |
| 328 | MULTI_ARTIFACT with mapping | HIGH | Output format supports |
| 329 | Sequential D-E per artifact | MEDIUM | Documented |

---

# Test Round 9: Realistic Enterprise Patterns (Scenarios 42-46, 39 checks)

## Scenario 42: SFTP bank CSV → CSV-to-XML → Splitter → JDBC → Groovy → SOAP → Data Store

**Description:** SFTP (user_password). CSV-to-XML. Splitter. Per-record: JDBC lookup (on-prem), Groovy enrich, SOAP post (on-prem), Data Store audit. LIP per-record error handling. Package: EQUATE_FIN_BankImport.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 330 | CSV-to-XML → Splitter pipeline | HIGH | Steps in list, per-record behavior |
| 331 | JDBC Request-Reply | CRITICAL | Wiring Table |
| 332 | Data Store Write callActivity | HIGH | Not adapter-based |
| 333 | Partial failure per record | HIGH | Splitter + LIP + ErrorEnd |
| 334 | Properties persist across split | HIGH | Exchange model |
| 335 | SFTP directory in field 7 | MEDIUM | Documented |
| 336 | Groovy enrichment pattern | HIGH | API covers body + property access |

## Scenario 43: HTTPS webhook → XML Validator → Multicast (OData+Kafka+DataStore) → sync 200

**Description:** HTTPS sync (RoleBased). XML Validate. Multicast: OData (on-prem Basic) + Kafka (SASL) + Data Store Write. Main branch last (returns 200). returnExceptionToSender. Package: EQUATE_WEBHOOK_MultiTarget.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 337 | Multicast main branch LAST | CRITICAL | Branch ordering documented |
| 338 | Data Store in multicast branch | HIGH | callActivity, no receiver participant |
| 339 | No Gather — independent branches | HIGH | Documented |
| 340 | Kafka SASL auth | HIGH | Auth table |
| 341 | XML Validator in step list | MEDIUM | Listed |
| 342 | returnExceptionToSender + 200 | HIGH | Combined pattern |
| 343 | OData on-prem + Basic valid | CRITICAL | Auth compatibility |

## Scenario 44: Timer → SuccessFactors OData V4 → JSON-to-XML → XSLT → SFTP → Persist

**Description:** Timer (daily). SuccessFactors OData V4 (OAuth2, JSON). JSON-to-XML. XSLT transform. SFTP Send (publickey). Persist Message. Package: EQUATE_HRM_SFExport.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 344 | OData V4 JSON → converter needed | HIGH | Documented |
| 345 | XSLT 3rd priority | HIGH | Step Implementation Preferences |
| 346 | XSLT in mapping/ folder | HIGH | Zip structure |
| 347 | Persist Message pattern | HIGH | callActivity for audit |
| 348 | SFTP Send fire-and-forget | MEDIUM | Wiring Table |
| 349 | SuccessFactors OAuth2 | MEDIUM | Auth rules |
| 350 | Timer Rules | MEDIUM | No sender |

## Scenario 45: SOAP sync → 3 enrichments → save each → Groovy merge → return

**Description:** SOAP sync (RoleBased). Save body. RR#1 HTTP (OAuth2). Save. Restore. RR#2 OData V2 (on-prem Basic). Save. Restore. RR#3 RFC (on-prem Basic). Save. Groovy merge 4 properties. Return XML. returnExceptionToSender. Package: EQUATE_ORDER_TripleEnrich.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 351 | Solution A with 3 saves + restores | CRITICAL | Documented |
| 352 | bodyType=expression restore | CRITICAL | CM config documented |
| 353 | Properties across 3 RRs | HIGH | Exchange model |
| 354 | Groovy reads 4 properties | HIGH | API documented |
| 355 | RFC Request-Reply | CRITICAL | Wiring Table |
| 356 | OData V2 returns XML | HIGH | No converter needed |
| 357 | 11 steps — large iFlow guidance | MEDIUM | 12+ threshold, 3+ receivers |
| 358 | returnExceptionToSender BPMN | HIGH | XML placement |

## Scenario 46: ProcessDirect → XML Digital Sig → PKCS7 → AS2 Send → return status

**Description:** PD-triggered. XML Digital Signer (keyAlias). PKCS7 encrypt (certAlias). AS2 Send (Basic). CM: status JSON. Return. Package: EQUATE_B2B_SecureSend.

| # | Checkpoint | Severity | Pass Criteria |
|---|-----------|----------|---------------|
| 359 | XML Digital Signer pattern | HIGH | keyAlias externalized |
| 360 | PKCS7 in Less common note | MEDIUM | Listed |
| 361 | AS2 Send in Wiring Table | CRITICAL | Listed |
| 362 | PD sync response | HIGH | Body at EndEvent |
| 363 | PD-Triggered Rules | HIGH | Address, sync, auth |
| 364 | Externalize keyAlias + certAlias | MEDIUM | General externalization guidance |

---

# Scoring Summary Template

After running all checks, fill in:

```
CI-DEVELOPER SKILL TEST RESULTS
================================
Date: {date}
SKILL.md version: {line count} lines
Tester: {who ran it}

Round 1 (Scenarios 1-6):   __/64  checkpoints passed
Round 2 (Scenarios 7-11):  __/57  checkpoints passed
Round 3 (Scenarios 12-16): __/38  checkpoints passed
Round 4 (Scenarios 17-21): __/38  checkpoints passed
Round 5 (Scenarios 22-26): __/24  checkpoints passed
Round 6 (Scenarios 27-31): __/31  checkpoints passed
Round 7 (Scenarios 32-36): __/26  checkpoints passed
Round 8 (Scenarios 37-41): __/32  checkpoints passed
Round 9 (Scenarios 42-46): __/39  checkpoints passed
Bonus Regression:          __/15  checkpoints passed
─────────────────────────────────────────────────────
TOTAL:                     __/364 checkpoints passed

Pass Rate: __%

CRITICAL failures: __ (list checkpoint #s)
HIGH failures:     __ (list checkpoint #s)
MEDIUM failures:   __ (list checkpoint #s)
LOW failures:      __ (list checkpoint #s)

Action Required:
- [ ] Fix all CRITICAL failures before using skill
- [ ] Fix HIGH failures before next deployment
- [ ] Review MEDIUM failures for impact
- [ ] LOW failures are optional improvements
```
