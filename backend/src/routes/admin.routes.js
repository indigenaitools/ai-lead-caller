const express = require('express');
const router = express.Router();
const { 
  scrapingQueue, 
  callingQueue, 
  enrichmentQueue,
  QUEUE_CONFIG,
  isCallingHoursAllowed,
  getTimezoneFromLocation
} = require('../workers/callWorker');
const adminController = require('../controllers/admin.controller');
const logger = require('../utils/logger');

// Middleware to check admin role
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Admin dashboard and system management routes
router.get('/dashboard', adminMiddleware, adminController.getDashboard);
router.get('/users', adminMiddleware, adminController.getUsers);
router.put('/users/:id', adminMiddleware, adminController.updateUser);
router.get('/analytics', adminMiddleware, adminController.getAnalytics);
router.get('/health', adminMiddleware, adminController.getSystemHealth);

/**
 * Get queue dashboard overview
 * @route GET /api/admin/queues
 * @access Admin
 */
router.get('/queues', adminMiddleware, async (req, res) => {
  try {
    // Get job counts for all queues
    const [scrapingStats, callingStats, enrichmentStats] = await Promise.all([
      scrapingQueue.getJobCounts(),
      callingQueue.getJobCounts(),
      enrichmentQueue.getJobCounts()
    ]);

    // Get queue health status
    const queueHealth = {
      scraping: await getQueueHealth(scrapingQueue),
      calling: await getQueueHealth(callingQueue),
      enrichment: await getQueueHealth(enrichmentQueue)
    };

    // Get recent failed jobs
    const [scrapingFailed, callingFailed, enrichmentFailed] = await Promise.all([
      scrapingQueue.getFailed(0, 10),
      callingQueue.getFailed(0, 10),
      enrichmentQueue.getFailed(0, 10)
    ]);

    // Get active jobs
    const [scrapingActive, callingActive, enrichmentActive] = await Promise.all([
      scrapingQueue.getActive(0, 10),
      callingQueue.getActive(0, 10),
      enrichmentQueue.getActive(0, 10)
    ]);

    res.json({
      overview: {
        scraping: scrapingStats,
        calling: callingStats,
        enrichment: enrichmentStats
      },
      health: queueHealth,
      recentFailed: {
        scraping: scrapingFailed.map(formatJobInfo),
        calling: callingFailed.map(formatJobInfo),
        enrichment: enrichmentFailed.map(formatJobInfo)
      },
      activeJobs: {
        scraping: scrapingActive.map(formatJobInfo),
        calling: callingActive.map(formatJobInfo),
        enrichment: enrichmentActive.map(formatJobInfo)
      },
      config: QUEUE_CONFIG
    });
  } catch (error) {
    logger.error('Error getting queue dashboard:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Get detailed queue statistics
 * @route GET /api/admin/queues/:queueName/stats
 * @access Admin
 */
router.get('/queues/:queueName/stats', adminMiddleware, async (req, res) => {
  try {
    const { queueName } = req.params;
    const queue = getQueueByName(queueName);
    
    if (!queue) {
      return res.status(404).json({ message: 'Queue not found' });
    }

    const stats = await queue.getJobCounts();
    const waiting = await queue.getWaiting(0, 50);
    const active = await queue.getActive(0, 50);
    const completed = await queue.getCompleted(0, 50);
    const failed = await queue.getFailed(0, 50);
    const delayed = await queue.getDelayed(0, 50);

    res.json({
      queueName,
      stats,
      jobs: {
        waiting: waiting.map(formatJobInfo),
        active: active.map(formatJobInfo),
        completed: completed.map(formatJobInfo),
        failed: failed.map(formatJobInfo),
        delayed: delayed.map(formatJobInfo)
      }
    });
  } catch (error) {
    logger.error(`Error getting ${req.params.queueName} queue stats:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Get specific job details
 * @route GET /api/admin/queues/:queueName/jobs/:jobId
 * @access Admin
 */
router.get('/queues/:queueName/jobs/:jobId', adminMiddleware, async (req, res) => {
  try {
    const { queueName, jobId } = req.params;
    const queue = getQueueByName(queueName);
    
    if (!queue) {
      return res.status(404).json({ message: 'Queue not found' });
    }

    const job = await queue.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const jobData = {
      id: job.id,
      name: job.name,
      data: job.data,
      opts: job.opts,
      progress: job.progress(),
      delay: job.delay,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      returnvalue: job.returnvalue,
      attemptsMade: job.attemptsMade,
      attemptsTotal: job.opts.attempts
    };

    res.json(jobData);
  } catch (error) {
    logger.error(`Error getting job ${req.params.jobId}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Retry failed job
 * @route POST /api/admin/queues/:queueName/jobs/:jobId/retry
 * @access Admin
 */
router.post('/queues/:queueName/jobs/:jobId/retry', adminMiddleware, async (req, res) => {
  try {
    const { queueName, jobId } = req.params;
    const queue = getQueueByName(queueName);
    
    if (!queue) {
      return res.status(404).json({ message: 'Queue not found' });
    }

    const job = await queue.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    await job.retry();
    
    logger.info(`Job ${jobId} in ${queueName} queue retried by admin ${req.user.email}`);
    
    res.json({ message: 'Job retried successfully', jobId });
  } catch (error) {
    logger.error(`Error retrying job ${req.params.jobId}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Remove job from queue
 * @route DELETE /api/admin/queues/:queueName/jobs/:jobId
 * @access Admin
 */
router.delete('/queues/:queueName/jobs/:jobId', adminMiddleware, async (req, res) => {
  try {
    const { queueName, jobId } = req.params;
    const queue = getQueueByName(queueName);
    
    if (!queue) {
      return res.status(404).json({ message: 'Queue not found' });
    }

    const job = await queue.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    await job.remove();
    
    logger.info(`Job ${jobId} in ${queueName} queue removed by admin ${req.user.email}`);
    
    res.json({ message: 'Job removed successfully', jobId });
  } catch (error) {
    logger.error(`Error removing job ${req.params.jobId}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Pause queue
 * @route POST /api/admin/queues/:queueName/pause
 * @access Admin
 */
router.post('/queues/:queueName/pause', adminMiddleware, async (req, res) => {
  try {
    const { queueName } = req.params;
    const queue = getQueueByName(queueName);
    
    if (!queue) {
      return res.status(404).json({ message: 'Queue not found' });
    }

    await queue.pause();
    
    logger.info(`Queue ${queueName} paused by admin ${req.user.email}`);
    
    res.json({ message: `Queue ${queueName} paused successfully` });
  } catch (error) {
    logger.error(`Error pausing queue ${req.params.queueName}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Resume queue
 * @route POST /api/admin/queues/:queueName/resume
 * @access Admin
 */
router.post('/queues/:queueName/resume', adminMiddleware, async (req, res) => {
  try {
    const { queueName } = req.params;
    const queue = getQueueByName(queueName);
    
    if (!queue) {
      return res.status(404).json({ message: 'Queue not found' });
    }

    await queue.resume();
    
    logger.info(`Queue ${queueName} resumed by admin ${req.user.email}`);
    
    res.json({ message: `Queue ${queueName} resumed successfully` });
  } catch (error) {
    logger.error(`Error resuming queue ${req.params.queueName}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Clean queue (remove completed/failed jobs)
 * @route POST /api/admin/queues/:queueName/clean
 * @access Admin
 */
router.post('/queues/:queueName/clean', adminMiddleware, async (req, res) => {
  try {
    const { queueName } = req.params;
    const { type = 'completed', age = 24 * 60 * 60 * 1000 } = req.body; // Default 24 hours
    const queue = getQueueByName(queueName);
    
    if (!queue) {
      return res.status(404).json({ message: 'Queue not found' });
    }

    const cleanedJobs = await queue.clean(age, type);
    
    logger.info(`Cleaned ${cleanedJobs.length} ${type} jobs from ${queueName} queue by admin ${req.user.email}`);
    
    res.json({ 
      message: `Cleaned ${cleanedJobs.length} ${type} jobs from ${queueName} queue`,
      cleanedCount: cleanedJobs.length
    });
  } catch (error) {
    logger.error(`Error cleaning queue ${req.params.queueName}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Add job to queue manually
 * @route POST /api/admin/queues/:queueName/jobs
 * @access Admin
 */
router.post('/queues/:queueName/jobs', adminMiddleware, async (req, res) => {
  try {
    const { queueName } = req.params;
    const { jobName, jobData, options = {} } = req.body;
    const queue = getQueueByName(queueName);
    
    if (!queue) {
      return res.status(404).json({ message: 'Queue not found' });
    }

    const job = await queue.add(jobName, jobData, {
      ...QUEUE_CONFIG[queueName.replace('-queue', '')],
      ...options
    });
    
    logger.info(`Job ${job.id} added to ${queueName} queue by admin ${req.user.email}`);
    
    res.json({ 
      message: 'Job added successfully',
      jobId: job.id,
      jobName,
      jobData
    });
  } catch (error) {
    logger.error(`Error adding job to queue ${req.params.queueName}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Get queue metrics for monitoring
 * @route GET /api/admin/queues/metrics
 * @access Admin
 */
router.get('/queues/metrics', adminMiddleware, async (req, res) => {
  try {
    const timeRange = req.query.range || '1h'; // 1h, 6h, 24h, 7d
    
    // Get current stats
    const [scrapingStats, callingStats, enrichmentStats] = await Promise.all([
      scrapingQueue.getJobCounts(),
      callingQueue.getJobCounts(),
      enrichmentQueue.getJobCounts()
    ]);

    // Calculate processing rates (jobs per minute)
    const now = Date.now();
    const timeRangeMs = parseTimeRange(timeRange);
    const since = now - timeRangeMs;

    const [scrapingCompleted, callingCompleted, enrichmentCompleted] = await Promise.all([
      scrapingQueue.getCompleted(0, -1),
      callingQueue.getCompleted(0, -1),
      enrichmentQueue.getCompleted(0, -1)
    ]);

    const scrapingRate = calculateProcessingRate(scrapingCompleted, since);
    const callingRate = calculateProcessingRate(callingCompleted, since);
    const enrichmentRate = calculateProcessingRate(enrichmentCompleted, since);

    // Get error rates
    const [scrapingFailed, callingFailed, enrichmentFailed] = await Promise.all([
      scrapingQueue.getFailed(0, -1),
      callingQueue.getFailed(0, -1),
      enrichmentQueue.getFailed(0, -1)
    ]);

    const scrapingErrorRate = calculateErrorRate(scrapingCompleted, scrapingFailed, since);
    const callingErrorRate = calculateErrorRate(callingCompleted, callingFailed, since);
    const enrichmentErrorRate = calculateErrorRate(enrichmentCompleted, enrichmentFailed, since);

    res.json({
      timeRange,
      timestamp: now,
      stats: {
        scraping: scrapingStats,
        calling: callingStats,
        enrichment: enrichmentStats
      },
      processingRates: {
        scraping: scrapingRate,
        calling: callingRate,
        enrichment: enrichmentRate
      },
      errorRates: {
        scraping: scrapingErrorRate,
        calling: callingErrorRate,
        enrichment: enrichmentErrorRate
      },
      health: {
        scraping: await getQueueHealth(scrapingQueue),
        calling: await getQueueHealth(callingQueue),
        enrichment: await getQueueHealth(enrichmentQueue)
      }
    });
  } catch (error) {
    logger.error('Error getting queue metrics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Get calling hours status for different timezones
 * @route GET /api/admin/calling-hours
 * @access Admin
 */
router.get('/calling-hours', adminMiddleware, async (req, res) => {
  try {
    const timezones = [
      'America/New_York',
      'America/Chicago', 
      'America/Denver',
      'America/Los_Angeles',
      'America/Phoenix'
    ];

    const callingStatus = timezones.map(timezone => {
      const allowed = isCallingHoursAllowed(timezone);
      const now = new Date();
      const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      
      return {
        timezone,
        localTime: localTime.toLocaleTimeString(),
        callingAllowed: allowed,
        hour: localTime.getHours()
      };
    });

    res.json({
      callingStatus,
      restrictions: {
        startHour: 9,
        endHour: 20,
        description: 'Calls allowed between 9 AM and 8 PM local time'
      }
    });
  } catch (error) {
    logger.error('Error getting calling hours status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Helper functions

function getQueueByName(queueName) {
  const queues = {
    'scraping-queue': scrapingQueue,
    'calling-queue': callingQueue,
    'enrichment-queue': enrichmentQueue
  };
  return queues[queueName];
}

function formatJobInfo(job) {
  return {
    id: job.id,
    name: job.name,
    data: job.data,
    progress: job.progress(),
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    delay: job.delay
  };
}

async function getQueueHealth(queue) {
  try {
    const stats = await queue.getJobCounts();
    const isPaused = await queue.isPaused();
    
    // Calculate health score based on various factors
    let healthScore = 100;
    
    // Reduce score for high failure rate
    const totalJobs = stats.completed + stats.failed;
    if (totalJobs > 0) {
      const failureRate = (stats.failed / totalJobs) * 100;
      healthScore -= Math.min(failureRate * 2, 50); // Max 50 point reduction
    }
    
    // Reduce score for too many waiting jobs
    if (stats.waiting > 100) {
      healthScore -= Math.min((stats.waiting - 100) / 10, 30); // Max 30 point reduction
    }
    
    // Reduce score if paused
    if (isPaused) {
      healthScore -= 20;
    }
    
    return {
      score: Math.max(0, Math.round(healthScore)),
      status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical',
      isPaused,
      stats
    };
  } catch (error) {
    return {
      score: 0,
      status: 'error',
      error: error.message
    };
  }
}

function parseTimeRange(range) {
  const ranges = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000
  };
  return ranges[range] || ranges['1h'];
}

function calculateProcessingRate(jobs, since) {
  const recentJobs = jobs.filter(job => job.finishedOn && job.finishedOn >= since);
  const timeRangeMinutes = (Date.now() - since) / (1000 * 60);
  return timeRangeMinutes > 0 ? recentJobs.length / timeRangeMinutes : 0;
}

function calculateErrorRate(completedJobs, failedJobs, since) {
  const recentCompleted = completedJobs.filter(job => job.finishedOn && job.finishedOn >= since);
  const recentFailed = failedJobs.filter(job => job.finishedOn && job.finishedOn >= since);
  const total = recentCompleted.length + recentFailed.length;
  return total > 0 ? (recentFailed.length / total) * 100 : 0;
}

module.exports = router;