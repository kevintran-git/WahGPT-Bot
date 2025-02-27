import OpenAI from 'openai';

/**
 * LLM Service
 * 
 * This service handles interactions with language models using various providers.
 * It supports switching between providers with compatible OpenAI-like APIs.
 */
export class LlmService {
  constructor(config = {}) {
    // Default configuration
    this.config = {
      defaultProvider: 'openai',
      maxHistoryLength: 10,
      contextLimit: 4000, // Approximate token limit for context window
      defaultSystemPrompt: 'You are a helpful assistant. Be concise and friendly in your responses.',
      ...config
    };
    
    // Available LLM providers configuration
    this.providers = {
      openai: {
        name: 'OpenAI',
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        model: process.env.OPENAI_MODEL || 'gpt-4o'
      },
      google: {
        name: 'Google AI',
        apiKey: process.env.GOOGLE_API_KEY,
        baseURL: process.env.GOOGLE_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: process.env.GOOGLE_MODEL || 'gemini-2.0-pro-exp-02-05'
      },
      groq: {
        name: 'Groq',
        apiKey: process.env.GROQ_API_KEY,
        baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
        model: process.env.GROQ_MODEL || 'deepseek-r1-distill-llama-70b'
      },
      claude: {
        name: 'Claude',
        apiKey: process.env.CLAUDE_API_KEY,
        baseURL: process.env.CLAUDE_BASE_URL || 'https://claude.kinzerfest.workers.dev/v1',
        model: process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-latest'
      },
      openrouter: {
        name: 'OpenRouter',
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-r1:free'
      }
    };
    
    // Initialize the OpenAI client with the default provider
    this.currentProvider = this.config.defaultProvider;
    this.initializeClient();
    
    // In-memory conversation history for context
    this.conversations = new Map();
    this.userSettings = new Map();
  }

