/**
 * Search Command Handler
 * 
 * This module handles web search related commands to keep the main MessageService cleaner.
 * It uses the WebSearchService to perform searches and process results.
 */

export class SearchCommandHandler {
  /**
   * @param {Object} adapter - Platform adapter for sending messages
   * @param {Object} webSearchService - Web search service instance
   * @param {Map} userStates - Map to track user states
   */
  constructor(adapter, webSearchService, userStates) {
    this.adapter = adapter;
    this.webSearchService = webSearchService;
    this.userStates = userStates;
  }

  /**
   * Process search-related commands
   * @param {string} sender - Sender identifier
   * @param {string} command - Command name (e.g., 'search', 'open', etc.)
   * @param {Array} args - Command arguments
   * @returns {Promise<boolean>} - True if command was handled, false otherwise
   */
  async handleCommand(sender, command, args) {
    switch (command.toLowerCase()) {
      case 'search':
        const query = args.join(' ').trim();
        if (!query) {
          await this.adapter.sendMessage(sender, 'Please provide a search query. For example: !search climate change');
        } else {
          await this.handleWebSearch(sender, query);
        }
        return true;

      case 'open':
        const resultId = parseInt(args[0]);
        if (isNaN(resultId)) {
          await this.adapter.sendMessage(sender, 'Please specify a valid result number to open. For example: !open 2');
        } else {
          await this.handleOpenResult(sender, resultId);
        }
        return true;

      case 'back':
        await this.handleBackCommand(sender);
        return true;

      case 'link':
        const linkId = parseInt(args[0]);
        if (isNaN(linkId)) {
          await this.adapter.sendMessage(sender, 'Please specify a valid link number to follow. For example: !link 2');
        } else {
          await this.handleLinkCommand(sender, linkId);
        }
        return true;

      case 'more':
        await this.handleMoreCommand(sender);
        return true;

      case 'summarize':
        await this.handleSummarizeCommand(sender);
        return true;

      case 'exit':
        // Exit search/browse mode
        this.userStates.set(sender, { mode: 'chat' });
        await this.adapter.sendMessage(sender, 'Exited search mode. Back to normal chat.');
        return true;
    }

    return false; // Command not handled
  }

  /**
   * Handle a direct search message
   * @param {string} sender - Sender identifier
   * @param {string} message - Message content
   * @returns {Promise<boolean>} - True if handled as search, false otherwise
   */
  async handleDirectMessage(sender, message) {

    if (!this.userStates.has(sender)) {
      this.userStates.set(sender, { mode: 'chat' });
    }

    const userState = this.userStates.get(sender);

    console.log('User State:', userState);
    console.log('Message:', message);

    // Check if this is a command (starts with !)
    if (message.startsWith('!')) {
      // Extract command and args
      const parts = message.substring(1).trim().split(/\s+/);
      const command = parts[0];
      const args = parts.slice(1);

      // Handle the command properly
      return await this.handleCommand(sender, command, args);
    }


    // If user is in browse mode, handle navigation commands
    if (userState && userState.mode === 'browse') {
      if (message.toLowerCase() === 'back') {
        await this.handleBackCommand(sender);
        return true;
      }
      else if (message.toLowerCase() === 'more') {
        await this.handleMoreCommand(sender);
        return true;
      }
      else if (message.toLowerCase().startsWith('link ')) {
        const linkNumber = parseInt(message.substring(5).trim());
        await this.handleLinkCommand(sender, linkNumber);
        return true;
      }
      else if (message.toLowerCase() === 'exit') {
        this.userStates.set(sender, { mode: 'chat' });
        await this.adapter.sendMessage(sender, 'Exited search mode. Back to normal chat.');
        return true;
      }
      else {
        // Treat as a new search
        await this.handleWebSearch(sender, message);
        return true;
      }
    }

    // Check if message starts with "search "
    if (message.toLowerCase().startsWith('search ')) {
      await this.handleWebSearch(sender, message.substring(7).trim());
      return true;
    }

    return false; // Not handled as search
  }

  /**
   * Handle web search command
   * @param {string} sender - Sender identifier
   * @param {string} query - Search query
   * @returns {Promise<void>}
   */
  async handleWebSearch(sender, query) {
    try {
      await this.adapter.sendMessage(sender, `🔍 Searching for: "${query}"...`);

      // Perform web search
      const results = await this.webSearchService.searchWeb(query, sender);

      // Format results as a message
      const formattedResults = this.webSearchService.formatSearchResultsMessage(results);

      // Update user state
      this.userStates.set(sender, {
        mode: 'browse',
        lastAction: 'search',
        query
      });

      // Send search results
      await this.adapter.sendMessage(sender, formattedResults);
    } catch (error) {
      console.error('Error handling web search:', error);
      await this.adapter.sendMessage(sender, `Sorry, I encountered an error while searching: ${error.message}`);
    }
  }

