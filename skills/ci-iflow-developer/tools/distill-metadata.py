#!/usr/bin/env python3
"""
distill-metadata.py  —  Merge raw UI metadata with identity JSONs into
per-adapter and per-step distilled files for the ci-developer skill.

Usage:
  python distill-metadata.py [--input PATH] [--output PATH]

Defaults:
  --input   ../../references/metadata           (relative to this script)
  --output  ../../references/metadata           (same dir — writes adapters/ and steps/ subdirs)
"""

import json
import os
import re
import sys
import argparse
from pathlib import Path

# ---------------------------------------------------------------------------
# UI-only fields to strip from every property row
# ---------------------------------------------------------------------------
STRIP_FIELDS = {
    "isAutoGenerate", "length", "multilineRows", "isPassword", "isReadOnly",
    "isMultiInput", "isVisible", "isReorderable", "isModifiable", "isDraggable",
    "isSorted", "sortingOrder", "attributeBehaviors", "regexConstraint",
    "message", "helpService", "childSectionTO", "tooltip",
    "technicalCapabilities", "modelInfoTO", "helpUrl", "schedulerConfig",
    "schedulerKeyDefaultValue",
}

# Fields to keep on rows (everything not in STRIP_FIELDS and not ui-only)
KEEP_ROW_FIELDS = {"key", "label", "dataType", "isMandatory", "isExternalizable",
                   "defaultValue", "comboMetadata", "condition"}

# ---------------------------------------------------------------------------
# Mapping: raw filename stem  →  adapter name (to match identity JSON)
# ---------------------------------------------------------------------------
SENDER_FILE_TO_NAME = {
    "s_advanced_event_mesh":   "AdvancedEventMesh",
    "s_amqp_tcp":              "AMQP",
    "s_amqp_websocket":        "AMQP",
    "s_as2":                   "AS2",
    "s_as2_mdn":               "AS2",
    "s_datastore":             "DataStoreConsumer",
    "s_ftp":                   "FTP",
    "s_ftp_poll_enrich":       "PollingFTP",
    "s_https":                 "HTTPS",
    "s_ibm_mq_jmspoll":       "IBMMQ",
    "s_ibm_mq_jmssubscribe":  "IBMMQ",
    "s_ibm_mq_rest":          "IBMMQ",
    "s_idoc":                  "IDOC",
    "s_jms":                   "JMS",
    "s_kafka":                 "Kafka",
    "s_mail_imap4":            "Mail",
    "s_mail_pop3":             "Mail",
    "s_odata_v2":              "ODataSender",
    "s_processdirect":         "ProcessDirect",
    "s_sftp":                  "SFTP",
    "s_sftp_poll_enrich":      "PollingSFTP",
    "s_smb":                   "SMB",
    "s_soap_1x":               "SOAP",
    "s_soap_rm":               "SOAP",
    "s_successfactors_rest":   "SuccessFactors",
    "s_successfactors_soap":   "SuccessFactors",
    "s_xi":                    "XI",
}

RECEIVER_FILE_TO_NAME = {
    "r_advanced_event_mesh":       "AdvancedEventMesh",
    "r_amqp_tcp":                  "AMQP",
    "r_amqp_websocket":            "AMQP",
    "r_as2":                       "AS2",
    "r_ftp":                       "FTP",
    "r_http":                      "HTTP",
    "r_ibmmq_https":               "IBMMQ",
    "r_ibmmq_jms":                 "IBMMQ",
    "r_idoc":                      "IDOC",
    "r_jdbc":                      "JDBC",
    "r_jms":                       "JMS",
    "r_kafka":                     "Kafka",
    "r_ldap":                      "LDAP",
    "r_mail":                      "Mail",
    "r_odata_v2":                  "OData",
    "r_odata_v4":                  "OData",
    "r_processdirect":             "ProcessDirect",
    "r_rfc":                       "RFC",
    "r_sftp":                      "SFTP",
    "r_smb":                       "SMB",
    "r_soap_1x":                   "SOAP",
    "r_soap_rm":                   "SOAP",
    "r_successfactors_odata_v2":   "SuccessFactors",
    "r_successfactors_odata_v4":   "SuccessFactors",
    "r_successfactors_rest":       "SuccessFactors",
    "r_successfactors_soap":       "SuccessFactors",
    "r_xi":                        "XI",
}

