# IDoc Bulk Handling

IDoc (Intermediate Document) messages from SAP systems can be sent in bulk (multiple IDocs in a single message). The inbound pattern handles receiving a bulk IDoc message and splitting it into individual IDocs for processing. The outbound pattern handles collecting individual records and packaging them into an IDoc bulk structure for sending to an SAP receiver.

## Variant Matrix

| Variant | Direction | Key Mechanism |
|---------|-----------|--------------|
| Inbound | IDoc sender -> CPI | IDoc Splitter step to split bulk into individual IDocs |
| Outbound | CPI -> IDoc receiver | Message Mapping to package multiple materials into MATMAS IDoc bulk |

## Flow Structure

**Inbound**: Sender (IDoc adapter) -> Start -> IDoc Splitter -> Groovy Script ("Set SAP headers", extracts DOCNUM list) -> Content Modifier ("Set DataStore Context") -> End -> Receiver (ProcessDirect)

**Outbound**: Sender (HTTPS) -> Start -> Request Reply (fetch materials) -> Content Modifier ("Set IDoc header") -> Message Mapping ("Map Materials bulk to MATMAS bulk") -> End -> Receiver (IDoc adapter)

## Groovy Script Patterns

The inbound `fetchAllDocNumbers.groovy` extracts all IDoc document numbers from the bulk payload using XmlSlurper:
```groovy
import com.sap.gateway.ip.core.customdev.util.Message

def xml = new XmlSlurper().parseText(message.getBody(String.class))
message.setHeader("SAPIdocIdList", xml.IDOC.collect { it.EDI_DC40.DOCNUM.text() })
```
This uses `XmlSlurper` (non-obvious import: `groovy.util.XmlSlurper` is auto-imported in Groovy) to parse the IDoc XML and collect all DOCNUM values into a list header.

## Known Gotchas
- The IDoc Splitter is a specialized step that understands IDoc XML structure. It differs from the General Splitter in that it preserves IDoc envelope elements correctly.
- The inbound pattern sets `SAPIdocIdList` as a header containing all document numbers before splitting. After splitting, each individual IDoc has only its own DOCNUM, so the full list must be extracted before the split step.
- For outbound IDoc packaging, the Message Mapping must produce the correct IDoc XML structure including EDI_DC40 control record and the segment-specific data records. The IDoc receiver adapter expects this exact structure.
