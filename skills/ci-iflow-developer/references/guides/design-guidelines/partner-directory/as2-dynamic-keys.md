# Partner Directory - AS2 Dynamic Keys

Use Partner Directory references in AS2 adapter configuration to dynamically resolve cryptographic keys per partner. Instead of hardcoding key aliases, use the `pd:` prefix syntax in the AS2 sender adapter's key alias fields. This allows the same iFlow to handle multiple AS2 partners, each with their own signing/verification and encryption/decryption keys stored in the Partner Directory. The `SapAuthenticatedUserName` header identifies the sending partner, and a Groovy script resolves the PID for monitoring.

## Flow Structure

- Sender (AS2 adapter) -> Integration Process
  - AS2 adapter key configuration uses PD references:
    - `publicKeyAliasForVerification` = `pd:SenderPublicKey`
    - `privateKeyAliasForDecryption` = `pd:ReceiverPrivateKey`
  - `allowedHeaderList` includes `SapAuthenticatedUserName`
- Groovy Script "LookUp PD": resolves authenticated user to PID
- Content Modifier "Define context": sets `receiver=Partner ${property.pid}`, `context=PartnerDirectory-AS2DynamicKeys`
- End -> ProcessDirect to Generic Receiver

## Groovy Script Patterns

The script resolves the authenticated AS2 sender to a Partner Directory PID:

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

Key API: `PartnerDirectoryService.getPartnerIdOfAuthorizedUser(String user)` maps the technical user to a PID.

## Known Gotchas

- The `pd:` prefix syntax in AS2 adapter fields (`pd:SenderPublicKey`, `pd:ReceiverPrivateKey`) references Binary Parameters in the Partner Directory, NOT String Parameters. The keys must be uploaded as Binary type entries.
- The `SapAuthenticatedUserName` header is only populated when the sender authenticates. If authentication is disabled or the header is not in `allowedHeaderList`, the script will throw an error.
- AS2 adapter uses `ExactlyOnce` QoS with JMS queues. Ensure the JMS broker is properly sized for the expected message volume.
- Each partner must have their public key (for verification) and the receiver's private key (for decryption) registered as separate Binary parameters in the PD under their PID.