# Mapping: raw filename stem  →  output file name (in adapters/)
SENDER_FILE_TO_OUTPUT = {
    "s_advanced_event_mesh":   "advanced_event_mesh_sender",
    "s_amqp_tcp":              "amqp_tcp_sender",
    "s_amqp_websocket":        "amqp_websocket_sender",
    "s_as2":                   "as2_sender",
    "s_as2_mdn":               "as2_mdn_sender",
    "s_datastore":             "datastore_consumer_sender",
    "s_ftp":                   "ftp_sender",
    "s_ftp_poll_enrich":       "ftp_poll_enrich_sender",
    "s_https":                 "https_sender",
    "s_ibm_mq_jmspoll":       "ibmmq_jmspoll_sender",
    "s_ibm_mq_jmssubscribe":  "ibmmq_jmssubscribe_sender",
    "s_ibm_mq_rest":          "ibmmq_rest_sender",
    "s_idoc":                  "idoc_sender",
    "s_jms":                   "jms_sender",
    "s_kafka":                 "kafka_sender",
    "s_mail_imap4":            "mail_imap4_sender",
    "s_mail_pop3":             "mail_pop3_sender",
    "s_odata_v2":              "odata_sender",
    "s_processdirect":         "processdirect_sender",
    "s_sftp":                  "sftp_sender",
    "s_sftp_poll_enrich":      "sftp_poll_enrich_sender",
    "s_smb":                   "smb_sender",
    "s_soap_1x":               "soap_1x_sender",
    "s_soap_rm":               "soap_rm_sender",
    "s_successfactors_rest":   "successfactors_rest_sender",
    "s_successfactors_soap":   "successfactors_soap_sender",
    "s_xi":                    "xi_sender",
}

RECEIVER_FILE_TO_OUTPUT = {
    "r_advanced_event_mesh":       "advanced_event_mesh_receiver",
    "r_amqp_tcp":                  "amqp_tcp_receiver",
    "r_amqp_websocket":            "amqp_websocket_receiver",
    "r_as2":                       "as2_receiver",
    "r_ftp":                       "ftp_receiver",
    "r_http":                      "http_receiver",
    "r_ibmmq_https":               "ibmmq_https_receiver",
    "r_ibmmq_jms":                 "ibmmq_jms_receiver",
    "r_idoc":                      "idoc_receiver",
    "r_jdbc":                      "jdbc_receiver",
    "r_jms":                       "jms_receiver",
    "r_kafka":                     "kafka_receiver",
    "r_ldap":                      "ldap_receiver",
    "r_mail":                      "mail_receiver",
    "r_odata_v2":                  "odata_v2_receiver",
    "r_odata_v4":                  "odata_v4_receiver",
    "r_processdirect":             "processdirect_receiver",
    "r_rfc":                       "rfc_receiver",
    "r_sftp":                      "sftp_receiver",
    "r_smb":                       "smb_receiver",
    "r_soap_1x":                   "soap_1x_receiver",
    "r_soap_rm":                   "soap_rm_receiver",
    "r_successfactors_odata_v2":   "successfactors_odatav2_receiver",
    "r_successfactors_odata_v4":   "successfactors_odatav4_receiver",
    "r_successfactors_rest":       "successfactors_rest_receiver",
    "r_successfactors_soap":       "successfactors_soap_receiver",
    "r_xi":                        "xi_receiver",
}

