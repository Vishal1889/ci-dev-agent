# Upload WSDLs as Integration Flow Resource

When an iFlow uses a SOAP adapter, the WSDL can be referenced externally (URL) or uploaded as an embedded resource within the iFlow project. Embedding the WSDL eliminates runtime dependency on the external WSDL endpoint, avoids network failures during deployment, and ensures the contract is version-controlled with the iFlow. This is the recommended approach for production iFlows.

## How It Works

Upload the WSDL file into the iFlow project under `src/main/resources/wsdl/`. The SOAP sender or receiver adapter then references the local WSDL path instead of an external URL. This makes the iFlow self-contained: it deploys and operates without needing to fetch the WSDL at runtime.

## Flow Structure

The iFlow uses a SOAP 1.x sender adapter with the WSDL resource embedded. The adapter configuration references the local WSDL path rather than a remote URL. The namespace mapping on the iFlow collaboration element is configured to match the WSDL's target namespace.

## Known Gotchas
- When the backend WSDL changes, you must re-upload the updated WSDL to the iFlow and redeploy; there is no automatic sync
- Embedded WSDLs with imports/includes must have all referenced schemas also uploaded as iFlow resources
- External WSDL references are acceptable for development/testing but should be replaced with embedded WSDLs before production deployment
- The WSDL file path in the adapter configuration is relative to the iFlow project root
