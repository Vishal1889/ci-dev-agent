# Mapping Context

The Mapping Context pattern demonstrates how to use Message Mapping with context-aware transformations. In CPI Message Mapping, "context" refers to the hierarchical level at which mapping operations (such as aggregation, counting, or conditional logic) are evaluated. Changing the context of a source or target field changes how values are grouped and processed during the mapping.

## Flow Structure

Sender (HTTPS) -> Start -> Message Mapping -> Content Modifier ("Define context for monitoring purposes") -> End -> Receiver (ProcessDirect)

The Message Mapping step contains the mapping logic where context changes are applied to source fields to control how they map to target fields.

## Known Gotchas
- Context changes in Message Mapping are set in the graphical mapping editor by right-clicking a source field and selecting "Change Context." This is a design-time operation, not a runtime configuration.
- A common use case is mapping a flat list of items to a grouped/nested structure: changing the context of a grouping field creates the parent-child relationship.
- Context errors are the most common source of incorrect mapping output. If the mapping produces too many or too few target records, check whether the context of source fields is set correctly.
- The "context" concept in Message Mapping is unrelated to CPI exchange properties or headers. It is purely a mapping-engine concept that controls iteration and grouping within the transformation.
