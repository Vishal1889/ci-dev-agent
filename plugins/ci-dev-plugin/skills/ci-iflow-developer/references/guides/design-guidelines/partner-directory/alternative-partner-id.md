# Partner Directory - Alternative Partner ID

Use the Partner Directory's alternative partner ID lookup when inbound messages identify partners by a scheme/agency/ID triple rather than by the CPI-internal partner ID (PID). This is common in B2B scenarios where partners use industry identifiers (DUNS, GLN, etc.) that must be mapped to the internal PID before any other PD operations. The flow extracts the alternative identifier from the payload, calls `getPartnerId(agency, scheme, alternativeId)`, and sets the resolved PID as a property for downstream steps.

## Flow Structure

- Sender (HTTPS, `/PartnerDirectory/AlternativePartnerId`) -> Integration Process
- Content Modifier "Get Alternative Partner Id": extracts XPath properties from payload:
  - `Agency` from `/Order/Header/Agency`
  - `Scheme` from `/Order/Header/Scheme`
  - `AlternativePid` from `/Order/Header/AlternativePid`
- Groovy Script "LookUp PD": resolves alternative ID to PID
- Content Modifier "Define context": sets header `receiver=Partner ${property.pid}`, `context=PartnerDirectory-AlternativePartnerId`
- End -> ProcessDirect to Generic Receiver

## Groovy Script Patterns

Core PD lookup using alternative partner identification:

```groovy
import com.sap.it.api.pd.PartnerDirectoryService
import com.sap.it.api.ITApiFactory

def Message processData(Message message) {
    def service = ITApiFactory.getApi(PartnerDirectoryService.class, null)
    if (service == null) {
        throw new IllegalStateException("Partner Directory Service not found")
    }

    def properties = message.getProperties()
    def Agency = properties.get("Agency")
    def Scheme = properties.get("Scheme")
    def AlternativePid = properties.get("AlternativePid")

    // Map alternative partner ID triple to internal PID
    def pid = service.getPartnerId(Agency, Scheme, AlternativePid)
    if (pid == null) {
        throw new IllegalStateException("Partner ID not found for agency " + Agency +
            ", scheme " + Scheme + ", and id " + AlternativePid)
    }
    message.setProperty("pid", pid)
    return message
}
```

Key API: `PartnerDirectoryService.getPartnerId(String agency, String scheme, String alternativeId)` returns the internal PID or null.

## Known Gotchas

- The Agency/Scheme/AlternativePid triple must be pre-registered in the Partner Directory via OData API or UI. If any value is null or not found, the script throws `IllegalStateException`.
- Property names extracted via Content Modifier must exactly match what the Groovy script reads (`Agency`, `Scheme`, `AlternativePid` -- case-sensitive).
- This lookup is distinct from `getPartnerIdOfAuthorizedUser()` (Authorized User pattern). Use alternative ID when the partner identity comes from the message payload, not from the authenticated sender.
