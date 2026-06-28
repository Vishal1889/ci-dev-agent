// Import message object
function processData(message) {
    
    // Get the message body as string
    var body = message.getBody(java.lang.String);
    
    // Parse JSON input
    var json = JSON.parse(body);
    
    // Modify payload (example: add new field)
    json.processedBy = "Cloud Integration";
    json.timestamp = new Date().toISOString();
    
    // Convert back to JSON string
    var updatedBody = JSON.stringify(json);
    
    // Set modified body
    message.setBody(updatedBody);
    
    // Set a custom property
    message.setProperty("ProcessingStatus", "Success");
    
    return message;
}