# Remove Sensitive Content from Logs

When logging message headers to the MPL for monitoring, sensitive headers (e.g., `authorization`) must be excluded to avoid leaking credentials into monitoring UIs and log storage. This pattern demonstrates two complementary approaches: a whitelist (log only explicitly named headers) and a blacklist (log all headers except sensitive ones). Use these in Groovy scripts that attach diagnostic data to the MPL.

## Groovy Script Pattern

```groovy
def Message processData(Message message) {
    def messageLog = messageLogFactory.getMessageLog(message)
    def map = message.getHeaders()

    // Whitelist: log only specific safe headers
    messageLog.setStringProperty("Content-Type (whitelist)", map.get("Content-Type"))
    messageLog.setStringProperty("Accept (whitelist)", map.get("Accept"))
    messageLog.setStringProperty("Context (whitelist)", map.get("Context"))

    // Blacklist: log all headers except sensitive ones
    map.each { k, v ->
        if (!k.equals("authorization")) {
            messageLog.setStringProperty(k + " (blacklist)", v)
        }
    }
    return message
}
```

The whitelist approach is safer (only known-safe headers are logged) while the blacklist approach is more comprehensive but risks missing new sensitive headers added in the future.

## Flow Structure

The iFlow's `allowedHeaderList` includes `authorization|content-type|accept|context` so that these headers pass through from the sender adapter into the integration process, where the script selectively logs them.

## Known Gotchas
- Prefer whitelist over blacklist for production; blacklist requires updating whenever new sensitive headers are introduced
- `messageLog.setStringProperty` logs appear as MPL properties, not attachments; they are visible to anyone with monitoring access
- Header names are case-sensitive in `getHeaders().get()` but HTTP headers are case-insensitive; consider normalizing to lowercase before comparison
- The `authorization` header typically contains Bearer tokens or Basic credentials; it must never appear in logs
