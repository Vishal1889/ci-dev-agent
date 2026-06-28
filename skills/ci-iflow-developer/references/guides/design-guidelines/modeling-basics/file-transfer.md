# File Transfer Patterns

These patterns demonstrate various approaches to file-based integration using SFTP adapters, Poll Enrich steps, and done-file mechanisms. They cover combining XML files, concatenating flat files, polling with done-file triggers, and merging entire folders using looping constructs.

## Variant Matrix

| Variant | Trigger | Mechanism | Output |
|---------|---------|-----------|--------|
| Combine XML Files via Poll Enrich | HTTPS sender | SFTP Poll Enrich with aggregation strategy | Merged XML via Message Mapping |
| Concatenating Files via Poll Enrich | HTTPS sender | SFTP Poll Enrich with concatenation | Concatenated flat-file content |
| Poll And Merge Folder | Timer (Start Timer) | Looping SFTP Poll Enrich with counter | All files merged from folder |
| Poll File by Done File | SFTP sender with done file | SFTP sender adapter `doneFileName` | Single file triggered by done file |
| Poll Folder by Fixed Done File | SFTP sender with fixed done file | SFTP sender adapter with fixed `doneFileName` | Single file triggered by named done file |

## Flow Structure

**Combine XML Files via Poll Enrich**: Sender (HTTPS) -> Start -> Content Modifier ("Define file name") -> Poll Enrich (SFTP, fetches file and combines with original message using multimap) -> Content Modifier ("Remove multimap wrapper") -> Content Modifier ("Define content type") -> Message Mapping -> End -> Receiver (ProcessDirect)

**Concatenating Files via Poll Enrich**: Sender (HTTPS) -> Start -> Poll Enrich (SFTP, concatenates fetched file with original) -> Content Modifier ("Define content type") -> End -> Receiver (ProcessDirect)

**Poll And Merge Folder**: Start Timer -> Content Modifier ("Set DataStore Context", initializes counter property) -> Looping Process Call [Local Integration Process: Poll Enrich (SFTP) -> Groovy Script (increment counter)] -> End -> Receiver (ProcessDirect). The loop continues while `${property.counter} > 0` or similar condition. Uses Groovy scripts for counter management.

**Poll File by Done File**: SFTP sender adapter configured with `doneFileName` matching the data file name pattern. When the done file appears, the adapter picks up the data file. Simple flow: Start -> Content Modifier -> End -> Receiver (ProcessDirect).

**Poll Folder by Fixed Done File**: Same as above but uses a fixed done file name (e.g., `file.done`) that triggers pickup of all files in the directory.

## Parameters

| Key | Purpose | Example |
|-----|---------|---------|
| `SFTP Server` | SFTP server host:port | `sftpserver:port` |
| `Sftp Directory` | Remote directory path | `/folder` |
| `Credentials` | SFTP credential name | `sftpcredentials` |
| `Location ID` | Cloud Connector location ID | `location_id` |
| `Proxy Type` | Proxy type for SFTP | `sapcc` |
| `File Name` | File name pattern (done-file variants) | `filename` |
| `Done File Name` | Fixed done file name (fixed done-file variant) | `file.done` |

## Known Gotchas
- Poll Enrich requires an existing message in the pipeline, so it cannot be the first step. Use a Content Modifier or Timer to initialize the message before the Poll Enrich step.
- The "Combine XML Files" variant uses a Message Mapping to merge the multimap output from Poll Enrich into a single XML structure. The multimap wrapper must be removed first.
- The "Poll And Merge Folder" variant uses a counter property with a Groovy Script to track loop iterations. The counter increment script has a post-increment bug (`int newvalue = value++` should be `++value`) -- be aware when adapting this pattern.
- Done-file patterns require the SFTP server to atomically write the done file after the data file is complete. If the done file appears before the data file is fully written, partial data may be read.
- All SFTP parameters are externalized, so the same iFlow can be reused across environments by changing configuration.