# Mapping: pallet_functions subpath  →  output step file name
STEP_FILE_TO_OUTPUT = {
    "call/content_enricher":            "content_enricher",
    "call/idempotent_process_call":     "idempotent_process_call",
    "call/looping_process_call":        "looping_process_call",
    "call/poll_enrich":                 "poll_enrich",
    "call/process_call":                "process_call",
    "call/request_reply":               "request_reply",
    "call/send":                        "send",
    "events/end_event":                 "end_event",
    "events/end_message":               "end_message",
    "events/error_end_event":           "error_end_event",
    "events/error_start_event":         "error_start_event",
    "events/escalation_end_event":      "escalation_end_event",
    "events/start_event":               "start_event",
    "events/start_message":             "start_message",
    "events/terminate_message":         "terminate_message",
    "events/timer_start":               "timer_start",
    "mapping/id_mapping":               "id_mapping",
    "mapping/message_mapping":          "message_mapping",
    "mapping/operation_mapping":        "operation_mapping",
    "mapping/xslt_mapping":             "xslt_mapping",
    "persistence/data_store_delete":    "data_store_delete",
    "persistence/data_store_get":       "data_store_get",
    "persistence/data_store_select":    "data_store_select",
    "persistence/data_store_write":     "data_store_write",
    "persistence/persist_message":      "persist_message",
    "persistence/write_variables":      "write_variables",
    "process/exception_subprocess":     "exception_subprocess",
    "process/integration_flow":         "integration_flow",
    "process/integration_process":      "integration_process",
    "process/local_integration_process":"local_integration_process",
    "routing/aggregator":               "aggregator",
    "routing/edi_splitter":             "edi_splitter",
    "routing/gather":                   "gather",
    "routing/idoc_splitter":            "idoc_splitter",
    "routing/iterating_splitter":       "iterating_splitter",
    "routing/join":                     "join",
    "routing/parallel_multicast":       "parallel_multicast",
    "routing/pkcs7_cms_splitter":       "pkcs7_cms_splitter",
    "routing/router":                   "router",
    "routing/sequential_multicast":     "sequential_multicast",
    "routing/tar_splitter":             "tar_splitter",
    "routing/zip_splitter":             "zip_splitter",
    "security/pgp_decryptor":           "pgp_decryptor",
    "security/pgp_encryptor":           "pgp_encryptor",
    "security/pkcs7_cms_decryptor":     "pkcs7_cms_decryptor",
    "security/pkcs7_cms_encryptor":     "pkcs7_cms_encryptor",
    "security/pkcs7_cms_signer":        "pkcs7_cms_signer",
    "security/pkcs_signature_verifier": "pkcs_signature_verifier",
    "security/simple_signer":           "simple_signer",
    "security/xml_signature_verifier":  "xml_signature_verifier",
    "security/xml_signer":              "xml_signer",
    "transformations/base64_decode":    "base64_decode",
    "transformations/base64_decoder":   "base64_decoder",
    "transformations/content_modifier": "content_modifier",
    "transformations/csv_to_xml_converter": "csv_to_xml_converter",
    "transformations/edi_extractor":    "edi_extractor",
    "transformations/edi_to_xml_converter": "edi_to_xml_converter",
    "transformations/filter":           "filter",
    "transformations/groovy_script":    "groovy_script",
    "transformations/gzip_compress":    "gzip_compress",
    "transformations/gzip_decompress":  "gzip_decompress",
    "transformations/java_script":      "java_script",
    "transformations/json_to_xml_converter": "json_to_xml_converter",
    "transformations/message_digest":   "message_digest",
    "transformations/mime_multipart_decoder": "mime_multipart_decoder",
    "transformations/mime_multipart_encoder": "mime_multipart_encoder",
    "transformations/xml_modifier":     "xml_modifier",
    "transformations/xml_to_csv_converter": "xml_to_csv_converter",
    "transformations/xml_to_edi_converter": "xml_to_edi_converter",
    "transformations/xml_to_json_converter": "xml_to_json_converter",
    "transformations/zip_compress":     "zip_compress",
    "transformations/zip_decompress":   "zip_decompress",
    "validator/edi_validator":          "edi_validator",
    "validator/xml_validator":          "xml_validator",
    "routing/general_splitter":         "general_splitter",
}

