import { Adapter } from './adapter.js';
import readline from 'readline';

/**
 * Console Adapter
 * 
 * This adapter allows testing the chatbot using the console.
 * It simulates a chat interface using standard input/output.
 */
export class ConsoleAdapter extends Adapter {
  constructor() {
    super();
    this.rl = null;
    this.isRunning = false;
  }

  /**
   * Initialize the console adapter
   * @returns {Promise<void>}
   */
  async initialize() {
    console.log('\x1b[36m%s\x1b[0m', '╭───────────────────────────────────────╮');
    console.log('\x1b[36m%s\x1b[0m', '│         🤖  \x1b[35mLLM-Bot\x1b[0m  🤖               │');
    console.log('\x1b[36m%s\x1b[0m', '│                                       │');
    console.log('\x1b[36m%s\x1b[0m', '│  \x1b[35mConsole Chat Mode Activated       \x1b[0m   │');
    console.log('\x1b[36m%s\x1b[0m', '│  \x1b[35mType \'exit\' to quit               \x1b[0m   │');
    console.log('\x1b[36m%s\x1b[0m', '│                                       │');
    console.log('\x1b[36m%s\x1b[0m', '╰───────────────────────────────────────╯');

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.isRunning = true;
    this.startListening();
    
    return Promise.resolve();
  }

  /**
   * Start listening for user input
   */
  startListening() {
    const promptUser = () => {
      this.rl.question('\x1b[36m👤 You: \x1b[0m', (message) => {
        if (message.toLowerCase() === 'exit') {
          this.close();
          return;
        }

        // Create a simple context object
        const context = {
          quoted: null,
          timestamp: Date.now()
        };

        // Simulate a user ID
        const sender = 'console-user';

        // Call the message handler with the user input
        if (this.messageHandler) {
          this.messageHandler(sender, message, context);
        }

        if (this.isRunning) {
          promptUser();
        }
      });
    };

    promptUser();
  }

  /**
   * Send a message to the console
   * @param {string} recipient - Not used in console adapter
   * @param {string} message - The message to display
   * @returns {Promise<void>}
   */
  async sendMessage(recipient, message) {
    console.log('\x1b[35m🤖 Bot: \x1b[0m' + message);
    return Promise.resolve();
  }

  /**
   * Close the readline interface
   * @returns {Promise<void>}
   */
  async close() {
    this.isRunning = false;
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    console.log('\n\x1b[36mChat session ended. Goodbye!\x1b[0m');
    return Promise.resolve();
  }
}