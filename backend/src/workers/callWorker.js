const Bull = require('bull');
const redis = require('redis');
const logger = require('../utils/logger');
const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');
const CallLog = require('../models/CallLog');
const callOrchestrator = require('../services/callOrchestrator');
const scraperService = require('../services/scraper.service');
const dataEnrichment = require('../utils/dataEnrichment');

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: 0,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
};

// Create Bull queues
const scrapingQueue = new Bull('scraping-queue', { redis: redisConfig });
const callingQueue = new Bull('calling-queue', { redis: redisConfig });
const enrichmentQueue = new Bull('enrichment-queue', { redis: redisConfig });

// Queue configuration
const QUEUE_CONFIG = {
  scraping: {
    concurrency: 3, // Max 3 concurrent scraping jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 50,
    removeOnFail: 20,
  },
  calling: {
    concurrency: 10, // Max 10 concurrent calls
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 30000, // 30 second delay between retries
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
  enrichment: {
    concurrency: 5, // Max 5 concurrent enrichment jobs
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: 100,
    removeOnFail: 30,
  },
};

// Rate limiting for calls
let activeCalls = 0;
const MAX_CONCURRENT_CALLS = 10;
const CALL_DELAY = 2000; // 2 seconds between calls

/**
 * Check if current time is within calling hours for a timezone
 * @param {string} timezone - Target timezone
 * @returns {boolean} - Whether calling is allowed
 */
function isCallingHoursAllowed(timezone = 'America/New_York') {
  try {
    const now = new Date();
    const targetTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const hour = targetTime.getHours();
    
    // Allow calls between 9 AM and 8 PM in target timezone
    return hour >= 9 && hour < 20;
  } catch (error) {
    logger.error('Error checking calling hours:', error);
    return false; // Default to not allowing calls if timezone check fails
  }
}

/**
 * Get timezone from phone number or location
 * @param {string} phone - Phone number
 * @param {string} location - Location string
 * @returns {string} - Timezone identifier
 */
function getTimezoneFromLocation(phone, location) {
  // Simple timezone mapping based on location or phone area code
  const timezoneMap = {
    // US States
    'california': 'America/Los_Angeles',
    'new york': 'America/New_York',
    'texas': 'America/Chicago',
    'florida': 'America/New_York',
    'illinois': 'America/Chicago',
    'washington': 'America/Los_Angeles',
    'oregon': 'America/Los_Angeles',
    'nevada': 'America/Los_Angeles',
    'arizona': 'America/Phoenix',
    'colorado': 'America/Denver',
    'utah': 'America/Denver',
    'montana': 'America/Denver',
    'wyoming': 'America/Denver',
    'north dakota': 'America/Chicago',
    'south dakota': 'America/Chicago',
    'nebraska': 'America/Chicago',
    'kansas': 'America/Chicago',
    'oklahoma': 'America/Chicago',
    'arkansas': 'America/Chicago',
    'louisiana': 'America/Chicago',
    'mississippi': 'America/Chicago',
    'alabama': 'America/Chicago',
    'tennessee': 'America/Chicago',
    'kentucky': 'America/New_York',
    'indiana': 'America/New_York',
    'ohio': 'America/New_York',
    'michigan': 'America/New_York',
    'wisconsin': 'America/Chicago',
    'minnesota': 'America/Chicago',
    'iowa': 'America/Chicago',
    'missouri': 'America/Chicago',
    'georgia': 'America/New_York',
    'south carolina': 'America/New_York',
    'north carolina': 'America/New_York',
    'virginia': 'America/New_York',
    'west virginia': 'America/New_York',
    'maryland': 'America/New_York',
    'delaware': 'America/New_York',
    'pennsylvania': 'America/New_York',
    'new jersey': 'America/New_York',
    'connecticut': 'America/New_York',
    'rhode island': 'America/New_York',
    'massachusetts': 'America/New_York',
    'vermont': 'America/New_York',
    'new hampshire': 'America/New_York',
    'maine': 'America/New_York',
  };

  // Check location first
  if (location) {
    const locationLower = location.toLowerCase();
    for (const [state, timezone] of Object.entries(timezoneMap)) {
      if (locationLower.includes(state)) {
        return timezone;
      }
    }
  }

  // Default to Eastern Time
  return 'America/New_York';
}

/**
 * Scraping Worker - Process lead generation jobs
 */
class ScrapingWorker {
  static async process(job) {
    const { campaignId, query, location, maxResults = 100 } = job.data;
    
    try {
      logger.info(`Starting scraping job for campaign ${campaignId}: ${query} in ${location}`);
      
      // Update job progress
      await job.progress(10);
      
      // Get campaign
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }
      
      // Update campaign status
      campaign.status = 'generating_leads';
      await campaign.save();
      
      await job.progress(20);
      
      // Scrape leads in batches
      const batchSize = 20;
      const totalBatches = Math.ceil(maxResults / batchSize);
      let totalLeadsFound = 0;
      let processedBatches = 0;
      
      for (let batch = 0; batch < totalBatches; batch++) {
        const startIndex = batch * batchSize;
        const currentBatchSize = Math.min(batchSize, maxResults - startIndex);
        
        logger.info(`Processing batch ${batch + 1}/${totalBatches} for campaign ${campaignId}`);
        
        try {
          // Scrape batch of leads
          const leads = await scraperService.searchBusinesses({
            query,
            location,
            maxResults: currentBatchSize,
            startIndex
          });
          
          // Save leads to database
          const savedLeads = [];
          for (const leadData of leads) {
            try {
              // Check if lead already exists
              const existingLead = await Lead.findOne({
                $or: [
                  { phone: leadData.phone },
                  { email: leadData.email },
                  { 
                    businessName: leadData.businessName,
                    address: leadData.address
                  }
                ]
              });
              
              if (!existingLead) {
                const lead = new Lead({
                  ...leadData,
                  campaign: campaignId,
                  user: campaign.user,
                  status: 'new',
                  source: 'google_maps',
                  createdAt: new Date()
                });
                
                const savedLead = await lead.save();
                savedLeads.push(savedLead);
                totalLeadsFound++;
                
                // Add to enrichment queue if email is missing
                if (!leadData.email && leadData.businessName) {
                  await enrichmentQueue.add('enrich-lead', {
                    leadId: savedLead._id,
                    campaignId: campaignId
                  }, {
                    delay: Math.random() * 5000, // Random delay up to 5 seconds
                    ...QUEUE_CONFIG.enrichment
                  });
                }
              }
            } catch (leadError) {
              logger.error(`Error saving lead: ${leadError.message}`);
            }
          }
          
          processedBatches++;
          const progress = 20 + (processedBatches / totalBatches) * 60;
          await job.progress(progress);
          
          // Update campaign stats
          campaign.totalLeads = await Lead.countDocuments({ campaign: campaignId });
          await campaign.save();
          
          // Delay between batches to avoid rate limiting
          if (batch < totalBatches - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
        } catch (batchError) {
          logger.error(`Error processing batch ${batch + 1}: ${batchError.message}`);
          // Continue with next batch
        }
      }
      
      await job.progress(90);
      
      // Update campaign status
      campaign.status = 'active';
      campaign.totalLeads = await Lead.countDocuments({ campaign: campaignId });
      await campaign.save();
      
      await job.progress(100);
      
      logger.info(`Scraping completed for campaign ${campaignId}. Found ${totalLeadsFound} new leads.`);
      
      return {
        campaignId,
        totalLeadsFound,
        totalBatches: processedBatches,
        status: 'completed'
      };
      
    } catch (error) {
      logger.error(`Scraping job failed for campaign ${campaignId}:`, error);
      
      // Update campaign status on failure
      try {
        const campaign = await Campaign.findById(campaignId);
        if (campaign) {
          campaign.status = 'failed';
          await campaign.save();
        }
      } catch (updateError) {
        logger.error('Error updating campaign status on failure:', updateError);
      }
      
      throw error;
    }
  }
}

/**
 * Calling Worker - Process outbound call jobs
 */
class CallingWorker {
  static async process(job) {
    const { leadId, campaignId, retryCount = 0 } = job.data;
    
    try {
      // Check concurrent call limit
      if (activeCalls >= MAX_CONCURRENT_CALLS) {
        throw new Error('Maximum concurrent calls reached');
      }
      
      activeCalls++;
      
      logger.info(`Starting call job for lead ${leadId}, campaign ${campaignId}`);
      
      // Get lead and campaign
      const lead = await Lead.findById(leadId);
      const campaign = await Campaign.findById(campaignId);
      
      if (!lead) {
        throw new Error(`Lead ${leadId} not found`);
      }
      
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }
      
      // Check if lead has phone number
      if (!lead.phone) {
        throw new Error('Lead does not have a phone number');
      }
      
      // Check calling hours based on lead's timezone
      const timezone = getTimezoneFromLocation(lead.phone, lead.address);
      if (!isCallingHoursAllowed(timezone)) {
        // Reschedule for next business day
        const delay = 8 * 60 * 60 * 1000; // 8 hours
        await callingQueue.add('call-lead', job.data, {
          delay,
          ...QUEUE_CONFIG.calling
        });
        
        logger.info(`Call rescheduled for lead ${leadId} - outside business hours`);
        return { status: 'rescheduled', reason: 'outside_business_hours' };
      }
      
      // Check if lead was recently called
      const recentCall = await CallLog.findOne({
        lead: leadId,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      });
      
      if (recentCall && retryCount === 0) {
        logger.info(`Lead ${leadId} was called recently, skipping`);
        return { status: 'skipped', reason: 'recently_called' };
      }
      
      await job.progress(20);
      
      // Add delay between calls
      if (CALL_DELAY > 0) {
        await new Promise(resolve => setTimeout(resolve, CALL_DELAY));
      }
      
      await job.progress(40);
      
      // Update lead status
      lead.status = 'calling';
      lead.lastCallAttempt = new Date();
      await lead.save();
      
      await job.progress(60);
      
      // Initiate call through orchestrator
      const callResult = await callOrchestrator.initiateCall(lead, campaign);
      
      await job.progress(80);
      
      // Update lead based on call result
      if (callResult.status === 'initiated') {
        lead.status = 'contacted';
        lead.lastContactDate = new Date();
      } else {
        lead.status = 'call_failed';
      }
      
      await lead.save();
      
      // Update campaign stats
      campaign.leadsContacted = await Lead.countDocuments({ 
        campaign: campaignId, 
        status: { $in: ['contacted', 'qualified', 'converted'] }
      });
      await campaign.save();
      
      await job.progress(100);
      
      logger.info(`Call completed for lead ${leadId}: ${callResult.status}`);
      
      return {
        leadId,
        campaignId,
        callId: callResult.callId,
        status: callResult.status,
        duration: callResult.duration || 0
      };
      
    } catch (error) {
      logger.error(`Call job failed for lead ${leadId}:`, error);
      
      // Update lead status on failure
      try {
        const lead = await Lead.findById(leadId);
        if (lead) {
          lead.status = 'call_failed';
          lead.lastCallAttempt = new Date();
          await lead.save();
        }
      } catch (updateError) {
        logger.error('Error updating lead status on call failure:', updateError);
      }
      
      throw error;
    } finally {
      activeCalls--;
    }
  }
}

