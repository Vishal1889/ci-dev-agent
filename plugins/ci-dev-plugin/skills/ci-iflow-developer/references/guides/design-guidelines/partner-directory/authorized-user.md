# Partner Directory - Authorized User

Use the Partner Directory's authorized user lookup to resolve the sending partner from the authenticated user identity. When a sender connects via HTTPS with basic authentication or client certificate, CPI populates the `SapAuthenticatedUserName` header. The Groovy script calls `getPartnerIdOfAuthorizedUser(user)` to map this technical user to a Partner Directory PID. This is the simplest PD pattern: no payload parsing needed, partner identification is implicit from the authentication context.

## Flow Structure

- Sender (HTTPS, `/PartnerDirectory/AuthorizedUser`) -> Integration Process
  - `allowedHeaderList` includes `SapAuthenticatedUserName`
- Groovy Script "LookUp PD": resolves authenticated user to PID
- Content Modifier "Define context": sets `receiver=Partner ${property.pid}`, `context=PartnerDirectory-AuthorizedUser`
- End -> ProcessDirect to Generic Receiver

## Groovy Script Patterns

Minimal PD lookup using the authenticated user:

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

Key API: `PartnerDirectoryService.getPartnerIdOfAuthorizedUser(String user)` -- maps the technical user/certificate CN to a PID. The user-to-PID mapping must be configured in the Partner Directory beforehand.

## Known Gotchas

- `SapAuthenticatedUserName` must be in the `allowedHeaderList` of the iFlow configuration. If omitted, the header is stripped and the script receives null.
- The mapping from technical user to PID is configured via the Partner Directory OData API (`AuthorizedUsers` entity). If the mapping is missing, `getPartnerIdOfAuthorizedUser` returns null.
- This pattern only works for sender-side partner identification. For scenarios where the partner ID is in the message payload, use the Alternative Partner ID or Dynamic Receiver patterns instead.
- Multiple technical users can map to the same PID (many-to-one), but each user can only map to one PID (one-to-one from user side).
