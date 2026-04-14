# CSRF Protection

Cross-Site Request Forgery (CSRF) protection requires a two-step handshake: first fetch a CSRF token via a GET/HEAD request, then include that token in the subsequent state-changing request. CPI supports CSRF on both sides: as a receiver (CPI must fetch a token before calling a CSRF-protected external endpoint) and as a sender (CPI's own HTTPS endpoint requires callers to fetch and present a CSRF token). The receiver pattern is the most common, needed when calling SAP Gateway, S/4HANA OData, or other SAP endpoints that enforce CSRF validation.

## Variant Matrix

| Variant | Direction | Key Setting |
|---|---|---|
| Receiver Channel | Outbound (CPI calls CSRF-protected endpoint) | `httpSessionHandling=onExchange`, HTTP adapter with `isCSRFEnabled=true` on the OData/HTTP adapter |
| Sender Channel | Inbound (CPI enforces CSRF on its endpoint) | `xsrfProtection=1` on the HTTPS sender adapter |

## Receiver Channel Pattern

When CPI calls a CSRF-protected receiver, the runtime automatically performs the token fetch-then-use sequence if CSRF is enabled on the adapter:

1. The HTTP/OData adapter sends a HEAD request with `X-CSRF-Token: Fetch` header
2. The receiver responds with `X-CSRF-Token: <token>` and session cookies
3. The adapter includes the token and cookies in the subsequent POST/PUT/DELETE request

**Critical setting:** `httpSessionHandling` must be set to `onExchange` at the iFlow level to maintain session cookies between the token fetch and the actual request. Without this, the session cookie from step 2 is lost and the token is rejected.

## Sender Channel Pattern

When CPI enforces CSRF on its own HTTPS endpoint (`xsrfProtection=1`), callers must:

1. Send a GET request to the endpoint with `X-CSRF-Token: Fetch` header
2. CPI responds with a valid token
3. Caller includes the token in subsequent POST requests

This is enabled by default on HTTPS sender adapters (`xsrfProtection=1`).

## Known Gotchas
- Missing `httpSessionHandling=onExchange` is the most common cause of CSRF failures on receiver channels; the token fetch succeeds but the subsequent request fails because session cookies are dropped
- CSRF tokens are typically valid for a limited time (minutes); long-running processes may see token expiry between fetch and use
- Some SAP systems require CSRF tokens for all modifying operations but not for GET/HEAD; the adapter handles this automatically when `isCSRFEnabled=true`
- The sender-side CSRF protection (`xsrfProtection=1`) is the default; set to `0` only when the caller cannot perform the two-step handshake (e.g., webhook providers)
