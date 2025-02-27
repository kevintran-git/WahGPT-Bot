/**
 * Base Adapter Interface
 * 
 * This class defines the interface that all platform adapters must implement.
 * It serves as a contract for creating new adapters (WhatsApp, Console, etc.)
 */
export class Adapter {
    /**
     * Initialize the adapter
     * @returns {Promise<void>}
     */
    async initialize() {
      throw new Error('Method not implemented');
    }
  
    /**
     * Send a message to a recipient
     * @param {string} recipient - The recipient identifier
     * @param {string} message - The message content
     * @returns {Promise<void>}
     */
    async sendMessage(recipient, message) {
      throw new Error('Method not implemented');
    }
  
    /**
     * Set the callback function to be called when a message is received
     * @param {Function} callback - Function that takes (sender, message, context) parameters
     */
    setMessageHandler(callback) {
      this.messageHandler = callback;
    }
  
    /**
     * Close the adapter connection
     * @returns {Promise<void>}
     */
    async close() {
      throw new Error('Method not implemented');
    }
  }