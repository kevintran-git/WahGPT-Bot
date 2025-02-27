import { ConsoleAdapter } from './adapters/consoleAdapter.js';
import { WhatsAppAdapter } from './adapters/whatsappAdapter.js';
import { MessageService } from './services/messageService.js';
import dotenv from 'dotenv';

/**
 * Main entry point for the application
 * Chooses the appropriate adapter based on command line arguments
 */
const main = async () => {
  try {
    // Load environment variables from .env file
    dotenv.config();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const useWhatsApp = args.includes('--whatsapp') || args.includes('-w');
    
    // Create the appropriate adapter
    const adapter = useWhatsApp 
      ? new WhatsAppAdapter()
      : new ConsoleAdapter();
    
    // LLM service configuration
    const llmConfig = {
      // Configuration settings for the LLM service
      defaultProvider: process.env.DEFAULT_PROVIDER || 'openai',
      maxHistoryLength: 10,
      contextLimit: 4000
    };

    const webSearchConfig = {
      serperApiKey: process.env.SERPER_API_KEY,
      searchResultsLimit: 5,
      contentSummaryLength: 1500
    };
    
    // Create and initialize the message service
    // Here's the fix: create an instance of MessageService
    const messageService = new MessageService(adapter, { 
      llm: llmConfig,
      webSearch: webSearchConfig,
      prefixCommands: true,
      commandPrefix: '!'
    });
    
    // Initialize the service
    await messageService.initialize();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nReceived SIGINT. Shutting down...');
      await messageService.close();
      process.exit(0);
    });
    
    console.log(`LLM Bot started in ${useWhatsApp ? 'WhatsApp' : 'Console'} mode.`);
    console.log(`Using ${llmConfig.mockResponses ? 'mock responses' : 'production LLM API'}.`);
    
    if (!useWhatsApp) {
      console.log('\nType your messages below. Type "exit" to quit.');
    }
  } catch (error) {
    console.error('Error starting application:', error);
    process.exit(1);
  }
};

// Run the main function
main();