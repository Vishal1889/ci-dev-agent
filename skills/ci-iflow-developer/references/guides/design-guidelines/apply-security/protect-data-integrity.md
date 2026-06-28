# Protect Data Integrity

This pattern uses the Message Digest step to compute a hash (checksum) of the message body and then compares it against an expected hash to detect tampering. The flow computes the digest, routes based on match/mismatch, and returns a clear pass/fail response. Use this when the sender provides a known hash or when you need to verify that message content was not altered during transit or storage.

## Flow Structure

Sender --> [HTTPS] --> Start --> Content Modifier (store ExpectedHash property) --> Message Digest (SHA-1, target header: SAPMessageDigest, canonicalization: xml-c14n) --> Router --> [match: ok] Content Modifier (success response) --> End | [mismatch: not ok] Content Modifier (failure response) --> End

The Router condition: `${property.ExpectedHash} != ${header.SAPMessageDigest}` routes to the failure branch.

## Message Digest Step Configuration

- `digestAlgorithm`: SHA-1 (or SHA-256 for stronger guarantee)
- `targetHeader`: SAPMessageDigest (output header containing the computed hash)
- `canonicalizationMethod`: xml-c14n (XML Canonicalization normalizes whitespace/namespace ordering before hashing)

## Known Gotchas
- The expected hash must be computed with the same canonicalization method; if the sender uses a different XML canonicalization, hashes will never match even for identical logical content
- SHA-1 is shown in the guideline but SHA-256 should be preferred for new implementations
- Whitespace-only differences in XML will produce different hashes without canonicalization; always use xml-c14n for XML payloads
- The `SAPMessageDigest` header is base64-encoded; the expected hash property must also be base64-encoded for comparison