  /**
   * Initialize the OpenAI client with the current provider settings
   */
  initializeClient() {
    const provider = this.providers[this.currentProvider];
    
    if (!provider) {
      throw new Error(`Unknown provider: ${this.currentProvider}`);
    }
    
    if (!provider.apiKey) {
      throw new Error(`API key not configured for provider: ${provider.name}`);
    }
    
    console.log(`Initializing LLM client with provider: ${provider.name}`);
    
    // Create a new OpenAI client with the provider's configuration
    this.client = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseURL,
      dangerouslyAllowBrowser: true // For testing purposes
    });
  }

  /**
   * Switch to a different LLM provider
   * @param {string} providerName - Name of the provider to switch to
   * @returns {Object} - Result of the switch operation
   */
  switchProvider(providerName) {
    if (!this.providers[providerName]) {
      return {
        success: false,
        message: `Unknown provider: ${providerName}. Available providers: ${Object.keys(this.providers).join(', ')}`
      };
    }
    
    const provider = this.providers[providerName];
    
    if (!provider.apiKey) {
      return {
        success: false,
        message: `API key not configured for provider: ${provider.name}. Please set the ${providerName.toUpperCase()}_API_KEY environment variable.`
      };
    }
    
    // Switch the provider
    this.currentProvider = providerName;
    this.initializeClient();
    
    return {
      success: true,
      message: `Switched to ${provider.name} using model: ${provider.model}`
    };
  }

  /**
   * Get the current provider configuration
   * @returns {Object} - Current provider config
   */
  getCurrentProvider() {
    return {
      name: this.providers[this.currentProvider].name,
      model: this.providers[this.currentProvider].model
    };
  }

  /**
   * Get a list of available providers
   * @returns {Array} - List of provider information
   */
  getAvailableProviders() {
    return Object.entries(this.providers).map(([key, provider]) => ({
      id: key,
      name: provider.name,
      model: provider.model,
      isConfigured: !!provider.apiKey
    }));
  }

  /**
   * Get or set user-specific settings
   * @param {string} userId - User identifier
   * @param {Object} settings - Settings to update (optional)
   * @returns {Object} - Current user settings
   */
  getUserSettings(userId, settings = null) {
    // Initialize default settings if they don't exist
    if (!this.userSettings.has(userId)) {
      this.userSettings.set(userId, {
        systemPrompt: this.config.defaultSystemPrompt,
        provider: this.currentProvider
      });
    }
    
    // Update settings if provided
    if (settings) {
      const currentSettings = this.userSettings.get(userId);
      this.userSettings.set(userId, { ...currentSettings, ...settings });
    }
    
    return this.userSettings.get(userId);
  }

  /**
   * Get a response from the LLM
   * @param {string} userId - User identifier
   * @param {string} message - User message
   * @param {Object} context - Additional context
   * @returns {Promise<string>} - LLM response
   */
  async getResponse(userId, message, context = {}) {
    try {
      // Get user-specific settings
      const settings = this.getUserSettings(userId);
      
      // Check if we need to use a different provider for this user
      if (settings.provider !== this.currentProvider) {
        const switchResult = this.switchProvider(settings.provider);
        if (!switchResult.success) {
          // Fallback to current provider
          console.warn(`Failed to switch provider for user ${userId}: ${switchResult.message}`);
        }
      }
      
      // Add the new message to conversation history
      this.updateConversationHistory(userId, {
        role: 'user',
        content: message,
        timestamp: Date.now()
      });
      
      // Prepare messages for the API
      const messages = this.prepareMessagesForApi(userId, settings);
      
      // Include quoted message context if available
      if (context.quoted && context.quoted.text) {
        // Find the last user message
        const lastUserMessageIndex = messages.findLastIndex(msg => msg.role === 'user');
        
        if (lastUserMessageIndex !== -1) {
          // Add quoted context to the user's message
          const quotedPrefix = `(In response to: "${context.quoted.text}")`;
          messages[lastUserMessageIndex].content = `${quotedPrefix}\n\n${messages[lastUserMessageIndex].content}`;
        }
      }
      
      // Get the current provider configuration
      const provider = this.providers[this.currentProvider];
      
      // Make the API call
      const response = await this.client.chat.completions.create({
        model: provider.model,
        messages: messages
      });
      
      // Extract the response text
      const responseText = response.choices[0].message.content;
      
      // Add the response to conversation history
      this.updateConversationHistory(userId, {
        role: 'assistant',
        content: responseText,
        timestamp: Date.now()
      });
      
      return responseText;
    } catch (error) {
      console.error('Error getting LLM response:', error);
      return `Sorry, I encountered an error while processing your request. Error details: ${error.message}`;
    }
  }

  /**
   * Prepare messages for the API call including conversation history
   * @param {string} userId - User identifier
   * @param {Object} settings - User settings
   * @returns {Array} - Messages formatted for the API
   */
  prepareMessagesForApi(userId, settings) {
    // Get recent conversation history
    const history = this.getConversationHistory(userId, this.config.maxHistoryLength);
    
    // Start with the system message
    const messages = [
      {
        role: 'system',
        content: settings.systemPrompt || this.config.defaultSystemPrompt
      }
    ];
    
    // Add conversation history
    history.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });
    
    return messages;
  }

  /**
   * Get conversation history for a user
   * @param {string} userId - User identifier
   * @param {number} limit - Maximum number of messages to retrieve
   * @returns {Array} - Conversation history
   */
  getConversationHistory(userId, limit = 10) {
    if (!this.conversations.has(userId)) {
      return [];
    }
    
    const history = this.conversations.get(userId);
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Update conversation history
   * @param {string} userId - User identifier
   * @param {Object} message - Message object
   */
  updateConversationHistory(userId, message) {
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, []);
    }
    
    const history = this.conversations.get(userId);
    history.push(message);
    
    // Apply history length limit
    const maxLength = this.config.maxHistoryLength * 2; // User + assistant messages
    if (history.length > maxLength) {
      // Remove oldest messages, but keep in pairs (user + assistant)
      const excessMessages = history.length - maxLength;
      history.splice(0, excessMessages);
    }
  }

  /**
   * Clear conversation history for a user
   * @param {string} userId - User identifier
   */
  clearConversationHistory(userId) {
    this.conversations.delete(userId);
    return { success: true, message: 'Conversation history cleared.' };
  }

  /**
   * Update system prompt for a user
   * @param {string} userId - User identifier
   * @param {string} prompt - New system prompt
   * @returns {Object} - Result of the operation
   */
  updateSystemPrompt(userId, prompt) {
    try {
      const settings = this.getUserSettings(userId);
      settings.systemPrompt = prompt;
      this.getUserSettings(userId, settings);
      return { success: true, message: 'System prompt updated.' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}