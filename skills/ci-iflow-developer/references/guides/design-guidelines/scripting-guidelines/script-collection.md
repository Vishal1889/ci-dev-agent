# Script Collection

A Script Collection is a standalone artifact type that packages multiple Groovy scripts into a reusable bundle. Instead of embedding scripts directly in each iFlow, you deploy scripts once in a Script Collection and reference them by bundle ID and function name from any iFlow in the same tenant. This promotes code reuse, centralizes maintenance, and avoids script duplication across integration flows. The Script Collection is deployed independently and referenced at design time via the Script step configuration.

## How Script Collections Work

A Script Collection artifact contains `.groovy` files under `src/main/resources/script/`. Each file can contain multiple functions. When an iFlow references a Script Collection, the Script step specifies:
- `scriptBundleId` -- the artifact ID of the Script Collection
- `script` -- the `.groovy` filename within the collection
- `scriptFunction` -- the entry-point function name to execute

## iFlow Reference Configuration

In the iFlow's `.iflw` file, a Groovy Script step references the collection like this:

```
activityType = Script
subActivityType = GroovyScript
scriptBundleId = My_Script_Collection
script = MyScript.groovy
scriptFunction = myFunction
```

The `scriptBundleId` must match the deployed Script Collection artifact ID exactly. The collection must be deployed to the runtime before any referencing iFlow can deploy successfully.

## Organizing Scripts

Each `.groovy` file in the collection typically groups related functions by domain:
- `MPLAttachment.groovy` -- payload logging functions
- `MPLCustomHeader.groovy` -- custom MPL header functions
- `ParseJson.groovy` -- JSON parsing utilities
- `SecurityMaterial.groovy` -- secure store access
- `ValueMapping.groovy` -- value mapping lookups
- `ReadUrlGetParameters.groovy` -- HTTP query parameter extraction
- `ReadUrlPath.groovy` -- URL path segment extraction
- `MappingFunctions.groovy` -- UDF helper functions for message mappings

## Known Gotchas
- The Script Collection must be deployed before any iFlow that references it; deployment order matters
- Updating a Script Collection requires redeploying all iFlows that reference it for changes to take effect at runtime
- Script Collection artifact IDs are case-sensitive in the `scriptBundleId` reference
- Scripts in a collection share the same classloader; name collisions across `.groovy` files in the same collection will cause unpredictable behavior
