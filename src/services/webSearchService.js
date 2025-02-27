import axios from 'axios';
import read from 'node-readability';
import { convert } from 'html-to-text';
import * as cheerio from 'cheerio';
import { promisify } from 'util';

// Promisify the node-readability function for better async handling
const readAsync = promisify(read);

/**
 * Web Search Service
 * 
 * This service provides web search and browsing capabilities.
 * It uses Serper for search and node-readability for web scraping.
 */
export class WebSearchService {
  constructor(config = {}) {
    this.config = {
      serperApiKey: process.env.SERPER_API_KEY,
      serperApiUrl: 'https://google.serper.dev/search',
      searchResultsLimit: 5,
      contentSummaryLength: 1000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      ...config
    };

    // Initialize axios with default headers
    this.axiosInstance = axios.create({
      headers: {
        'User-Agent': this.config.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000 // 15 seconds timeout
    });

    // Store the current search results for navigation
    this.currentSearchResults = new Map();
    this.currentWebpageContent = new Map();
    // Add this new Map to track content positions
    this.contentPositions = new Map();
  }

  /**
   * Search the web using Serper API
   * @param {string} query - Search query
   * @param {string} userId - User identifier for storing results
   * @returns {Promise<Object>} - Search results
   */
  async searchWeb(query, userId) {
    try {
      if (!this.config.serperApiKey) {
        throw new Error('Serper API key is not configured. Please set the SERPER_API_KEY environment variable.');
      }

      console.log(`Searching web for: "${query}"`);

      const response = await axios.post(
        this.config.serperApiUrl,
        { q: query },
        {
          headers: {
            'X-API-KEY': this.config.serperApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      // Extract and format the search results
      const formattedResults = this.formatSearchResults(response.data);

      // Store the results for this user
      this.currentSearchResults.set(userId, formattedResults);

      return formattedResults;
    } catch (error) {
      console.error('Error searching web:', error);
      throw new Error(`Failed to search the web: ${error.message}`);
    }
  }

  /**
   * Format search results into a more usable structure
   * @param {Object} searchData - Raw search results from Serper
   * @returns {Object} - Formatted search results
   */
  formatSearchResults(searchData) {
    const formatted = {
      organic: [],
      knowledge: null,
      answerBox: null,
      peopleAlsoAsk: []
    };

    // Extract organic search results
    if (searchData.organic && Array.isArray(searchData.organic)) {
      formatted.organic = searchData.organic.slice(0, this.config.searchResultsLimit).map((result, index) => ({
        id: index + 1,
        title: result.title,
        link: result.link,
        snippet: result.snippet,
        position: result.position,
        type: 'organic'
      }));
    }

    // Extract knowledge graph if available
    if (searchData.knowledgeGraph) {
      formatted.knowledge = {
        title: searchData.knowledgeGraph.title,
        type: searchData.knowledgeGraph.type,
        description: searchData.knowledgeGraph.description,
        attributes: searchData.knowledgeGraph.attributes
      };
    }

    // Extract answer box if available
    if (searchData.answerBox) {
      formatted.answerBox = {
        title: searchData.answerBox.title,
        answer: searchData.answerBox.answer,
        snippet: searchData.answerBox.snippet
      };
    }

    // Extract "People also ask" questions
    if (searchData.peopleAlsoAsk && Array.isArray(searchData.peopleAlsoAsk)) {
      formatted.peopleAlsoAsk = searchData.peopleAlsoAsk.slice(0, 3).map(item => ({
        question: item.question,
        answer: item.answer
      }));
    }

    return formatted;
  }

  /**
   * Get a specific search result by ID for a user
   * @param {string} userId - User identifier
   * @param {number} resultId - Result ID to retrieve
   * @returns {Object|null} - The search result or null if not found
   */
  getSearchResultById(userId, resultId) {
    const results = this.currentSearchResults.get(userId);

    if (!results || !results.organic) {
      return null;
    }

    return results.organic.find(result => result.id === resultId) || null;
  }

  /**
   * Browse a webpage and extract its content
   * @param {string} url - URL to browse
   * @param {string} userId - User identifier for storing content
   * @returns {Promise<Object>} - Extracted webpage content
   */
  async browseWebpage(url, userId) {
    try {
      console.log(`Browsing webpage: ${url}`);

      // Use node-readability to fetch and parse the webpage
      const article = await readAsync(url, {
        // Pass request headers that might be needed for some sites
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      // Extract content from the article
      const extractedContent = await this.processArticle(article, url);

      // Close the article to prevent memory leaks
      article.close();

      // Store the content for this user
      this.currentWebpageContent.set(userId, {
        url,
        content: extractedContent
      });

      return extractedContent;
    } catch (error) {
      console.error('Error browsing webpage:', error);
      throw new Error(`Failed to browse the webpage: ${error.message}`);
    }
  }

  /**
 * Process article object from node-readability
 * @param {Object} article - Article from node-readability
 * @param {string} url - Original URL
 * @returns {Object} - Processed content
 */
  async processArticle(article, url) {
    try {
      // Extract basic information
      const title = article.title || 'Untitled';
      const content = article.content || '';
      const textContent = article.textBody || '';

      // Convert HTML content to plain text for better readability
      const plainText = convert(content, {
        wordwrap: 130,
        selectors: [
          { selector: 'a', options: { ignoreHref: false } },
          { selector: 'img', format: 'skip' }
        ]
      });

      // Extract links from the content - passing the full document for better link extraction
      const links = this.extractLinks(article.document, url);

      // Create a summary or excerpt
      const excerpt = textContent.trim().split('\n')[0] || '';

      // Truncate content if needed
      const truncatedText = plainText.length > this.config.contentSummaryLength
        ? plainText.substring(0, this.config.contentSummaryLength) + '...'
        : plainText;

      return {
        title,
        siteName: this.extractSiteName(url, article.document),
        excerpt,
        textContent: truncatedText,
        fullTextContent: plainText,
        url,
        links: links.slice(0, 15)  // Show more links (up to 15)
      };
    } catch (error) {
      console.error('Error processing article:', error);
      // Return basic info if processing fails
      return {
        title: article.title || 'Content Processing Failed',
        textContent: article.textBody || 'Could not process content from this webpage.',
        url
      };
    }
  }
  /**
   * Extract site name from URL or document
   * @param {string} url - URL of the page
   * @param {Object} document - DOM document
   * @returns {string} - Site name
   */
  extractSiteName(url, document) {
    try {
      // Try to get site name from meta tags
      const metaSiteName = document.querySelector('meta[property="og:site_name"]');
      if (metaSiteName && metaSiteName.getAttribute('content')) {
        return metaSiteName.getAttribute('content');
      }

      // Fallback to domain name from URL
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      return domain;
    } catch (error) {
      // Just return the domain part of the URL
      try {
        const urlObj = new URL(url);
        return urlObj.hostname;
      } catch (e) {
        return '';
      }
    }
  }


  /**
   * Extract links from document
   * @param {Object} document - DOM document
   * @param {string} baseUrl - Base URL for resolving relative links
   * @returns {Array} - Array of link objects
   */
  extractLinks(document, baseUrl) {
    const links = [];
    const seenUrls = new Set(); // Track duplicates

    try {
      // Load the document into cheerio for better parsing
      const $ = cheerio.load(document.documentElement.outerHTML);

      // File extensions to filter out
      const fileExtensions = /\.(jpg|jpeg|png|gif|bmp|svg|webp|pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|tar|gz|mp3|mp4|avi|mov|wav|flac|ogg)$/i;

      // Filter for non-navigable URLs
      const nonNavigablePatterns = [
        /^javascript:/i,
        /^mailto:/i,
        /^tel:/i,
        /^sms:/i,
        /^#$/,           // Empty fragment
        /^data:/i,       // Data URIs
        /^blob:/i        // Blob URLs
      ];

      // Helper function to check if URL should be excluded
      const shouldExcludeUrl = (url) => {
        if (!url) return true;

        // Check against non-navigable patterns
        for (const pattern of nonNavigablePatterns) {
          if (pattern.test(url)) return true;
        }

        // Check file extensions
        if (fileExtensions.test(url)) return true;

        return false;
      };

      // Process all anchor elements
      $('a').each((_, element) => {
        const $element = $(element);
        const href = $element.attr('href');

        if (!href) return; // Skip links without href

        // Skip if non-navigable
        if (shouldExcludeUrl(href)) return;

        try {
          // Resolve relative URLs
          const absoluteUrl = new URL(href, baseUrl).href;

          // Skip same-page fragment links
          if (absoluteUrl.split('#')[0] === baseUrl.split('#')[0] && href.startsWith('#')) {
            return;
          }

          // Skip if we've seen this URL already
          if (seenUrls.has(absoluteUrl)) return;
          seenUrls.add(absoluteUrl);

          // Extract text, with fallbacks
          let linkText = $element.text().trim();
          if (!linkText || linkText.length < 2) {
            linkText = $element.attr('title') ||
              $element.attr('aria-label') ||
              $element.attr('alt') ||
              href.replace(/^https?:\/\//, '').split('/')[0] ||
              'Link';
          }

          // Clean up link text (remove extra whitespace)
          linkText = linkText.replace(/\s+/g, ' ').trim();

          links.push({ text: linkText, url: absoluteUrl });
        } catch (e) {
          // Skip invalid URLs
          console.debug(`Skipping invalid URL: ${href}`);
        }
      });

      // Special handling for Wikipedia pages
      if (baseUrl.includes('wikipedia.org')) {
        // Extract citations
        $('sup.reference, .reference').each((index, element) => {
          const $element = $(element);
          const $link = $element.find('a').first();
          if ($link.length) {
            const href = $link.attr('href');
            if (href) {
              try {
                // For Wikipedia citations, try to find the actual external link in the references section
                const refId = href.replace(/^#/, '');
                const $refLink = $(`#${refId}`).parent().find('a.external');

                if ($refLink.length) {
                  const externalHref = $refLink.attr('href');
                  if (externalHref && !shouldExcludeUrl(externalHref) && !seenUrls.has(externalHref)) {
                    const citationText = $refLink.text().trim() || `Citation ${index + 1}`;
                    links.push({
                      text: citationText,
                      url: new URL(externalHref, baseUrl).href
                    });
                    seenUrls.add(externalHref);
                  }
                }
              } catch (e) {
                // Skip invalid citation URLs
              }
            }
          }
        });

        // Add reference links (often at the bottom of Wikipedia pages)
        $('.references a.external').each((index, element) => {
          const $element = $(element);
          const href = $element.attr('href');

          if (href && !shouldExcludeUrl(href) && !seenUrls.has(href)) {
            try {
              const absoluteUrl = new URL(href, baseUrl).href;
              if (!seenUrls.has(absoluteUrl)) {
                seenUrls.add(absoluteUrl);
                const linkText = $element.text().trim() || `Reference ${index + 1}`;
                links.push({ text: linkText, url: absoluteUrl });
              }
            } catch (e) {
              // Skip invalid references
            }
          }
        });
      }

      // Log how many links were found
      console.log(`Extracted ${links.length} unique navigable links from ${baseUrl}`);
    } catch (error) {
      console.error('Error extracting links:', error);
    }

    return links;
  }

  /**
   * Format search results into a text message suitable for WhatsApp
   * @param {Object} results - Search results
   * @returns {string} - Formatted text message
   */
  formatSearchResultsMessage(results) {
    let message = '*📊 Search Results*\n\n';

    // Add answer box if available
    if (results.answerBox) {
      message += `*Quick Answer:*\n${results.answerBox.answer || results.answerBox.snippet}\n\n`;
    }

    // Add knowledge graph if available
    if (results.knowledge) {
      message += `*${results.knowledge.title}* (${results.knowledge.type})\n`;
      message += `${results.knowledge.description}\n\n`;

      if (results.knowledge.attributes) {
        Object.entries(results.knowledge.attributes).forEach(([key, value]) => {
          message += `- ${key}: ${value}\n`;
        });
        message += '\n';
      }
    }

    // Add organic search results
    message += '*Web Results:*\n';

    if (results.organic && results.organic.length > 0) {
      results.organic.forEach(result => {
        message += `*${result.id}.* ${result.title}\n`;
        message += `${result.snippet}\n`;
        message += `Type *!open ${result.id}* to read more\n\n`;
      });
    } else {
      message += 'No results found.\n\n';
    }

    // Add "People also ask" section
    if (results.peopleAlsoAsk && results.peopleAlsoAsk.length > 0) {
      message += '*People also ask:*\n';
      results.peopleAlsoAsk.forEach((item, index) => {
        message += `- ${item.question}\n`;
      });
    }

    message += '\n*Commands:*\n';
    message += '- *!search [query]* - Search for something new\n';
    message += '- *!open [number]* - Open a search result\n';
    message += '- *!back* - Return to search results\n';

    return message;
  }

  /**
   * Format webpage content into a text message suitable for WhatsApp
   * @param {Object} content - Webpage content
   * @returns {string} - Formatted text message
   */
  formatWebpageContentMessage(content) {
    let message = `*📄 ${content.title}*\n`;

    if (content.siteName) {
      message += `Source: ${content.siteName}\n`;
    }

    message += `URL: ${content.url}\n\n`;

    if (content.excerpt) {
      message += `*Summary:* ${content.excerpt}\n\n`;
    }

    message += content.textContent;

    // Show all navigatable links with clearer formatting
    if (content.links && content.links.length > 0) {
      message += '\n\n*📌 Navigatable Links:*\n';

      // Show how many links are available
      message += `(${content.links.length} links available - use !link [number] to navigate)\n`;

      // Display up to 10 links with more descriptive text
      content.links.slice(0, 10).forEach((link, index) => {
        // Truncate long link text
        let linkText = link.text;
        if (linkText.length > 40) {
          linkText = linkText.substring(0, 37) + '...';
        }

        message += `*${index + 1}.* ${linkText}\n`;
      });
    } else {
      message += '\n\n*No navigatable links available on this page*\n';
    }

    message += '\n*Commands:*\n';
    message += '- *!back* - Return to search results\n';
    message += '- *!link [number]* - Follow a link on this page\n';
    message += '- *!more* - Show more content\n';
    message += '- *!search [query]* - Search for something new\n';

    return message;
  }

  /**
 * Follow a link from the current webpage
 * @param {string} userId - User identifier
 * @param {number} linkId - Link number (1-based index)
 * @returns {Promise<Object>} - Content of the linked page
 */
  async followLink(userId, linkId) {
    const userContent = this.currentWebpageContent.get(userId);

    if (!userContent || !userContent.content) {
      throw new Error('No current webpage content available');
    }

    if (!userContent.content.links || userContent.content.links.length === 0) {
      throw new Error('No links available on this page');
    }

    // Convert to 0-based index and validate
    const index = linkId - 1;
    if (index < 0 || index >= userContent.content.links.length) {
      throw new Error(`Invalid link number. Please use a number between 1 and ${userContent.content.links.length}`);
    }

    const link = userContent.content.links[index];
    console.log(`Following link: ${link.text} - ${link.url}`);

    return this.browseWebpage(link.url, userId);
  }

  /**
   * Get more content from the current webpage (show full content)
   * @param {string} userId - User identifier
   * @returns {string} - More content or error message
   */
  getMoreContent(userId) {
    const userContent = this.currentWebpageContent.get(userId);

    if (!userContent || !userContent.content) {
      return 'No current webpage content available';
    }

    // Initialize position if it doesn't exist
    if (!this.contentPositions.has(userId)) {
      this.contentPositions.set(userId, this.config.contentSummaryLength);
    }

    // Get current position
    const currentPosition = this.contentPositions.get(userId);
    const nextPosition = currentPosition + this.config.contentSummaryLength;
    const fullContent = userContent.content.fullTextContent;

    // Check if we've reached the end
    if (currentPosition >= fullContent.length) {
      return '';
    }

    // Update position for next call
    this.contentPositions.set(userId, nextPosition);

    // Return next chunk of content
    return fullContent.substring(
      currentPosition,
      Math.min(nextPosition, fullContent.length)
    );
  }

  /**
   * Clear stored content for a user
   * @param {string} userId - User identifier
   */
  clearUserContent(userId) {
    this.currentSearchResults.delete(userId);
    this.currentWebpageContent.delete(userId);
    this.contentPositions.delete(userId); // Also clear the position
  }
}