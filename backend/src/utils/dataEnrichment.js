const axios = require('axios');
const logger = require('./logger');

/**
 * Data enrichment utilities for leads
 */
class DataEnrichment {
  /**
   * Common email patterns for businesses
   * @private
   */
  static emailPatterns = [
    '{first}@{domain}',
    '{last}@{domain}',
    '{first}.{last}@{domain}',
    '{first}{last}@{domain}',
    '{first_initial}{last}@{domain}',
    '{first_initial}.{last}@{domain}',
    'info@{domain}',
    'contact@{domain}',
    'hello@{domain}',
    'sales@{domain}',
    'support@{domain}'
  ];

  /**
   * Clean and standardize a business name
   * @param {string} name - Business name to clean
   * @returns {string} - Cleaned business name
   */
  static cleanBusinessName(name) {
    if (!name) return '';
    
    // Convert to lowercase
    let cleanName = name.toLowerCase();
    
    // Remove common business suffixes
    const suffixes = [
      'inc', 'inc.', 'incorporated', 
      'llc', 'l.l.c.', 'limited liability company',
      'ltd', 'ltd.', 'limited',
      'corp', 'corp.', 'corporation',
      'co', 'co.', 'company',
      'gmbh', 'plc', 's.a.', 'ag',
      'lp', 'l.p.', 'limited partnership'
    ];
    
    suffixes.forEach(suffix => {
      // Remove suffix if it's at the end of the name
      const suffixPattern = new RegExp(`\\s+${suffix}\\s*$`, 'i');
      cleanName = cleanName.replace(suffixPattern, '');
    });
    
    // Remove special characters and extra spaces
    cleanName = cleanName
      .replace(/[^\w\s]/g, ' ')  // Replace special chars with space
      .replace(/\s+/g, ' ')      // Replace multiple spaces with single space
      .trim();
    
    // Capitalize first letter of each word
    cleanName = cleanName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return cleanName;
  }

  /**
   * Validate and format a phone number
   * @param {string} phone - Phone number to validate
   * @returns {object} - Object with isValid flag and formatted phone
   */
  static validatePhone(phone) {
    if (!phone) {
      return { isValid: false, formatted: null };
    }
    
    // Remove all non-numeric characters
    const digits = phone.replace(/\D/g, '');
    
    // Check if we have a valid number of digits (10-15)
    if (digits.length < 10 || digits.length > 15) {
      return { isValid: false, formatted: null };
    }
    
    // Format for US numbers (assuming US for simplicity)
    if (digits.length === 10) {
      const formatted = `+1 (${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
      return { isValid: true, formatted };
    }
    
    // Format for international numbers
    if (digits.length > 10) {
      // Simple international format
      const countryCode = digits.substring(0, digits.length - 10);
      const nationalNumber = digits.substring(digits.length - 10);
      const formatted = `+${countryCode} ${nationalNumber.substring(0, 3)} ${nationalNumber.substring(3, 6)} ${nationalNumber.substring(6)}`;
      return { isValid: true, formatted };
    }
    
    return { isValid: false, formatted: null };
  }

  /**
   * Extract domain from website URL
   * @param {string} website - Website URL
   * @returns {string|null} - Domain name or null if invalid
   * @private
   */
  static extractDomain(website) {
    if (!website) return null;
    
    try {
      // Add protocol if missing
      if (!website.startsWith('http://') && !website.startsWith('https://')) {
        website = 'https://' + website;
      }
      
      const url = new URL(website);
      let domain = url.hostname;
      
      // Remove www. prefix if present
      domain = domain.replace(/^www\./, '');
      
      return domain;
    } catch (error) {
      logger.warn(`Invalid URL: ${website}`);
      return null;
    }
  }

  /**
   * Generate potential email addresses based on patterns
   * @param {string} firstName - First name
   * @param {string} lastName - Last name
   * @param {string} domain - Domain name
   * @returns {Array} - Array of potential email addresses
   * @private
   */
  static generateEmailPatterns(firstName, lastName, domain) {
    if (!domain) return [];
    
    const firstInitial = firstName ? firstName.charAt(0).toLowerCase() : '';
    const firstNameLower = firstName ? firstName.toLowerCase() : '';
    const lastNameLower = lastName ? lastName.toLowerCase() : '';
    
    return this.emailPatterns.map(pattern => {
      return pattern
        .replace('{first}', firstNameLower)
        .replace('{last}', lastNameLower)
        .replace('{first_initial}', firstInitial)
        .replace('{domain}', domain);
    });
  }

  /**
   * Verify if an email exists using email verification API
   * @param {string} email - Email to verify
   * @param {string} apiKey - API key for verification service
   * @returns {boolean} - True if email exists, false otherwise
   * @private
   */
  static async verifyEmail(email, apiKey) {
    if (!email || !apiKey) return false;
    
    try {
      // This is a placeholder for an actual email verification API call
      // In a real implementation, you would use a service like Hunter.io, NeverBounce, etc.
      const response = await axios.get(`https://api.emailverification.example/v1/verify?email=${email}&api_key=${apiKey}`);
      
      return response.data && response.data.status === 'valid';
    } catch (error) {
      logger.warn(`Error verifying email ${email}: ${error.message}`);
      return false;
    }
  }

