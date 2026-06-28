# Partner Directory - Dynamic Receiver

Use Partner Directory String Parameters to dynamically resolve the receiver endpoint URL and credentials per partner. This pattern enables a single iFlow to route messages to different backend systems depending on the partner, with both the receiver URL and credential alias stored in the PD. The Groovy script reads the PID from a message property, then fetches the `ReceiverUrl` String Parameter and constructs the credential alias using the `pd:` prefix convention. The receiver HTTP adapter uses `${property.receiverUrl}` and `${property.credentialAlias}` expressions for fully dynamic routing.

## Flow Structure

- Sender (HTTPS, `/PartnerDirectory/DynamicReceiver`) -> Integration Process
- Content Modifier "Get Pid": extracts property `pid` from XPath `/Order/Header/PID`
- Groovy Script "Lookup StringParameter from PD": fetches receiver URL and builds credential alias
- Content Modifier "Define context": sets `receiver=Partner ${property.pid}`, `context=PartnerDirectory-DynamicReceiver`
- End -> HTTP receiver with dynamic address `${property.receiverUrl}` and credential `${property.credentialAlias}`

## Groovy Script Patterns

Fetching String Parameters and constructing credential aliases:

```groovy
import com.sap.it.api.pd.PartnerDirectoryService
import com.sap.it.api.ITApiFactory

def Message processData(Message message) {
    def service = ITApiFactory.getApi(PartnerDirectoryService.class, null)
    if (service == null) {
        throw new IllegalStateException("Partner Directory Service not found")
    }

    def properties = message.getProperties()
    def Pid = properties.get("pid")
    if (Pid == null) {
        throw new IllegalStateException("Partner ID not found in sent message")
    }

    // Fetch receiver URL from PD String Parameter
    def receiverUrl = service.getParameter("ReceiverUrl", Pid, String.class)
    if (receiverUrl == null) {
        throw new IllegalStateException("ReceiverUrl parameter not found for partner ID " + Pid)
    }
    message.setProperty("receiverUrl", receiverUrl)

    // Build credential alias using pd: prefix convention
    // Equivalent to using "pd:${property.pid}:ReceiverCredentials:UserCredential" directly in adapter
    message.setProperty("credentialAlias", "pd:" + Pid + ":ReceiverCredentials:UserCredential")

    return message
}
```

Key APIs:
- `service.getParameter(String paramName, String pid, Class type)` -- fetches a typed parameter from PD. Use `String.class` for String Parameters.
- Credential alias format: `pd:<PID>:<paramName>:<paramType>` -- CPI resolves this at runtime from the PD.

## Known Gotchas

- The HTTP receiver adapter must have `address` set to `${property.receiverUrl}` and `credentialName` set to `${property.credentialAlias}`. Both use expression syntax, not `{{externalized}}` syntax.
- The credential alias `pd:<PID>:ReceiverCredentials:UserCredential` can also be used directly in the adapter configuration as an expression, bypassing the Groovy script. The script approach is shown here for clarity.
- `getParameter()` returns null both when the PID is not found and when the parameter name is not found for that PID. The error message should include the PID to aid debugging.
- The PD must contain both a String Parameter `ReceiverUrl` and a UserCredential parameter `ReceiverCredentials` for each partner PID. Missing either causes a runtime failure.
