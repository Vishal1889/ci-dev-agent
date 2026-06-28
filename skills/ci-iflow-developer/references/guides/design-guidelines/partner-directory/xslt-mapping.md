# Partner Directory - XSLT Mapping

Use Partner Directory Binary Parameters to store per-partner XSLT mappings and XSD schemas. This allows the same iFlow to apply different transformations and validations depending on which partner sent the message, without deploying separate iFlows or bundling all partner-specific resources into the artifact. The XSLT mapping step and XML Validator step reference PD Binary Parameters via the `pd:` prefix syntax in header expressions. A Groovy script resolves the authenticated user to a PID, which is used to construct the PD references dynamically.

## Flow Structure

- Sender (HTTPS, `/PartnerDirectory/xsltmapping`) -> Integration Process
  - `allowedHeaderList` includes `SapAuthenticatedUserName`
- Content Modifier "read PartnerId": extracts property `PartnerId` from XPath `//Header/PID`
- Content Modifier "write Pid in Header": constructs PD Binary references as headers:
  - `MyMappingSchema` = `pd:${property.PartnerId}:MyMappingSchema:Binary`
  - `MyMapping` = `pd:${property.PartnerId}:MyMapping:Binary`
- XSLT Mapping "xslt from PD": source = `mappingSrcHeader`, header name = `MyMapping` (reads XSLT from PD Binary)
- XML Validator "validate XML": schema = `${header.MyMappingSchema}` (reads XSD from PD Binary)
- Content Modifier "Define context": sets `receiver=Partner ${property.PartnerId}`, `context=PartnerDirectory-XSLT`
- End -> ProcessDirect to Generic Receiver

## Groovy Script Patterns

This flow uses a Groovy script for authorized user lookup (same pattern as the Authorized User guide):

```groovy
import com.sap.it.api.pd.PartnerDirectoryService
import com.sap.it.api.ITApiFactory

def Message processData(Message message) {
    def service = ITApiFactory.getApi(PartnerDirectoryService.class, null)
    if (service == null) {
        throw new IllegalStateException("Partner Directory Service not found")
    }

    def headers = message.getHeaders()
    def user = headers.get("SapAuthenticatedUserName")
    if (user == null) {
        throw new IllegalStateException("User is not set in the header 'SapAuthenticatedUserName'")
    }
    def Pid = service.getPartnerIdOfAuthorizedUser(user)
    if (Pid == null) {
        throw new IllegalStateException("No partner ID found for user " + user)
    }
    message.setProperty("pid", Pid)
    return message
}
```

However, the primary teaching content here is the **no-script PD integration** via Content Modifier and step configuration:

- **PD Binary reference syntax**: `pd:<PID>:<parameterName>:Binary` -- used in header values to reference Binary Parameters.
- **XSLT Mapping step**: set `mappingSource=mappingSrcHeader` and `mappingHeaderNameKey=MyMapping` to read the XSLT from a header whose value is a PD Binary reference.
- **XML Validator step**: set `xsd=${header.MyMappingSchema}` to read the XSD schema from a PD Binary reference stored in a header.

## Known Gotchas

- The XSLT and XSD must be uploaded as **Binary Parameters** in the Partner Directory for each partner PID. String Parameters will not work.
- The `pd:` reference syntax in headers is resolved at runtime by the XSLT Mapping and XML Validator steps. It does NOT work in all step types -- only those that explicitly support PD binary resolution.
- The XSLT Mapping step's `mappingSource` must be set to `mappingSrcHeader` (not `mappingSrcResource`) to read from a header-referenced PD binary. If set to resource mode, it looks for a local file instead.
- The `mappingoutputformat` is set to `Bytes`. Ensure the XSLT output matches the expected format downstream.
- If the Binary Parameter is missing for a given PID, the step fails at runtime with an opaque error. Validate PD entries exist before deploying.
- This flow reads the PID from the payload (`//Header/PID`) rather than from `SapAuthenticatedUserName`, despite also having the authorized user script. Choose one identification strategy per flow to avoid confusion.