/**
 * Enrichment Worker - Process data enrichment jobs
 */
class EnrichmentWorker {
  static async process(job) {
    const { leadId, campaignId } = job.data;
    
    try {
      logger.info(`Starting enrichment job for lead ${leadId}`);
      
      const lead = await Lead.findById(leadId);
      if (!lead) {
        throw new Error(`Lead ${leadId} not found`);
      }
      
      await job.progress(20);
      
      let enriched = false;
      
      // Try to find email if missing
      if (!lead.email && lead.businessName) {
        try {
          const emailResult = await dataEnrichment.findEmail(lead.businessName, lead.website);
          if (emailResult.email) {
            lead.email = emailResult.email;
            lead.emailConfidence = emailResult.confidence;
            enriched = true;
          }
        } catch (emailError) {
          logger.warn(`Email enrichment failed for lead ${leadId}: ${emailError.message}`);
        }
      }
      
      await job.progress(50);
      
      // Validate and format phone number
      if (lead.phone) {
        try {
          const phoneResult = await dataEnrichment.validatePhone(lead.phone);
          if (phoneResult.isValid && phoneResult.formatted !== lead.phone) {
            lead.phone = phoneResult.formatted;
            lead.phoneType = phoneResult.type;
            enriched = true;
          }
        } catch (phoneError) {
          logger.warn(`Phone validation failed for lead ${leadId}: ${phoneError.message}`);
        }
      }
      
      await job.progress(80);
      
      // Save enriched data
      if (enriched) {
        lead.enrichedAt = new Date();
        await lead.save();
        logger.info(`Lead ${leadId} enriched successfully`);
      }
      
      await job.progress(100);
      
      return {
        leadId,
        enriched,
        hasEmail: !!lead.email,
        hasValidPhone: !!lead.phone
      };
      
    } catch (error) {
      logger.error(`Enrichment job failed for lead ${leadId}:`, error);
      throw error;
    }
  }
}

