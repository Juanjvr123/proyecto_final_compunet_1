package dtos;

import java.util.HashMap;
import java.util.Map;

/**
 * Response DTO for TCP-JSON communication
 * Flattens into a simple key-value map for JSON serialization
 */
public class Response extends HashMap<String, Object> {
    
    public Response() {
        super();
    }
    
    public void setStatus(String status) {
        put("status", status);
    }
    
    public void setSuccess(boolean success) {
        put("success", success);
    }
    
    public void setMessage(String message) {
        put("message", message);
    }
}
