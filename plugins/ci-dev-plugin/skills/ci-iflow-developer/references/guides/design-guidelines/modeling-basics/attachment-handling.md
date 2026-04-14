# Attachment Handling

Attachments in CPI are managed through the `message.getAttachments()` API (returns `Map<String, DataHandler>`) and the `message.addAttachmentObject()` method. These patterns cover the full lifecycle: creating attachments from the message body, reading a single attachment with filter criteria, iterating over multiple attachments, and replacing the message body with attachment content. Attachments are commonly created when receiving email messages (Mail adapter) or when using MIME Multipart decoding, but can also be constructed programmatically.

## Variant Matrix

| Variant | Key Behavior |
|---------|-------------|
| Create Attachments | Constructs a `DefaultAttachment` from the body `InputStream` and adds it with content-type-derived filename |
| Read Attachment Based On Filter | Filters attachments by content-type, filename, or suffix; replaces body with matching attachment |
| Read Multiple Attachments | Stores all attachments in a property map, iterates via Looping Process Call, processes one attachment per iteration |
| Read Multiple Attachments Based On Filter | Same iteration pattern but applies filename filter during each iteration |
| Replace Body With Attachment | Takes the first attachment and replaces the message body with its content |

## Groovy Script Patterns

**Create attachment** from message body (requires `DefaultAttachment`, `ByteArrayDataSource`):
```groovy
import org.apache.camel.impl.DefaultAttachment
import javax.mail.util.ByteArrayDataSource

def body = message.getBody(InputStream.class)
def contentType = message.getHeaders().get("Content-Type")
def suffix = contentType.substring(contentType.indexOf("/") + 1)
if (suffix == "plain") suffix = 'txt'
def dataSource = new ByteArrayDataSource(body, contentType)
def attachment = new DefaultAttachment(dataSource)
message.addAttachmentObject('attachment.' + suffix, attachment)
```

**Filter single attachment** by content-type (same pattern for filename/suffix -- change the filter condition):
```groovy
import javax.activation.DataHandler

Map<String, DataHandler> attachments = message.getAttachments()
if (attachments.isEmpty()) {
    message.setBody('<warning>Attachment is missing</warning>')
} else {
    def filterValue = message.getHeaders().get("FilterValue")
    attachments.values().each { attachment ->
        // By content-type: attachment.getContentType().contains(filterValue)
        // By filename:     attachment.getName().contains(filterValue)
        // By suffix:       attachment.getName().toLowerCase().endsWith(filterValue.toLowerCase())
        if (attachment.getContentType().contains(filterValue)) {
            message.setBody(attachment.getContent())
            message.setProperty('AttachmentContentType', attachment.getContentType())
        }
    }
    message.getAttachments().clear()
    message.getAttachmentWrapperObjects().clear()
}
```

**Iterate multiple attachments** using property storage and Looping Process Call:
```groovy
import javax.activation.DataHandler

// Step 1: saveAttachments -- store all attachments in a property, clear from message
def attachments = new HashMap<String, DataHandler>(message.getAttachments())
message.setProperty('AttachmentsMap', attachments)
message.setProperty('AttachmentCount', attachments.size())
message.getAttachments().clear()
message.getAttachmentWrapperObjects().clear()

// Step 2: getNextAttachment -- called in each loop iteration
def attachments = message.getProperty('AttachmentsMap')
def nextKey = attachments.keySet().iterator().next()
def attachment = attachments.remove(nextKey)
message.setBody(attachment.getContent())
message.setProperty('AttachmentCount', attachments.size())
message.setHeader('receiver', attachment.getName())
```
The Looping Process Call condition checks `${property.AttachmentCount} > '0'` to continue iterating.

**Replace body with first attachment**:
```groovy
import javax.activation.DataHandler

Map<String, DataHandler> attachments = message.getAttachments()
if (attachments.isEmpty()) {
    message.setBody("<warning>Attachment is missing</warning>")
} else {
    DataHandler attachment = attachments.values().iterator().next()
    message.setBody(attachment.getContent())
    message.getAttachments().clear()
    message.getAttachmentWrapperObjects().clear()
}
```

## Known Gotchas
- Always call both `message.getAttachments().clear()` and `message.getAttachmentWrapperObjects().clear()` to fully remove attachments. Clearing only one collection may leave orphaned references.
- `attachment.getContent()` returns an `Object` that may be a `String` or `InputStream` depending on the MIME type. Cast explicitly if needed.
- The filter-based variants set `AttachmentContentType` as a property to preserve content-type information after clearing attachments.
- When iterating multiple attachments with filter, the `Flag` property is used to track whether the current attachment matched the filter, enabling conditional processing in the loop.
