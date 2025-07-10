/**
 * BladeZ Application Configuration
 * Central configuration for all backend connections
 */

// Backend URL (Render)
const BACKEND_URL = 'https://bladez-backend.onrender.com'; // Ensure this matches your backend URL
const DEBUG = false; // Set to true to enable detailed logging

// API helper for consistent backend calls
const apiService = {
  // Base GET request with error handling
  async get(endpoint, options = {}) {
    try {
      const url = `${BACKEND_URL}${endpoint}`;
      if (DEBUG) console.log(`Making GET request to: ${url}`);
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorDetails = await response.text(); // Capture response body for debugging
        console.error(`API error: ${response.status} - ${response.statusText}`, errorDetails);
        throw new Error(`API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch ${endpoint}:`, error.message);
      throw error; // Re-throw the error for the caller to handle
    }
  },
  
  // Base POST request with error handling
  async post(endpoint, data, options = {}) {
    try {
      console.log(`Making POST request to: ${BACKEND_URL}${endpoint}`);
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: JSON.stringify(data),
        ...options
      });
      
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Failed to post to ${endpoint}:`, error);
      throw error;
    }
  }
};

// Make services available globally
window.BACKEND_URL = BACKEND_URL;
window.apiService = apiService;

// For CommonJS environments (Node.js backend)
if (typeof module !== 'undefined') {
  module.exports = { BACKEND_URL };
}
if (typeof module !== 'undefined') {
  module.exports = { BACKEND_URL, IMAGE_BASE_PATH };
}