# ---------------------------------------------------------------------------
# Helper: strip a property row down to only Claude-relevant fields
# ---------------------------------------------------------------------------
def distill_row(row: dict) -> dict:
    out = {}
    for field in KEEP_ROW_FIELDS:
        if field in row:
            val = row[field]
            # Skip empty lists and None
            if val is None:
                continue
            if isinstance(val, list) and len(val) == 0:
                continue
            # For comboMetadata: extract just key/label pairs
            if field == "comboMetadata" and isinstance(val, list):
                simplified = [{"key": c["key"], "label": c.get("label", c["key"])}
                              for c in val if c.get("key")]
                if simplified:
                    out["values"] = simplified
                continue
            # For dataType: skip xsd:string (default, not informative)
            if field == "dataType" and val == "xsd:string":
                continue
            # For condition: simplify to just key + valueList
            if field == "condition" and isinstance(val, dict):
                ctype = val.get("conditionType", "")
                if ctype == "BasicCondition":
                    out["when"] = f"{val.get('key')} in {val.get('valueList', [])}"
                elif ctype == "NotCondition":
                    subs = val.get("complexSubConditions", [])
                    if subs:
                        sub = subs[0]
                        out["when"] = f"NOT ({sub.get('key')} in {sub.get('valueList', [])})"
                elif ctype == "OrCondition":
                    subs = val.get("complexSubConditions", [])
                    parts = []
                    for sub in subs:
                        parts.append(f"{sub.get('key')} in {sub.get('valueList', [])}")
                    out["when"] = " OR ".join(parts)
                continue
            # Rename isMandatory → mandatory, isExternalizable → externalizable
            if field == "isMandatory":
                if val:
                    out["mandatory"] = True
                continue
            if field == "isExternalizable":
                if val:
                    out["externalizable"] = True
                continue
            out[field] = val
    return out


def distill_columns(columns: list) -> list:
    """Distill columnsMetadata for table-type fields."""
    result = []
    for col in columns:
        c = {}
        c["key"] = col.get("key", "")
        c["label"] = col.get("label", "")
        if col.get("isMandatory"):
            c["mandatory"] = True
        if col.get("defaultValue"):
            c["default"] = col["defaultValue"]
        combo = col.get("comboMetadata", [])
        if combo:
            c["values"] = [{"key": m["key"], "label": m.get("label", m["key"])}
                           for m in combo if m.get("key") and m.get("isEnabled", True)]
        if c.get("key"):
            result.append(c)
    return result


def extract_properties(ui_data: dict) -> list:
    """Extract all property rows from navigationTabs, flattening sections."""
    rows = []
    seen_keys = set()
    for tab in ui_data.get("navigationTabs", []):
        for section in tab.get("sections", []):
            for row in section.get("rows", []):
                key = row.get("key", "")
                if not key or key in seen_keys:
                    continue
                seen_keys.add(key)
                distilled = distill_row(row)
                # Handle columnsMetadata for table types
                if row.get("columnsMetadata"):
                    distilled["columns"] = distill_columns(row["columnsMetadata"])
                if distilled.get("key"):
                    rows.append(distilled)
    return rows


# ---------------------------------------------------------------------------
# Load identity data
# ---------------------------------------------------------------------------
def load_identity(metadata_dir: Path):
    sa_path = metadata_dir / "sender_adapters.json"
    ra_path = metadata_dir / "receiver_adapters.json"
    fs_path = metadata_dir / "flow_step_shapes.json"

    sender_identity = {}   # name → list of variants
    receiver_identity = {} # name → list of variants
    step_shapes = {}       # cmdURI → shape entry

    if sa_path.exists():
        with open(sa_path, encoding="utf-8", errors="replace") as f:
            data = json.load(f)
        for item in data:
            name = item["name"]
            sender_identity[name] = item.get("variants", [])

    if ra_path.exists():
        with open(ra_path, encoding="utf-8", errors="replace") as f:
            data = json.load(f)
        for item in data:
            name = item["name"]
            receiver_identity[name] = item.get("variants", [])

    if fs_path.exists():
        with open(fs_path, encoding="utf-8", errors="replace") as f:
            step_shapes = json.load(f)

    return sender_identity, receiver_identity, step_shapes


