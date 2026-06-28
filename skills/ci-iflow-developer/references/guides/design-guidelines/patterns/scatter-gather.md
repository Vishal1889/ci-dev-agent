# Scatter-Gather

The Scatter-Gather pattern broadcasts a request to multiple receivers (Scatter), collects their responses, and aggregates the results into a single consolidated response (Gather). In SAP CPI, this is implemented using multiple integration processes: a Scatter process that sends the request to multiple receivers via ProcessDirect, and a Gather process that collects responses and merges them. This pattern is useful for scenarios like bidding/quoting (send RFQ to multiple banks, collect bids) or data enrichment from multiple sources where all responses must be consolidated. Reference template `05-multicast-parallel-fanout.iflw` for the base multicast structure.

## Flow Structure

This pattern uses multiple Integration Processes connected via ProcessDirect:

**Scatter Process** (Integration Process - Scatter):
Sender (HTTPS) -> Start -> [send request to multiple receivers via ProcessDirect to Bank A, B, C] -> End

**Gather Process** (Integration Process - Gather):
GatherSender (HTTPS) -> Start -> [collect responses, merge/aggregate] -> End -> Receiver (ProcessDirect)

**Check Process** (Integration Process - Check if bidding process is still active):
Validates whether the bidding/gathering window is still open before accepting a response.

Key structural elements:
- The Scatter process receives the initial request and forwards it to multiple receiver participants (BankA, BankB, BankC) via separate ProcessDirect adapters
- Each receiver independently processes the request and sends its response to the Gather endpoint
- The Gather process collects responses and uses aggregation logic to merge them
- A timer or condition check determines when the gathering phase is complete (e.g., all expected responses received, or timeout exceeded)

## Known Gotchas

- **Response timeout**: not all receivers may respond within the expected window. The Gather process must handle partial responses (e.g., only 2 of 3 banks respond). Implement a timeout mechanism or expected-count check.
- **Correlation**: each scattered request must carry a correlation ID so the Gather process can match responses to the original request. Use a unique message ID set by the Scatter process and propagated via headers.
- **Ordering**: responses arrive asynchronously and in unpredictable order. The Gather process should not assume any arrival sequence.
- **Duplicate responses**: if a receiver retries its response (e.g., due to network issues), the Gather process may receive duplicates. Implement idempotent handling in the Gather logic.
- **Scatter-Gather differs from Multicast + Gather**: in Composed Message Processor, the Gather step is a flow element within the same integration process. In Scatter-Gather, the Gather is a separate integration process receiving asynchronous callbacks. This enables cross-process and even cross-iFlow aggregation but requires explicit correlation and timeout management.
- **ProcessDirect coupling**: the Scatter and Gather processes are typically in the same iFlow or package. If the Gather endpoint is unavailable, scattered requests succeed but responses have nowhere to go. Deploy Scatter and Gather together.
