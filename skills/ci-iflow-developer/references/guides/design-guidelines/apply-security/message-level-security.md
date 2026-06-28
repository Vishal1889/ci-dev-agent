# Message Level Security (Sign/Encrypt and Decrypt/Verify)

PKCS#7/CMS message-level security protects payload confidentiality and integrity independent of transport-layer TLS. The pattern uses two companion iFlows: one that signs and encrypts outbound messages, and another that decrypts and verifies inbound messages. This is required when intermediaries handle the message (store-and-forward, multi-hop routing) or when the sender/receiver requires end-to-end payload protection beyond channel-level HTTPS. Key aliases are externalized so that certificate rotation does not require iFlow redeployment.

## Variant Matrix

| Variant | Direction | Steps | Key Aliases |
|---|---|---|---|
| Sign and Encrypt | Outbound | Encrypt step (activityType=Encrypt, PKCS7SignContentType=signedAndEnveloped) | `keypair_alias_for_signature` (private key for signing), `keypair_alias_for_encryption` (public key for encryption) |
| Decrypt and Verify | Inbound | Decrypt step (activityType=Decrypt, PKCS7SignContentType=SignedAndEnvelopedData) | `keypair_alias_for_signature` (public key for verification) |

## Flow Structure

**Sign and Encrypt variant:**
Sender --> [HTTPS] --> Start --> Encrypt (Sign+Encrypt) --> Content Modifier (set storage name) --> Request Reply (store encrypted via ProcessDirect) --> End --> [HTTP] --> Receiver

**Decrypt and Verify variant:**
Sender --> [HTTPS] --> Start --> Decrypt (Decrypt+Verify) --> Content Modifier (set storage name) --> End --> [ProcessDirect] --> GenericReceiver

## Parameters

| Key | Purpose | Example |
|---|---|---|
| `keypair_alias_for_signature` | Private key alias for signing / public key alias for verification | `keypair_for_signature` |
| `keypair_alias_for_encryption` | Public key alias for encryption (Sign and Encrypt only) | `keypair_for_encryption` |

## Encrypt Step Configuration

The Encrypt step uses `PKCS7SignContentType=signedAndEnveloped` which performs signing and encryption in a single step. Key configuration:
- Signature: private key alias via `PKCS7PrivateKeyAliases`, algorithm `SHA512/RSA`, optionally include certificate
- Encryption: public key alias via `headers` (Public Key Alias), algorithm `AES/CBC/PKCS5Padding`, key length 256
- Body is base64-encoded after encryption (`shouldEncodeBodyKey=true`)

## Known Gotchas
- The Sign+Encrypt and Decrypt+Verify iFlows must share the same keypair aliases pointing to matching public/private key pairs
- The Decrypt step expects `isBodyBase64Encoded=true` when the Encrypt step used base64 encoding
- Key aliases must reference artifacts deployed in the tenant keystore; missing aliases cause deployment failure, not runtime failure
- Certificate rotation requires updating the keystore entry; the externalized alias remains unchanged