# ---------------------------------------------------------------------------
# Process adapter files
# ---------------------------------------------------------------------------
def process_adapter(ui_file: Path, direction: str,
                    adapter_name: str, output_name: str,
                    identity_map: dict, output_dir: Path):
    with open(ui_file, encoding="utf-8", errors="replace") as f:
        ui_data = json.load(f)

    properties = extract_properties(ui_data)

    # Get identity (variants) for this adapter name
    variants = identity_map.get(adapter_name, [])

    # Build output
    out = {
        "name": adapter_name,
        "direction": direction,
    }

    if variants:
        if len(variants) == 1:
            v = variants[0]
            out["adapterVariantURI"] = v.get("adapterVariantURI", "")
            out["componentVersion"] = v.get("componentVersion", "")
            out["messageProtocol"] = v.get("messageProtocol", "")
            out["transportProtocol"] = v.get("transportProtocol", "")
        else:
            # Multiple variants — store the one whose transportProtocol/messageProtocol
            # best matches the filename hint
            fname_lower = output_name.lower()
            chosen = variants[0]
            for v in variants:
                mp = v.get("messageProtocol", "").lower()
                tp = v.get("transportProtocol", "").lower()
                if any(hint in fname_lower for hint in [mp.replace(" ", ""), tp, mp.replace(".", "")]):
                    chosen = v
                    break
            out["adapterVariantURI"] = chosen.get("adapterVariantURI", "")
            out["componentVersion"] = chosen.get("componentVersion", "")
            out["messageProtocol"] = chosen.get("messageProtocol", "")
            out["transportProtocol"] = chosen.get("transportProtocol", "")
            out["allVariants"] = [
                {
                    "adapterVariantURI": v.get("adapterVariantURI", ""),
                    "messageProtocol": v.get("messageProtocol", ""),
                    "transportProtocol": v.get("transportProtocol", ""),
                    "componentVersion": v.get("componentVersion", ""),
                }
                for v in variants
            ]

    out["properties"] = properties

    out_file = output_dir / f"{output_name}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    return out_file


# ---------------------------------------------------------------------------
# Process step / pallet function files
# ---------------------------------------------------------------------------
def process_step(ui_file: Path, output_name: str,
                 step_shapes: dict, output_dir: Path):
    with open(ui_file, encoding="utf-8", errors="replace") as f:
        ui_data = json.load(f)

    properties = extract_properties(ui_data)

    # Find matching shape entry by guessing from filename
    # step_shapes is keyed by "DEFAULT_FLOWSTEP_{parentFlavor}_{flavor}"
    # We match by looking for the output_name stem in shape name/flavor
    name_stem = output_name.replace("_", " ").lower()
    matched_shape = None
    for shape_key, shape in step_shapes.items():
        shape_name = shape.get("name", "").lower()
        shape_flavor = shape.get("flavor", "").lower()
        if shape_name == name_stem or shape_flavor == name_stem:
            matched_shape = shape
            break
    # Fuzzy match fallback
    if not matched_shape:
        for shape_key, shape in step_shapes.items():
            shape_name = shape.get("name", "").lower()
            if all(word in shape_name for word in name_stem.split() if len(word) > 3):
                matched_shape = shape
                break

    out = {}
    if matched_shape:
        out["name"] = matched_shape.get("name", output_name.replace("_", " ").title())
        out["flavor"] = matched_shape.get("flavor", "")
        out["seedId"] = matched_shape.get("seedId", "")
        out["cmdVariantUri"] = matched_shape.get("cmdURI", "")
        out["componentVersion"] = matched_shape.get("version", "")
        bpmn_el = matched_shape.get("seedId", "CallActivity_")
        if "EndEvent_" in bpmn_el:
            out["bpmnElement"] = "endEvent"
        elif "StartEvent_" in bpmn_el:
            out["bpmnElement"] = "startEvent"
        elif "Gateway_" in bpmn_el:
            out["bpmnElement"] = "exclusiveGateway"
        elif "SubProcess_" in bpmn_el:
            out["bpmnElement"] = "subProcess"
        elif "ServiceTask_" in bpmn_el:
            out["bpmnElement"] = "serviceTask"
        else:
            out["bpmnElement"] = "callActivity"
    else:
        out["name"] = output_name.replace("_", " ").title()
        out["flavor"] = ""
        out["seedId"] = "CallActivity_"
        out["cmdVariantUri"] = ""
        out["bpmnElement"] = "callActivity"

    out["properties"] = properties

    out_file = output_dir / f"{output_name}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    return out_file


