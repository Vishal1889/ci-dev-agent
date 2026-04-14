# Splitter Error Handling

Error handling with Splitter steps requires careful consideration of two independent configuration axes: whether **Stop on Exception** is enabled and whether a **Gather** step follows the Splitter. The combination of these two settings produces four distinct behaviors for how exceptions in individual split items are handled, whether remaining items are processed, and what the final message looks like. All variants use a General Splitter with XPath expression, sequential processing, and a Local Integration Process for the split item processing.

## Variant Matrix

| Variant | Gather | StopOnException | Exception Subprocess End Event | Behavior on Split Item Error |
|---------|--------|-----------------|-------------------------------|------------------------------|
| Splitter + Gather + Stop | Yes (xpath-merge) | `true` | `ErrorEndEvent` | Stops processing remaining items. Gather receives only items processed before the error. Main flow ends with Error End Event -> MPL FAILED. |
| Splitter + Gather - Stop | Yes (xpath-merge) | `false` | `MessageEndEvent` | Continues processing all items. Failed items produce error output from Exception Subprocess. Gather merges all results including error items. MPL COMPLETED. |
| Splitter - Gather + Stop | No | `true` | `ErrorEndEvent` | Stops processing remaining items. No aggregation. Main flow ends with Error End Event -> MPL FAILED. |
| Splitter - Gather - Stop | No | `false` | `MessageEndEvent` | Continues processing all items. No aggregation. Last split item's result becomes the final body. MPL COMPLETED. |

## Flow Structure (common to all variants)

Sender (HTTPS) -> Start -> General Splitter (XPath, sequential) -> [Local Integration Process: Split Process] -> [optional Gather] -> [optional additional steps] -> End

**Local Integration Process: Split Process** (within each split iteration):
Start -> Content Modifier (set context for monitoring: `receiver=Split index ${property.CamelSplitIndex}`) -> Request Reply (ProcessDirect to external system) -> Message Mapping -> Filter -> End

**Exception Subprocess** (within Local Integration Process):
Error Start -> Content Modifier ("Define context for monitoring purposes_exp") -> [End Event type varies by variant]

### Stop on Exception variants (StopOnException=true)
- The Exception Subprocess ends with **Error End Event**, which re-throws the exception and halts the Splitter iteration.
- The main Integration Process sees the exception and can handle it (or let it fail the MPL).

### No Stop on Exception variants (StopOnException=false)
- The Exception Subprocess ends with **Message End Event**, which swallows the exception for that split item.
- The Splitter continues to the next item. If Gather is present, the error item's output (from the Exception Subprocess Content Modifier) is included in the merged result.

### Gather variants
- Use `xpath-merge-strategy` aggregation algorithm to merge XML output from all split items.
- The Gather step is placed after the Splitter in the main Integration Process (outside the Local Integration Process).

### No Gather variants
- No aggregation -- each split item is processed independently.
- An additional Request Reply step and Content Modifier in the main flow (outside the split) handle the final message.

## Known Gotchas
- **StopOnException + Gather**: Items already processed before the failing item are gathered, but the gathered result may be incomplete. The Error End Event in the Exception Subprocess causes the Gather to receive a partial result.
- **No StopOnException + Gather**: All items are processed, but failed items contribute their Exception Subprocess output to the Gather. The merged XML may contain a mix of success and error items. Your downstream processing must handle this.
- **No StopOnException + No Gather**: The final message body is from the **last** split item only. If the last item failed, the body is the error message from the Exception Subprocess.
- `CamelSplitIndex` property is available in each split iteration for tracking which item is being processed -- useful for monitoring and debugging via custom headers.
- The Splitter's `StopOnExecution` property name is a known misnomer in the CPI API -- it means "StopOnException" despite the spelling.
