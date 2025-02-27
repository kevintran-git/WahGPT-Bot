import { LlmService } from './llmService.js';

/**
 * Message Service
 * 
 * This service handles the processing of messages and coordinates
 * between the adapter (WhatsApp, Console) and the LLM service.
 */
export class MessageService {
  /**
   * @param {Object} adapter - Platform adapter
   * @param {Object} options - Configuration options
   */
  constructor(adapter, options = {}) {
    this.adapter = adapter;
    this.llmService = new LlmService(options.llm || {});
    
    // Config options with defaults
    this.config = {
      prefixCommands: true,  // Whether to enable prefix commands like !help
      commandPrefix: '!',    // Prefix for commands
      ...options
    };
    
    // Set up the message handler
    this.adapter.setMessageHandler(this.handleMessage.bind(this));
  }

  /**
   * Initialize the message service
   * @returns {Promise<void>}
   */
  async initialize() {
    console.log('Initializing message service...');
    await this.adapter.initialize();
    console.log('Message service initialized');
  }

  /**
   * Handle incoming messages
   * @param {string} sender - Sender identifier
   * @param {string} message - Message content
   * @param {Object} context - Additional context
   * @returns {Promise<void>}
   */
  async handleMessage(sender, message, context = {}) {
    try {
      // Log incoming message
      console.log(`Received message from ${sender}: ${message}`);
      
      // Check if it's a command
      if (this.config.prefixCommands && message.startsWith(this.config.commandPrefix)) {
        await this.handleCommand(sender, message.substring(this.config.commandPrefix.length), context);
        return;
      }
      
      // Get response from LLM
      const response = await this.llmService.getResponse(sender, message, context);
      
      // Update conversation history
      this.llmService.updateConversationHistory(sender, {
        role: 'user',
        content: message,
        timestamp: Date.now()
      });
      
      this.llmService.updateConversationHistory(sender, {
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      });
      
      // Send response back through the adapter
      await this.adapter.sendMessage(sender, response);
    } catch (error) {
      console.error('Error handling message:', error);
      await this.adapter.sendMessage(sender, 'Sorry, I encountered an error while processing your message.');
    }
  }

  /**
   * Handle command messages
   * @param {string} sender - Sender identifier
   * @param {string} command - Command content (without prefix)
   * @param {Object} context - Additional context
   * @returns {Promise<void>}
   */
  async handleCommand(sender, command, context) {
    const [cmd, ...args] = command.trim().split(/\s+/);
    
    switch (cmd.toLowerCase()) {
      case 'help':
        await this.adapter.sendMessage(sender, `
Available commands:
${this.config.commandPrefix}help - Show this help message
${this.config.commandPrefix}clear - Clear conversation history
${this.config.commandPrefix}ping - Check if bot is responsive
${this.config.commandPrefix}provider - Show current LLM provider
${this.config.commandPrefix}provider list - List available providers
${this.config.commandPrefix}provider set <name> - Switch to a different provider
${this.config.commandPrefix}system <prompt> - Set system prompt
        `.trim());
        break;
        
      case 'clear':
        const result = this.llmService.clearConversationHistory(sender);
        await this.adapter.sendMessage(sender, result.message);
        break;
        
      case 'ping':
        await this.adapter.sendMessage(sender, 'Pong! Bot is responsive.');
        break;
        
      case 'provider':
        await this.handleProviderCommand(sender, args);
        break;
        
      case 'system':
        const promptText = args.join(' ').trim();
        if (!promptText) {
          // Show current system prompt
          const settings = this.llmService.getUserSettings(sender);
          await this.adapter.sendMessage(sender, `Current system prompt: "${settings.systemPrompt}"`);
        } else {
          // Update system prompt
          const updateResult = this.llmService.updateSystemPrompt(sender, promptText);
          await this.adapter.sendMessage(sender, updateResult.message);
        }
        break;
        
      default:
        await this.adapter.sendMessage(sender, `Unknown command: ${cmd}. Type ${this.config.commandPrefix}help for available commands.`);
    }
  }
  
  /**
   * Handle provider-related commands
   * @param {string} sender - Sender identifier
   * @param {Array} args - Command arguments
   * @returns {Promise<void>}
   */
  async handleProviderCommand(sender, args = []) {
    const subCommand = args[0]?.toLowerCase();
    
    // Default: show current provider
    if (!subCommand) {
      const provider = this.llmService.getCurrentProvider();
      await this.adapter.sendMessage(sender, `Current provider: ${provider.name} (Model: ${provider.model})`);
      return;
    }
    
    switch (subCommand) {
      case 'list':
        // List available providers
        const providers = this.llmService.getAvailableProviders();
        let message = 'Available providers:\n';
        
        providers.forEach(provider => {
          const status = provider.isConfigured ? '✅' : '❌';
          message += `- ${provider.id}: ${provider.name} (${provider.model}) ${status}\n`;
        });
        
        message += '\nUse "!provider set <id>" to switch providers.';
        await this.adapter.sendMessage(sender, message);
        break;
        
      case 'set':
        // Switch provider
        const providerId = args[1]?.toLowerCase();
        
        if (!providerId) {
          await this.adapter.sendMessage(sender, 'Please specify a provider ID. Use "!provider list" to see available providers.');
          return;
        }
        
        // Update user settings
        const userSettings = this.llmService.getUserSettings(sender);
        userSettings.provider = providerId;
        this.llmService.getUserSettings(sender, userSettings);
        
        // Switch the provider
        const result = this.llmService.switchProvider(providerId);
        await this.adapter.sendMessage(sender, result.message);
        break;
        
      default:
        await this.adapter.sendMessage(sender, `Unknown subcommand: ${subCommand}. Available options are: list, set`);
    }
  }

  /**
   * Close the message service
   * @returns {Promise<void>}
   */
  async close() {
    await this.adapter.close();
  }
}