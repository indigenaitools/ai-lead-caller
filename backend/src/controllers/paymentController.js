const User = require('../models/User');
const paymentService = require('../services/paymentService');

/**
 * Create a subscription
 * @route POST /api/payments/create-subscription
 * @access Private
 */
exports.createSubscription = async (req, res) => {
  try {
    const { priceId } = req.body;
    
    if (!priceId) {
      return res.status(400).json({ message: 'Price ID is required' });
    }
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Create Stripe customer if not exists
    if (!user.stripeCustomerId) {
      const customerId = await paymentService.createCustomer(user);
      user.stripeCustomerId = customerId;
      await user.save();
    }
    
    // Create subscription
    const subscription = await paymentService.createSubscription(
      user.stripeCustomerId,
      priceId
    );
    
    res.json(subscription);
  } catch (error) {
    console.error('Error in createSubscription:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Cancel a subscription
 * @route POST /api/payments/cancel-subscription
 * @access Private
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    
    if (!subscriptionId) {
      return res.status(400).json({ message: 'Subscription ID is required' });
    }
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Cancel subscription
    const canceledSubscription = await paymentService.cancelSubscription(subscriptionId);
    
    // Update user subscription to free
    user.subscription = 'free';
    await user.save();
    
    res.json({
      message: 'Subscription canceled successfully',
      subscription: canceledSubscription
    });
  } catch (error) {
    console.error('Error in cancelSubscription:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Create a checkout session for purchasing credits
 * @route POST /api/payments/create-credit-checkout
 * @access Private
 */
exports.createCreditCheckout = async (req, res) => {
  try {
    const { creditAmount, successUrl, cancelUrl } = req.body;
    
    if (!creditAmount || !successUrl || !cancelUrl) {
      return res.status(400).json({ 
        message: 'Credit amount, success URL, and cancel URL are required' 
      });
    }
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Create Stripe customer if not exists
    if (!user.stripeCustomerId) {
      const customerId = await paymentService.createCustomer(user);
      user.stripeCustomerId = customerId;
      await user.save();
    }
    
    // Calculate price based on credit amount
    // Example: $0.50 per credit
    const unitPrice = 50; // in cents
    
    // Create checkout session
    const session = await paymentService.createCreditCheckoutSession(
      user.stripeCustomerId,
      creditAmount,
      unitPrice,
      successUrl,
      cancelUrl
    );
    
    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error in createCreditCheckout:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get user's subscription details
 * @route GET /api/payments/subscription
 * @access Private
 */
exports.getSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      subscription: user.subscription,
      credits: user.credits
    });
  } catch (error) {
    console.error('Error in getSubscription:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Handle Stripe webhook
 * @route POST /api/payments/webhook
 * @access Public
 */
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  if (!sig) {
    return res.status(400).json({ message: 'Stripe signature is required' });
  }
  
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    // Handle the event
    await paymentService.handleWebhookEvent(event);
    
    res.json({ received: true });
  } catch (error) {
    console.error('Error in handleWebhook:', error);
    res.status(400).json({ message: 'Webhook error', error: error.message });
  }
};