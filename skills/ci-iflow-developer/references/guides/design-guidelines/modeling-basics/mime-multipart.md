# MIME Multipart Encoder Decoder

The MIME Multipart Encoder and Decoder steps handle conversion between a standard CPI message (body + attachments) and a MIME multipart message format. The Encoder combines the message body and any attachments into a single MIME multipart body. The Decoder splits a MIME multipart body back into the main body and separate attachments. This is essential for protocols that transmit multiple payloads in a single message (e.g., SOAP with attachments, email, AS2).

## Flow Structure

Sender (HTTPS) -> Start -> Content Modifier ("Define context for monitoring purposes") -> MIME Multipart Encoder -> Request Reply (ProcessDirect to GenericReceiver1, which echoes the encoded message) -> MIME Multipart Decoder -> Content Modifier ("Define context for monitoring purposes") -> End -> Receiver (ProcessDirect to GenericReceiver2)

The flow demonstrates a round-trip: encode the message with its attachments into MIME multipart, send it, then decode the received MIME multipart back into body + attachments.

## Known Gotchas
- The MIME Multipart Encoder takes the message body as the first MIME part and each attachment as additional parts. If there are no attachments, the result is a single-part MIME message.
- The Decoder sets the first MIME part as the message body and subsequent parts as attachments. The original attachment names may not be preserved if the MIME headers don't include `Content-Disposition` with filename.
- When using MIME Multipart with the Mail adapter, the encoder step is typically not needed because the Mail adapter handles MIME encoding internally. Use the encoder when sending multipart content over HTTP or ProcessDirect.
- Content-Type headers are critical: the Encoder sets `Content-Type: multipart/mixed; boundary=...` on the message. If downstream steps overwrite this header, the Decoder cannot parse the multipart boundary.
