import { Adapter } from './adapter.js';
import ws from '@whiskeysockets/baileys';
import { remove } from 'fs-extra';
import P from 'pino';
import { Boom } from '@hapi/boom';
import { serialize, extractMessageContent, extractQuotedContext } from '../utils/serializer.js';

/**
 * WhatsApp Adapter
 * 
 * This adapter implements the WhatsApp integration using baileys.
 */
export class WhatsAppAdapter extends Adapter {
  /**
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    super();
    this.config = {
      sessionDir: 'session',
      printQRInTerminal: true,
      logLevel: 'silent',
      ...config
    };
    
    this.client = null;
    this.state = null;
    this.saveCreds = null;
  }

  /**
   * Initialize the WhatsApp connection
   * @returns {Promise<void>}
   */
  async initialize() {
    console.log('\x1b[36m%s\x1b[0m', '╭───────────────────────────────────────╮');
    console.log('\x1b[36m%s\x1b[0m', '│         🤖  \x1b[35mLLM-Bot\x1b[0m  🤖               │');
    console.log('\x1b[36m%s\x1b[0m', '│                                       │');
    console.log('\x1b[36m%s\x1b[0m', '│  \x1b[35mWhatsApp Mode Activated          \x1b[0m   │');
    console.log('\x1b[36m%s\x1b[0m', '│                                       │');
    console.log('\x1b[36m%s\x1b[0m', '╰───────────────────────────────────────╯');

    const { useMultiFileAuthState, fetchLatestBaileysVersion, default: makeWASocket, DisconnectReason } = ws;

    try {
      // Load auth state
      const authState = await useMultiFileAuthState(this.config.sessionDir);
      this.state = authState.state;
      this.saveCreds = authState.saveCreds;

      // Create WhatsApp socket
      this.client = makeWASocket({
        version: (await fetchLatestBaileysVersion()).version,
        auth: this.state,
        logger: P({ level: this.config.logLevel }),
        printQRInTerminal: this.config.printQRInTerminal
      });

      // Set up connection update handler
      this.client.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (update.qr) console.log(`📱 Scan the QR code to connect!`);
        
        if (connection === 'close') {
          const statusCode = new Boom(lastDisconnect?.error).output.statusCode;
          
          if (statusCode !== DisconnectReason.loggedOut) {
            console.log('🔄 Reconnecting...');
            this.initialize();
          } else {
            console.log('❌ Logged out. Clearing session...');
            await remove(this.config.sessionDir);
            console.log('🔄 Restarting...');
            this.initialize();
          }
        }
        
        if (connection === 'connecting') console.log('🔗 Connecting to WhatsApp...');
        if (connection === 'open') console.log('✅ Connected to WhatsApp');
      });

      // Set up message handler
      this.client.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        // Get the first message
        const message = JSON.parse(JSON.stringify(messages[0]));
        const serialized = serialize(message, this.client);
        
        // Skip self-messages
        if (serialized.isSelf) return;
        
        // Extract content
        const content = extractMessageContent(serialized);
        const quotedContext = extractQuotedContext(serialized);
        
        // Create context object
        const context = {
          quoted: quotedContext,
          platform: 'whatsapp',
          serialized
        };
        
        // Call the message handler
        if (this.messageHandler && content) {
          console.log(`Received message from ${serialized.sender}: ${content}`);
          this.messageHandler(serialized.sender, content, context);
        }
      });

      // Set up credentials update handler
      this.client.ev.on('creds.update', this.saveCreds);

      return Promise.resolve();
    } catch (error) {
      console.error('Error initializing WhatsApp adapter:', error);
      return Promise.reject(error);
    }
  }

  /**
   * Send a message to a WhatsApp recipient
   * @param {string} recipient - Recipient JID
   * @param {string} message - Message content
   * @returns {Promise<Object>} - Message info
   */
  async sendMessage(recipient, message) {
    try {
      console.log(`Sending message to ${recipient}`);
      
      // Send the message
      const result = await this.client.sendMessage(recipient, { text: message });
      return Promise.resolve(result);
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return Promise.reject(error);
    }
  }

  /**
   * Close the WhatsApp connection
   * @returns {Promise<void>}
   */
  async close() {
    if (this.client) {
      console.log('Closing WhatsApp connection...');
      this.client.end();
      this.client = null;
    }
    return Promise.resolve();
  }
}