  /**
   * Handle opening a search result
   * @param {string} sender - Sender identifier
   * @param {number} resultId - Result ID to open
   * @returns {Promise<void>}
   */
  async handleOpenResult(sender, resultId) {
    try {
      // Get the search result by ID
      const result = this.webSearchService.getSearchResultById(sender, resultId);

      if (!result) {
        await this.adapter.sendMessage(sender, 'Sorry, I couldn\'t find that search result. Please try searching again.');
        return;
      }

      await this.adapter.sendMessage(sender, `📄 Opening: "${result.title}"...`);

      // Browse the webpage
      const content = await this.webSearchService.browseWebpage(result.link, sender);

      // Format content as a message
      const formattedContent = this.webSearchService.formatWebpageContentMessage(content);

      // Update user state
      this.userStates.set(sender, {
        mode: 'browse',
        lastAction: 'open',
        currentUrl: result.link,
        resultId: resultId
      });

      // Send webpage content
      await this.adapter.sendMessage(sender, formattedContent);
    } catch (error) {
      console.error('Error opening search result:', error);
      await this.adapter.sendMessage(sender, `Sorry, I encountered an error opening that page: ${error.message}`);
    }
  }

  /**
   * Handle back command (return to search results)
   * @param {string} sender - Sender identifier
   * @returns {Promise<void>}
   */
  async handleBackCommand(sender) {
    try {

      if (!this.userStates.has(sender)) {
        this.userStates.set(sender, { mode: 'chat' });
        await this.adapter.sendMessage(sender, 'There\'s no previous state to go back to.');
        return;
      }

      const userState = this.userStates.get(sender);


      if (!userState) {
        this.userStates.set(sender, { mode: 'chat' });
        await this.adapter.sendMessage(sender, 'There\'s no previous state to go back to.');
        return;
      }

      if (userState.lastAction === 'search') {
        // Already at search results
        await this.adapter.sendMessage(sender, 'You\'re already at the search results.');
        return;
      }

      if (userState.query) {
        // Go back to search results
        await this.handleWebSearch(sender, userState.query);
      } else {
        // No search query in state
        await this.adapter.sendMessage(sender, 'No search results available. Please try a new search.');
        this.userStates.set(sender, { mode: 'chat' });
      }
    } catch (error) {
      console.error('Error handling back command:', error);
      await this.adapter.sendMessage(sender, `Sorry, I encountered an error going back: ${error.message}`);
    }
  }

  /**
   * Handle link command (follow a link from current page)
   * @param {string} sender - Sender identifier
   * @param {number} linkId - Link ID to follow
   * @returns {Promise<void>}
   */
  async handleLinkCommand(sender, linkId) {
    try {
      await this.adapter.sendMessage(sender, `🔗 Following link #${linkId}...`);

      // Follow the link
      const content = await this.webSearchService.followLink(sender, linkId);

      // Format content as a message
      const formattedContent = this.webSearchService.formatWebpageContentMessage(content);

      // Update user state
      const userState = this.userStates.get(sender);
      this.userStates.set(sender, {
        ...userState,
        lastAction: 'link',
        currentUrl: content.url
      });

      // Send webpage content
      await this.adapter.sendMessage(sender, formattedContent);
    } catch (error) {
      console.error('Error following link:', error);
      await this.adapter.sendMessage(sender, `Sorry, I couldn't follow that link: ${error.message}`);
    }
  }

  /**
   * Handle more command (show more content from current page)
   * @param {string} sender - Sender identifier
   * @returns {Promise<void>}
   */
  async handleMoreCommand(sender) {
    try {
      // Get more content
      const moreContent = this.webSearchService.getMoreContent(sender);

      if (!moreContent || moreContent.length === 0) {
        await this.adapter.sendMessage(sender, 'Sorry, there\'s no more content available for this page.');
        return;
      }

      // Send more content
      await this.adapter.sendMessage(sender, `*More Content:*\n\n${moreContent}\n\n(Type *!more* again for additional content)`);
    } catch (error) {
      console.error('Error getting more content:', error);
      await this.adapter.sendMessage(sender, `Sorry, I encountered an error getting more content: ${error.message}`);
    }
  }

  /**
* Handle summarize command (summarize current webpage content)
* @param {string} sender - Sender identifier
* @returns {Promise<void>}
*/
  async handleSummarizeCommand(sender) {
    try {
      const userState = this.userStates.get(sender);

      // Check if user is in browse mode and viewing a webpage
      if (!userState || userState.mode !== 'browse' || !userState.currentUrl) {
        await this.adapter.sendMessage(sender, 'Please open a webpage first before using the summarize command.');
        return;
      }

      await this.adapter.sendMessage(sender, '📝 Generating summary of current webpage...');

      // Get the current webpage content
      const content = this.webSearchService.currentWebpageContent.get(sender);
      if (!content || !content.content) {
        await this.adapter.sendMessage(sender, 'Sorry, I couldn\'t retrieve the current webpage content.');
        return;
      }

      // Create a summarization prompt
      const title = content.content.title;
      const fullContent = content.content.fullTextContent || content.content.textContent;
      const prompt = `Please provide a concise summary of the following webpage content. Focus on the main points and key information:\n\nTitle: ${title}\n\nContent: ${fullContent}`;

      // Send the summarization request through the adapter
      // This works because the adapter will route it to the MessageService which handles LLM responses
      await this.adapter.sendMessage(sender, `!summarize_webpage ${prompt}`);
    } catch (error) {
      console.error('Error handling summarize command:', error);
      await this.adapter.sendMessage(sender, `Sorry, I encountered an error summarizing this webpage: ${error.message}`);
    }
  }
}