# ---------------------------------------------------------------------------
# Generate adapter-uri-cheatsheet.md (Change 10)
# ---------------------------------------------------------------------------
def generate_cheatsheet(adapters_dir: Path, steps_dir: Path, output_dir: Path):
    lines = ["# cmdVariantUri Quick Reference\n",
             "_Auto-generated by distill-metadata.py. Check cheat sheet first before reading full metadata files._\n\n"]

    # Sender adapters
    lines.append("## Sender Adapters\n\n")
    lines.append("| Adapter | adapterVariantURI | Protocol |\n")
    lines.append("|---------|------------------|----------|\n")

    # Priority order for cheat sheet
    priority_senders = [
        "https_sender", "sftp_sender", "sftp_poll_enrich_sender",
        "soap_1x_sender", "processdirect_sender", "jms_sender",
        "idoc_sender", "mail_imap4_sender", "mail_pop3_sender",
        "odata_sender", "ftp_sender", "as2_sender",
        "amqp_tcp_sender", "amqp_websocket_sender", "kafka_sender",
        "xi_sender", "successfactors_rest_sender", "successfactors_soap_sender",
        "datastore_consumer_sender",
    ]

    seen = set()
    for stem in priority_senders:
        fp = adapters_dir / f"{stem}.json"
        if fp.exists():
            with open(fp, encoding="utf-8") as f:
                d = json.load(f)
            uri = d.get("adapterVariantURI", "")
            mp = d.get("messageProtocol", "")
            tp = d.get("transportProtocol", "")
            display = d.get("name", stem)
            if uri and uri not in seen:
                seen.add(uri)
                lines.append(f"| {display} ({stem.replace('_sender','')}) | `{uri}` | {tp}/{mp} |\n")

    # Add remaining senders not in priority list
    for fp in sorted(adapters_dir.glob("*_sender.json")):
        stem = fp.stem
        if stem not in priority_senders:
            with open(fp, encoding="utf-8") as f:
                d = json.load(f)
            uri = d.get("adapterVariantURI", "")
            mp = d.get("messageProtocol", "")
            tp = d.get("transportProtocol", "")
            display = d.get("name", stem)
            if uri and uri not in seen:
                seen.add(uri)
                lines.append(f"| {display} | `{uri}` | {tp}/{mp} |\n")

    lines.append("\n")

    # Receiver adapters
    lines.append("## Receiver Adapters\n\n")
    lines.append("| Adapter | adapterVariantURI | Protocol |\n")
    lines.append("|---------|------------------|----------|\n")

    priority_receivers = [
        "http_receiver", "sftp_receiver", "soap_1x_receiver",
        "processdirect_receiver", "jms_receiver", "odata_v2_receiver",
        "odata_v4_receiver", "idoc_receiver", "mail_receiver",
        "jdbc_receiver", "rfc_receiver", "ftp_receiver",
        "as2_receiver", "amqp_tcp_receiver", "amqp_websocket_receiver",
        "kafka_receiver", "ldap_receiver", "xi_receiver",
        "successfactors_rest_receiver", "successfactors_soap_receiver",
        "successfactors_odatav2_receiver", "successfactors_odatav4_receiver",
    ]

    seen2 = set()
    for stem in priority_receivers:
        fp = adapters_dir / f"{stem}.json"
        if fp.exists():
            with open(fp, encoding="utf-8") as f:
                d = json.load(f)
            uri = d.get("adapterVariantURI", "")
            mp = d.get("messageProtocol", "")
            tp = d.get("transportProtocol", "")
            display = d.get("name", stem)
            if uri and uri not in seen2:
                seen2.add(uri)
                lines.append(f"| {display} ({stem.replace('_receiver','')}) | `{uri}` | {tp}/{mp} |\n")

    for fp in sorted(adapters_dir.glob("*_receiver.json")):
        stem = fp.stem
        if stem not in priority_receivers:
            with open(fp, encoding="utf-8") as f:
                d = json.load(f)
            uri = d.get("adapterVariantURI", "")
            mp = d.get("messageProtocol", "")
            tp = d.get("transportProtocol", "")
            display = d.get("name", stem)
            if uri and uri not in seen2:
                seen2.add(uri)
                lines.append(f"| {display} | `{uri}` | {tp}/{mp} |\n")

    lines.append("\n")

    # Flow steps
    lines.append("## Flow Steps\n\n")
    lines.append("| Step | cmdVariantUri | BPMN Element | seedId |\n")
    lines.append("|------|--------------|--------------|--------|\n")

    priority_steps = [
        "content_modifier", "groovy_script", "java_script",
        "request_reply", "send", "content_enricher",
        "process_call", "router", "parallel_multicast", "sequential_multicast",
        "general_splitter", "iterating_splitter", "aggregator", "gather", "join",
        "message_mapping", "xslt_mapping", "operation_mapping",
        "data_store_write", "data_store_get", "data_store_select", "data_store_delete",
        "write_variables", "persist_message",
        "filter", "xml_modifier", "json_to_xml_converter", "xml_to_json_converter",
        "csv_to_xml_converter", "xml_to_csv_converter",
        "looping_process_call", "idempotent_process_call", "poll_enrich",
        "start_event", "end_event", "error_end_event", "error_start_event",
        "escalation_end_event", "timer_start",
        "exception_subprocess", "integration_process", "local_integration_process",
    ]

    seen3 = set()
    for stem in priority_steps:
        fp = steps_dir / f"{stem}.json"
        if fp.exists():
            with open(fp, encoding="utf-8") as f:
                d = json.load(f)
            uri = d.get("cmdVariantUri", "")
            bpmn = d.get("bpmnElement", "callActivity")
            seed = d.get("seedId", "")
            display = d.get("name", stem.replace("_", " ").title())
            if uri not in seen3:
                seen3.add(uri)
                lines.append(f"| {display} | `{uri}` | {bpmn} | {seed} |\n")

    for fp in sorted(steps_dir.glob("*.json")):
        stem = fp.stem
        if stem not in priority_steps:
            with open(fp, encoding="utf-8") as f:
                d = json.load(f)
            uri = d.get("cmdVariantUri", "")
            bpmn = d.get("bpmnElement", "callActivity")
            seed = d.get("seedId", "")
            display = d.get("name", stem.replace("_", " ").title())
            if uri not in seen3:
                seen3.add(uri)
                lines.append(f"| {display} | `{uri}` | {bpmn} | {seed} |\n")

    cheatsheet_path = output_dir / "adapter-uri-cheatsheet.md"
    with open(cheatsheet_path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    return cheatsheet_path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    script_dir = Path(__file__).parent
    default_metadata = (script_dir / "../../references/metadata").resolve()

    parser = argparse.ArgumentParser(description="Distill CPI UI metadata into per-adapter/step JSON files")
    parser.add_argument("--input", default=str(default_metadata),
                        help="Root metadata directory (contains sender_adapters/, receiver_adapters/, pallet_functions/)")
    parser.add_argument("--output", default=str(default_metadata),
                        help="Output directory (adapters/ and steps/ subdirs will be created here)")
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)

    # Dirs
    sa_dir = input_dir / "sender_adapters"
    ra_dir = input_dir / "receiver_adapters"
    pf_dir = input_dir / "pallet_functions"
    adapters_out = output_dir / "adapters"
    steps_out = output_dir / "steps"

    adapters_out.mkdir(exist_ok=True)
    steps_out.mkdir(exist_ok=True)

    print(f"Input:  {input_dir}")
    print(f"Output: {output_dir}")
    print()

    # Load identity data
    sender_identity, receiver_identity, step_shapes = load_identity(input_dir)
    print(f"Loaded identity: {len(sender_identity)} senders, {len(receiver_identity)} receivers, {len(step_shapes)} step shapes")
    print()

    # Process sender adapters
    s_count = 0
    s_skipped = 0
    for raw_stem, adapter_name in SENDER_FILE_TO_NAME.items():
        ui_file = sa_dir / f"{raw_stem}.json"
        output_name = SENDER_FILE_TO_OUTPUT.get(raw_stem, raw_stem)
        if not ui_file.exists():
            print(f"  SKIP sender {raw_stem}: file not found")
            s_skipped += 1
            continue
        try:
            out_file = process_adapter(ui_file, "Sender", adapter_name, output_name,
                                       sender_identity, adapters_out)
            print(f"  sender  {output_name}.json")
            s_count += 1
        except Exception as e:
            print(f"  ERROR sender {raw_stem}: {e}")
            s_skipped += 1

    print(f"\nSender adapters: {s_count} written, {s_skipped} skipped")

    # Process receiver adapters
    r_count = 0
    r_skipped = 0
    for raw_stem, adapter_name in RECEIVER_FILE_TO_NAME.items():
        ui_file = ra_dir / f"{raw_stem}.json"
        output_name = RECEIVER_FILE_TO_OUTPUT.get(raw_stem, raw_stem)
        if not ui_file.exists():
            print(f"  SKIP receiver {raw_stem}: file not found")
            r_skipped += 1
            continue
        try:
            out_file = process_adapter(ui_file, "Receiver", adapter_name, output_name,
                                       receiver_identity, adapters_out)
            print(f"  receiver {output_name}.json")
            r_count += 1
        except Exception as e:
            print(f"  ERROR receiver {raw_stem}: {e}")
            r_skipped += 1

    print(f"\nReceiver adapters: {r_count} written, {r_skipped} skipped")

    # Process step / pallet function files
    step_count = 0
    step_skipped = 0
    for rel_stem, output_name in STEP_FILE_TO_OUTPUT.items():
        parts = rel_stem.split("/")
        ui_file = pf_dir.joinpath(*parts[:-1]) / f"{parts[-1]}.json"
        if not ui_file.exists():
            print(f"  SKIP step {rel_stem}: file not found")
            step_skipped += 1
            continue
        try:
            out_file = process_step(ui_file, output_name, step_shapes, steps_out)
            print(f"  step    {output_name}.json")
            step_count += 1
        except Exception as e:
            print(f"  ERROR step {rel_stem}: {e}")
            step_skipped += 1

    # Handle general_splitter folder
    gs_dir = pf_dir / "routing" / "general_splitter"
    if gs_dir.is_dir():
        # Find the JSON inside it
        gs_files = list(gs_dir.glob("*.json"))
        if gs_files:
            ui_file = gs_files[0]
            try:
                out_file = process_step(ui_file, "general_splitter", step_shapes, steps_out)
                print(f"  step    general_splitter.json")
                step_count += 1
            except Exception as e:
                print(f"  ERROR step general_splitter: {e}")
                step_skipped += 1

    print(f"\nFlow steps: {step_count} written, {step_skipped} skipped")

    # Generate cheat sheet
    print("\nGenerating adapter-uri-cheatsheet.md...")
    cheatsheet_path = generate_cheatsheet(adapters_out, steps_out, output_dir)
    print(f"  Written: {cheatsheet_path}")

    # Summary stats
    adapter_files = list(adapters_out.glob("*.json"))
    step_files = list(steps_out.glob("*.json"))
    cheatsheet_size = cheatsheet_path.stat().st_size if cheatsheet_path.exists() else 0
    total_adapter_size = sum(f.stat().st_size for f in adapter_files)
    total_step_size = sum(f.stat().st_size for f in step_files)

    print(f"\n{'='*50}")
    print(f"SUMMARY")
    print(f"{'='*50}")
    print(f"Adapter files:  {len(adapter_files)} files, {total_adapter_size/1024:.1f} KB")
    print(f"Step files:     {len(step_files)} files, {total_step_size/1024:.1f} KB")
    print(f"Cheat sheet:    {cheatsheet_size/1024:.1f} KB")
    print(f"Total output:   {(total_adapter_size + total_step_size + cheatsheet_size)/1024:.1f} KB")


if __name__ == "__main__":
    main()