// Configure queue processors
scrapingQueue.process('scrape-leads', QUEUE_CONFIG.scraping.concurrency, ScrapingWorker.process);
callingQueue.process('call-lead', QUEUE_CONFIG.calling.concurrency, CallingWorker.process);
enrichmentQueue.process('enrich-lead', QUEUE_CONFIG.enrichment.concurrency, EnrichmentWorker.process);

// Queue event handlers
scrapingQueue.on('completed', (job, result) => {
  logger.info(`Scraping job ${job.id} completed:`, result);
});

scrapingQueue.on('failed', (job, err) => {
  logger.error(`Scraping job ${job.id} failed:`, err.message);
});

callingQueue.on('completed', (job, result) => {
  logger.info(`Calling job ${job.id} completed:`, result);
});

callingQueue.on('failed', (job, err) => {
  logger.error(`Calling job ${job.id} failed:`, err.message);
});

enrichmentQueue.on('completed', (job, result) => {
  logger.info(`Enrichment job ${job.id} completed:`, result);
});

enrichmentQueue.on('failed', (job, err) => {
  logger.error(`Enrichment job ${job.id} failed:`, err.message);
});

// Queue health monitoring
setInterval(async () => {
  try {
    const scrapingStats = await scrapingQueue.getJobCounts();
    const callingStats = await callingQueue.getJobCounts();
    const enrichmentStats = await enrichmentQueue.getJobCounts();
    
    logger.debug('Queue stats:', {
      scraping: scrapingStats,
      calling: callingStats,
      enrichment: enrichmentStats,
      activeCalls
    });
  } catch (error) {
    logger.error('Error getting queue stats:', error);
  }
}, 60000); // Every minute

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down workers...');
  
  await Promise.all([
    scrapingQueue.close(),
    callingQueue.close(),
    enrichmentQueue.close()
  ]);
  
  logger.info('Workers shut down successfully');
  process.exit(0);
});

module.exports = {
  scrapingQueue,
  callingQueue,
  enrichmentQueue,
  ScrapingWorker,
  CallingWorker,
  EnrichmentWorker,
  QUEUE_CONFIG,
  isCallingHoursAllowed,
  getTimezoneFromLocation
};