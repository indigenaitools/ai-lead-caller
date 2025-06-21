const User = require('../models/User');
const Campaign = require('../models/Campaign');
const Lead = require('../models/Lead');
const CallLog = require('../models/CallLog');
const ScriptTemplate = require('../models/ScriptTemplate');
const Voice = require('../models/Voice');
const logger = require('../utils/logger');
const { 
  scrapingQueue, 
  callingQueue, 
  enrichmentQueue 
} = require('../workers/callWorker');

/**
 * Get admin dashboard overview
 * @route GET /api/admin/dashboard
 * @access Admin
 */
exports.getDashboard = async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ 
      lastLoginDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
    });
    const paidUsers = await User.countDocuments({ 
      subscription: { $ne: 'free' } 
    });

    // Get campaign statistics
    const totalCampaigns = await Campaign.countDocuments();
    const activeCampaigns = await Campaign.countDocuments({ status: 'active' });
    const completedCampaigns = await Campaign.countDocuments({ status: 'completed' });

    // Get lead statistics
    const totalLeads = await Lead.countDocuments();
    const newLeads = await Lead.countDocuments({ status: 'new' });
    const contactedLeads = await Lead.countDocuments({ 
      status: { $in: ['contacted', 'qualified', 'converted'] } 
    });

    // Get call statistics
    const totalCalls = await CallLog.countDocuments();
    const todaysCalls = await CallLog.countDocuments({
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });
    const successfulCalls = await CallLog.countDocuments({ 
      outcome: { $in: ['answered', 'qualified', 'converted'] } 
    });

    // Get queue statistics
    const [scrapingStats, callingStats, enrichmentStats] = await Promise.all([
      scrapingQueue.getJobCounts(),
      callingQueue.getJobCounts(),
      enrichmentQueue.getJobCounts()
    ]);

    // Get recent activity
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('email firstName lastName createdAt subscription');

    const recentCampaigns = await Campaign.find()
      .populate('user', 'email firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name status createdAt totalLeads user');

    const recentCalls = await CallLog.find()
      .populate('lead', 'businessName phone')
      .populate('campaign', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('outcome duration createdAt lead campaign');

    res.json({
      statistics: {
        users: {
          total: totalUsers,
          active: activeUsers,
          paid: paidUsers,
          conversionRate: totalUsers > 0 ? ((paidUsers / totalUsers) * 100).toFixed(2) : 0
        },
        campaigns: {
          total: totalCampaigns,
          active: activeCampaigns,
          completed: completedCampaigns
        },
        leads: {
          total: totalLeads,
          new: newLeads,
          contacted: contactedLeads,
          contactRate: totalLeads > 0 ? ((contactedLeads / totalLeads) * 100).toFixed(2) : 0
        },
        calls: {
          total: totalCalls,
          today: todaysCalls,
          successful: successfulCalls,
          successRate: totalCalls > 0 ? ((successfulCalls / totalCalls) * 100).toFixed(2) : 0
        },
        queues: {
          scraping: scrapingStats,
          calling: callingStats,
          enrichment: enrichmentStats
        }
      },
      recentActivity: {
        users: recentUsers,
        campaigns: recentCampaigns,
        calls: recentCalls
      }
    });
  } catch (error) {
    logger.error('Error getting admin dashboard:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get all users with pagination and filtering
 * @route GET /api/admin/users
 * @access Admin
 */
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const subscription = req.query.subscription || '';
    const status = req.query.status || '';

    // Build filter
    const filter = {};
    
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (subscription) {
      filter.subscription = subscription;
    }
    
    if (status === 'active') {
      filter.lastLoginDate = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    } else if (status === 'inactive') {
      filter.lastLoginDate = { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    // Get additional stats for each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const campaignCount = await Campaign.countDocuments({ user: user._id });
      const leadCount = await Lead.countDocuments({ user: user._id });
      const callCount = await CallLog.countDocuments({ user: user._id });
      
      return {
        ...user.toObject(),
        stats: {
          campaigns: campaignCount,
          leads: leadCount,
          calls: callCount
        }
      };
    }));

    res.json({
      users: usersWithStats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting users:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Update user subscription or status
 * @route PUT /api/admin/users/:id
 * @access Admin
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { subscription, credits, isActive } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update allowed fields
    if (subscription !== undefined) {
      user.subscription = subscription;
    }
    
    if (credits !== undefined) {
      user.credits = credits;
    }
    
    if (isActive !== undefined) {
      user.isActive = isActive;
    }

    await user.save();

    logger.info(`User ${user.email} updated by admin ${req.user.email}`);

    res.json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        email: user.email,
        subscription: user.subscription,
        credits: user.credits,
        isActive: user.isActive
      }
    });
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get system analytics
 * @route GET /api/admin/analytics
 * @access Admin
 */
