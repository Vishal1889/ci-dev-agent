importClass(com.sap.gateway.ip.core.customdev.util.Message);
importClass(java.lang.System);

function processData(message) {
    
    // Read the environment variable from system properties
    var hcHostSvc = System.getProperty("HC_HOST_SVC");

    // Store it as a message property
    message.setProperty("HC_HOST_SVC_VALUE", hcHostSvc);

    // Optional: Put it into the body for testing
    var body = "<EnvironmentDetails><HC_HOST_SVC>" + hcHostSvc + "</HC_HOST_SVC></EnvironmentDetails>";
    message.setBody(body);

    return message;
}