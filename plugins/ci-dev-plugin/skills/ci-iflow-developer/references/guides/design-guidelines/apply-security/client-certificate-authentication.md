# Client Certificate Authentication (mTLS)

Mutual TLS (mTLS) uses X.509 client certificates for authentication instead of username/password. CPI supports client certificate authentication on both sender and receiver channels. On the receiver side, the iFlow presents a client certificate from the tenant keystore when calling an external service. On the sender side, the iFlow requires the calling system to present a valid client certificate mapped to a specific user/role. These are complementary patterns: receiver-side secures outbound calls; sender-side secures the inbound endpoint.

## Variant Matrix

| Variant | Direction | Configuration | Key Setting |
|---|---|---|---|
| Receiver Channel | Outbound (CPI calls external system) | HTTP adapter with `authenticationMethod=ClientCertificate`, `privateKeyAlias=${header.keystore_alias}` | Private key alias from tenant keystore |
| Sender Channel | Inbound (external system calls CPI) | HTTPS sender adapter with `senderAuthType=ClientCertificate`, `clientCertificates` configured | Certificate-to-user mapping in tenant |

## Receiver Channel Pattern

The HTTP receiver adapter is configured with authentication method "Client Certificate". The private key alias can be externalized via header or parameter (e.g., `${header.keystore_alias}`). The corresponding certificate must be trusted by the target server.

Allowed headers include `target_host` and `keystore_alias` to make the target and certificate dynamically configurable.

## Sender Channel Pattern

The HTTPS sender adapter is configured with `senderAuthType=ClientCertificate`. The calling system must present a certificate that matches an entry in the tenant's certificate-to-user mapping. No username/password is needed; authentication is purely certificate-based.

## Known Gotchas
- Receiver side: the private key alias must exist in the tenant keystore and the corresponding public certificate must be imported into the target system's trust store
- Sender side: certificate-to-user mapping must be configured in the Integration Suite's Security Material section; simply having the certificate is not enough
- Certificate expiry will silently break authentication; implement monitoring for certificate expiration dates
- When using dynamic private key alias via headers, the header must be listed in `allowedHeaderList`