exports.getAnalytics = async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // User registration trends
    const userRegistrations = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Campaign creation trends
    const campaignCreations = await Campaign.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Call volume trends
    const callVolume = await CallLog.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 },
          avgDuration: { $avg: '$duration' },
          successCount: {
            $sum: {
              $cond: [
                { $in: ['$outcome', ['answered', 'qualified', 'converted']] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Subscription distribution
    const subscriptionStats = await User.aggregate([
      {
        $group: {
          _id: '$subscription',
          count: { $sum: 1 },
          totalCredits: { $sum: '$credits' }
        }
      }
    ]);

    // Top performing campaigns
    const topCampaigns = await Campaign.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $lookup: {
          from: 'leads',
          localField: '_id',
          foreignField: 'campaign',
          as: 'leads'
        }
      },
      {
        $lookup: {
          from: 'calllogs',
          localField: '_id',
          foreignField: 'campaign',
          as: 'calls'
        }
      },
      {
        $addFields: {
          leadCount: { $size: '$leads' },
          callCount: { $size: '$calls' },
          conversionRate: {
            $cond: [
              { $gt: [{ $size: '$leads' }, 0] },
              {
                $multiply: [
                  {
                    $divide: [
                      {
                        $size: {
                          $filter: {
                            input: '$leads',
                            cond: { $eq: ['$$this.status', 'converted'] }
                          }
                        }
                      },
                      { $size: '$leads' }
                    ]
                  },
                  100
                ]
              },
              0
            ]
          }
        }
      },
      {
        $sort: { conversionRate: -1 }
      },
      {
        $limit: 10
      },
      {
        $project: {
          name: 1,
          leadCount: 1,
          callCount: 1,
          conversionRate: 1,
          createdAt: 1
        }
      }
    ]);

    res.json({
      period,
      dateRange: {
        start: startDate,
        end: now
      },
      trends: {
        userRegistrations,
        campaignCreations,
        callVolume
      },
      distribution: {
        subscriptions: subscriptionStats
      },
      topPerformers: {
        campaigns: topCampaigns
      }
    });
  } catch (error) {
    logger.error('Error getting analytics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get system health status
 * @route GET /api/admin/health
 * @access Admin
 */
exports.getSystemHealth = async (req, res) => {
  try {
    // Check database connection
    const dbHealth = await checkDatabaseHealth();
    
    // Check Redis connection
    const redisHealth = await checkRedisHealth();
    
    // Check queue health
    const queueHealth = await checkQueueHealth();
    
    // Check external services
    const externalHealth = await checkExternalServices();
    
    // Calculate overall health score
    const healthChecks = [dbHealth, redisHealth, queueHealth, externalHealth];
    const healthyCount = healthChecks.filter(check => check.status === 'healthy').length;
    const overallHealth = (healthyCount / healthChecks.length) * 100;
    
    res.json({
      overall: {
        status: overallHealth >= 80 ? 'healthy' : overallHealth >= 60 ? 'warning' : 'critical',
        score: Math.round(overallHealth)
      },
      components: {
        database: dbHealth,
        redis: redisHealth,
        queues: queueHealth,
        external: externalHealth
      },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error getting system health:', error);
    res.status(500).json({ 
      overall: { status: 'critical', score: 0 },
      error: error.message 
    });
  }
};

// Helper functions

async function checkDatabaseHealth() {
  try {
    const start = Date.now();
    await User.findOne().limit(1);
    const responseTime = Date.now() - start;
    
    return {
      status: responseTime < 1000 ? 'healthy' : 'warning',
      responseTime,
      message: `Database responding in ${responseTime}ms`
    };
  } catch (error) {
    return {
      status: 'critical',
      error: error.message,
      message: 'Database connection failed'
    };
  }
}

async function checkRedisHealth() {
  try {
    const start = Date.now();
    await scrapingQueue.client.ping();
    const responseTime = Date.now() - start;
    
    return {
      status: responseTime < 500 ? 'healthy' : 'warning',
      responseTime,
      message: `Redis responding in ${responseTime}ms`
    };
  } catch (error) {
    return {
      status: 'critical',
      error: error.message,
      message: 'Redis connection failed'
    };
  }
}

async function checkQueueHealth() {
  try {
    const [scrapingStats, callingStats, enrichmentStats] = await Promise.all([
      scrapingQueue.getJobCounts(),
      callingQueue.getJobCounts(),
      enrichmentQueue.getJobCounts()
    ]);
    
    // Check for stuck jobs or high failure rates
    const totalJobs = scrapingStats.completed + scrapingStats.failed + 
                     callingStats.completed + callingStats.failed +
                     enrichmentStats.completed + enrichmentStats.failed;
    
    const totalFailed = scrapingStats.failed + callingStats.failed + enrichmentStats.failed;
    const failureRate = totalJobs > 0 ? (totalFailed / totalJobs) * 100 : 0;
    
    return {
      status: failureRate < 10 ? 'healthy' : failureRate < 25 ? 'warning' : 'critical',
      failureRate: Math.round(failureRate),
      stats: { scrapingStats, callingStats, enrichmentStats },
      message: `Queue failure rate: ${Math.round(failureRate)}%`
    };
  } catch (error) {
    return {
      status: 'critical',
      error: error.message,
      message: 'Queue health check failed'
    };
  }
}

async function checkExternalServices() {
  // This would check external APIs like Plivo, Stripe, etc.
  // For now, return a placeholder
  return {
    status: 'healthy',
    message: 'External services check not implemented',
    services: {
      plivo: 'unknown',
      stripe: 'unknown',
      groq: 'unknown'
    }
  };
}

module.exports = {
  getDashboard: exports.getDashboard,
  getUsers: exports.getUsers,
  updateUser: exports.updateUser,
  getAnalytics: exports.getAnalytics,
  getSystemHealth: exports.getSystemHealth
};