  /**
   * Extract first and last name from business name
   * @param {string} businessName - Business name
   * @returns {object} - Object with firstName and lastName
   * @private
   */
  static extractPersonName(businessName) {
    // This is a simplified approach - in reality, you'd need more sophisticated NLP
    if (!businessName) {
      return { firstName: '', lastName: '' };
    }
    
    // Check if the business name contains common person name patterns
    const nameParts = businessName.split(' ');
    
    if (nameParts.length >= 2) {
      // Assume first word is first name and last word is last name
      // This is very simplified and would need improvement for real use
      return {
        firstName: nameParts[0],
        lastName: nameParts[nameParts.length - 1]
      };
    }
    
    return { firstName: '', lastName: '' };
  }

  /**
   * Enrich a lead with additional data
   * @param {object} lead - Lead object to enrich
   * @param {object} options - Options for enrichment
   * @returns {object} - Enriched lead object
   */
  static async enrichLead(lead, options = {}) {
    try {
      const enrichedLead = { ...lead };
      
      // Clean business name
      if (lead.businessName) {
        enrichedLead.businessName = this.cleanBusinessName(lead.businessName);
      }
      
      // Validate and format phone
      if (lead.phone) {
        const phoneResult = this.validatePhone(lead.phone);
        enrichedLead.phone = phoneResult.formatted || lead.phone;
        enrichedLead.phoneValid = phoneResult.isValid;
      }
      
      // Extract domain from website
      const domain = this.extractDomain(lead.website);
      
      // Try to find email if we have a domain and API key
      if (domain && options.emailApiKey) {
        // Extract potential person name from business name
        const { firstName, lastName } = this.extractPersonName(lead.businessName);
        
        // Generate potential email addresses
        const potentialEmails = this.generateEmailPatterns(firstName, lastName, domain);
        
        // Try to verify each email until we find a valid one
        for (const email of potentialEmails) {
          const isValid = await this.verifyEmail(email, options.emailApiKey);
          
          if (isValid) {
            enrichedLead.email = email;
            break;
          }
        }
        
        // If no valid email found, use a default pattern
        if (!enrichedLead.email) {
          enrichedLead.email = `info@${domain}`;
          enrichedLead.emailVerified = false;
        } else {
          enrichedLead.emailVerified = true;
        }
      }
      
      return enrichedLead;
    } catch (error) {
      logger.error(`Error enriching lead: ${error.message}`);
      return lead; // Return original lead if enrichment fails
    }
  }
}

module.exports = DataEnrichment;