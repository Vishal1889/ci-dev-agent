# Delta Sync via Timestamp

Delta synchronization uses a stored timestamp to fetch only records that have changed since the last successful sync. This avoids reprocessing the entire dataset on each run. Two variants differ in how they determine the "next" timestamp: one uses the current system time (`date:now`), while the other extracts the timestamp from the response payload itself.

## Variant Matrix

| Variant | Timestamp Source | Pros | Cons |
|---------|-----------------|------|------|
| Via Date Now | `${date:now:yyyy-MM-dd'T'HH:mm:ss}` (system clock) | Simple, no payload dependency | May miss records modified during processing if clock skew exists |
| Via Payload | Extracted from response data (e.g., last record's timestamp) | Precise, based on actual data | Requires payload to contain timestamp; more complex extraction |

## Flow Structure (shared pattern)

Start Timer -> Content Modifier ("Get last timestamp" -- reads from Global Variable or Data Store) -> Request Reply ("fetch delta" -- OData query with filter `$filter=ChangedAt gt datetime'${property.lastTimestamp}'`) -> Content Modifier ("Store next timestamp" -- writes new timestamp to Global Variable or Data Store) -> Request Reply ("send data" -- forwards delta to receiver) -> End -> Receiver (ProcessDirect) / MPLStore (ProcessDirect)

## Parameters

| Key | Purpose | Example |
|-----|---------|---------|
| `address` | Backend API URL | `https://<host>/api/v1` |
| `credentialName` | Credential for API access | `iFlowDesignGuidelineUser` |
| `defaultDate` | Initial timestamp for first run | `2021-02-09T00:00:00` |

## Known Gotchas
- The "Date Now" variant sets the next timestamp before processing is complete. If the flow fails after setting the timestamp but before successfully processing, records from that window are skipped on the next run. Consider setting the timestamp only after successful processing.
- The `defaultDate` parameter is used on the first run when no stored timestamp exists. It should be set to a date that captures all relevant historical data.
- Timer-initiated flows run on schedule. If a run takes longer than the timer interval, overlapping executions may occur. Use exclusive locks or data store flags to prevent concurrent delta syncs.
- Timestamp precision matters: if the source system's timestamps have millisecond precision but the filter uses second precision, records modified in the same second as the cutoff may be missed or duplicated.
