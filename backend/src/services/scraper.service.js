const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

/**
 * GoogleMapsScraper class for scraping business leads from Google Maps
 */
class GoogleMapsScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.retryCount = 3;
    this.retryDelay = 2000; // ms
  }

  /**
   * Initialize the browser and page
   * @private
   */
  async initialize() {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080',
        ],
      });
      
      this.page = await this.browser.newPage();
      
      // Set user agent to avoid detection
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );
      
      // Set viewport
      await this.page.setViewport({ width: 1920, height: 1080 });
      
      // Enable request interception to block images and other resources
      await this.page.setRequestInterception(true);
      this.page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (resourceType === 'image' || resourceType === 'font' || resourceType === 'media') {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      logger.info('Browser and page initialized successfully');
    } catch (error) {
      logger.error(`Error initializing browser: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close the browser
   * @private
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      logger.info('Browser closed successfully');
    }
  }

  /**
   * Random delay to avoid detection
   * @param {number} min - Minimum delay in ms
   * @param {number} max - Maximum delay in ms
   * @private
   */
  async randomDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Retry a function with exponential backoff
   * @param {Function} fn - Function to retry
   * @param {number} retries - Number of retries
   * @param {number} delay - Initial delay in ms
   * @private
   */
  async retry(fn, retries = this.retryCount, delay = this.retryDelay) {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) {
        throw error;
      }
      logger.warn(`Retrying operation. Attempts left: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retry(fn, retries - 1, delay * 1.5);
    }
  }

  /**
   * Navigate to Google Maps and search for businesses
   * @param {string} query - Business type to search for
   * @param {string} location - Location to search near
   * @private
   */
  async navigateToGoogleMaps(query, location) {
    try {
      await this.page.goto('https://www.google.com/maps', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });
      
      // Accept cookies if the dialog appears
      try {
        const cookieButton = await this.page.$('button[aria-label="Accept all"]');
        if (cookieButton) {
          await cookieButton.click();
          await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
        }
      } catch (error) {
        logger.info('No cookie dialog found or error handling it');
      }
      
      // Wait for the search box and type the query
      await this.page.waitForSelector('input#searchboxinput', { visible: true });
      await this.randomDelay(800, 1500);
      
      const searchQuery = `${query} near ${location}`;
      await this.page.type('input#searchboxinput', searchQuery, { delay: 50 });
      
      // Click the search button
      await this.randomDelay(500, 1000);
      await this.page.click('button#searchbox-searchbutton');
      
      // Wait for results to load
      await this.page.waitForSelector('div[role="feed"]', { timeout: 60000 });
      await this.randomDelay(2000, 4000);
      
      logger.info(`Successfully navigated to Google Maps and searched for: ${searchQuery}`);
    } catch (error) {
      logger.error(`Error navigating to Google Maps: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract business data from the current page
   * @private
   */
  async extractBusinessData() {
    try {
      // Wait for the business listings to load
      await this.page.waitForSelector('div[role="feed"] > div', { timeout: 30000 });
      
      // Get all business listings
      const businessElements = await this.page.$$('div[role="feed"] > div');
      const businesses = [];
      
      for (let i = 0; i < businessElements.length; i++) {
        try {
          // Click on the business to open details
          await businessElements[i].click();
          await this.randomDelay(1500, 3000);
          
          // Wait for the business details panel to load
          await this.page.waitForSelector('div.fontHeadlineSmall', { timeout: 10000 });
          
          // Extract business data
          const businessData = await this.page.evaluate(() => {
            const data = {};
            
            // Name
            const nameElement = document.querySelector('div.fontHeadlineSmall');
            data.name = nameElement ? nameElement.textContent.trim() : null;
            
            // Address
            const addressElement = document.querySelector('button[data-item-id="address"]');
            data.address = addressElement ? addressElement.textContent.trim() : null;
            
            // Phone
            const phoneElement = document.querySelector('button[data-item-id^="phone:"]');
            data.phone = phoneElement ? phoneElement.textContent.trim() : null;
            
            // Website
            const websiteElement = document.querySelector('a[data-item-id="authority"]');
            data.website = websiteElement ? websiteElement.href : null;
            
            // Rating
            const ratingElement = document.querySelector('div.fontBodyMedium span');
            data.rating = ratingElement ? parseFloat(ratingElement.textContent.trim()) : null;
            
            // Review count
            const reviewCountElement = document.querySelector('div.fontBodyMedium span:nth-child(2)');
            if (reviewCountElement) {
              const reviewText = reviewCountElement.textContent.trim();
              const reviewMatch = reviewText.match(/\d+/);
              data.reviewCount = reviewMatch ? parseInt(reviewMatch[0], 10) : 0;
            } else {
              data.reviewCount = 0;
            }
            
            // Business type
            const businessTypeElement = document.querySelector('button[jsaction="pane.rating.category"]');
            data.businessType = businessTypeElement ? businessTypeElement.textContent.trim() : null;
            
            // Hours
            const hoursElement = document.querySelector('div[data-tooltip="Opening hours"]');
            if (hoursElement) {
              const hoursText = hoursElement.textContent.trim();
              data.hours = hoursText.replace('Opening hours: ', '');
            } else {
              data.hours = null;
            }
            
            return data;
          });
          
          if (businessData.name && businessData.phone) {
            businesses.push(businessData);
          }
          
          // Go back to the list
          await this.randomDelay(800, 1500);
          
        } catch (error) {
          logger.warn(`Error extracting data for business at index ${i}: ${error.message}`);
          continue;
        }
      }
      
      return businesses;
    } catch (error) {
      logger.error(`Error extracting business data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if there's a next page and navigate to it
   * @returns {boolean} - True if navigated to next page, false if no next page
   * @private
   */
  async goToNextPage() {
    try {
      // Check if the "Next page" button exists and is not disabled
      const nextButton = await this.page.$('button[aria-label="Next page"]');
      
      if (!nextButton) {
        logger.info('No next page button found');
        return false;
      }
      
      const isDisabled = await this.page.evaluate(
        button => button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true',
        nextButton
      );
      
      if (isDisabled) {
        logger.info('Next page button is disabled');
        return false;
      }
      
      // Click the next page button
      await nextButton.click();
      await this.page.waitForSelector('div[role="feed"]', { timeout: 30000 });
      await this.randomDelay(2000, 4000);
      
      logger.info('Navigated to next page successfully');
      return true;
    } catch (error) {
      logger.error(`Error navigating to next page: ${error.message}`);
      return false;
    }
  }

  /**
   * Scrape leads from Google Maps
   * @param {string} query - Business type to search for
   * @param {string} location - Location to search near
   * @param {number} maxResults - Maximum number of results to return
   * @returns {Array} - Array of business leads
   */
  async scrapeLeads(query, location, maxResults = 100) {
    if (!query || !location) {
      throw new Error('Query and location are required');
    }
    
    try {
      await this.initialize();
      
      // Navigate to Google Maps and search
      await this.retry(() => this.navigateToGoogleMaps(query, location));
      
      let allBusinesses = [];
      let pageCount = 1;
      
      // Extract data from the first page
      logger.info(`Scraping page ${pageCount}`);
      const firstPageBusinesses = await this.retry(() => this.extractBusinessData());
      allBusinesses = allBusinesses.concat(firstPageBusinesses);
      
      // Continue to next pages until we have enough results or no more pages
      while (allBusinesses.length < maxResults) {
        const hasNextPage = await this.retry(() => this.goToNextPage());
        
        if (!hasNextPage) {
          logger.info('No more pages to scrape');
          break;
        }
        
        pageCount++;
        logger.info(`Scraping page ${pageCount}`);
        
        const businesses = await this.retry(() => this.extractBusinessData());
        allBusinesses = allBusinesses.concat(businesses);
        
        // Add a longer delay between pages
        await this.randomDelay(3000, 6000);
      }
      
      // Limit results to maxResults
      const results = allBusinesses.slice(0, maxResults);
      
      logger.info(`Scraped ${results.length} businesses from ${pageCount} pages`);
      
      // Close the browser
      await this.close();
      
      return results;
    } catch (error) {
      logger.error(`Error scraping leads: ${error.message}`);
      
      // Make sure to close the browser in case of error
      await this.close();
      
      throw error;
    }
  }
}

module.exports = {
  GoogleMapsScraper
};