import com.sap.gateway.ip.core.customdev.util.Message;
import java.util.HashMap;
import groovy.xml.XmlUtil;
import groovy.util.XmlParser;
import com.sap.it.api.mapping.*;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Date;

 
def Message processData(Message message) {
//	def pmap = message.getProperties();
	
	def body = message.getBody(java.lang.String) as String;
	def headers = message.getHeaders() as Map<String, Object>;
	def properties = message.getProperties() as Map<String, Object>;
	
	def propertiesAsString ="\n";
	properties.each{ it -> propertiesAsString = propertiesAsString + "${it}" + "\n" };
	
	def headersAsString ="\n";
	headers.each{ it -> headersAsString = headersAsString + "${it}" + "\n" };
	

	def messageLog = messageLogFactory.getMessageLog(message);
	messageLog.addAttachmentAsString("Log Details" ,
"\n***************************************************************************** \n Body: \n" + body + "\n *****************************************************************************\n\n" +
"\n***************************************************************************** \n Properties: \n" + propertiesAsString + "\n *****************************************************************************\n\n" +
"\n***************************************************************************** \n Headers: \n" + headersAsString + "\n *****************************************************************************\n","text/plain");
	return message;
}
