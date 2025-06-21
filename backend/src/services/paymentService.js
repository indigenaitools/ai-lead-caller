const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');

/**
 * Create a Stripe customer
 * @param {Object} user - User object
 * @returns {String} Stripe customer ID
 */
exports.createCustomer = async (user) => {
  try {
    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: {
        userId: user._id.toString()
      }
    });
    
    return customer.id;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
};

/**
 * Create a subscription for a customer
 * @param {String} customerId - Stripe customer ID
 * @param {String} priceId - Stripe price ID
 * @returns {Object} Subscription object
 */
exports.createSubscription = async (customerId, priceId) => {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent']
    });
    
    return {
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret
    };
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
};

/**
 * Get subscription details
 * @param {String} subscriptionId - Stripe subscription ID
 * @returns {Object} Subscription details
 */
exports.getSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    console.error('Error retrieving subscription:', error);
    throw error;
  }
};

/**
 * Cancel a subscription
 * @param {String} subscriptionId - Stripe subscription ID
 * @returns {Object} Canceled subscription
 */
exports.cancelSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.del(subscriptionId);
    return subscription;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
};

/**
 * Create a checkout session for purchasing credits
 * @param {String} customerId - Stripe customer ID
 * @param {Number} creditAmount - Amount of credits to purchase
 * @param {Number} unitPrice - Price per credit in cents
 * @param {String} successUrl - URL to redirect on success
 * @param {String} cancelUrl - URL to redirect on cancel
 * @returns {Object} Checkout session
 */
exports.createCreditCheckoutSession = async (
  customerId,
  creditAmount,
  unitPrice,
  successUrl,
  cancelUrl
) => {
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Lead Generation Credits',
              description: `${creditAmount} credits for lead generation`
            },
            unit_amount: unitPrice
          },
          quantity: creditAmount
        }
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        creditAmount: creditAmount.toString()
      }
    });
    
    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

/**
 * Handle webhook events from Stripe
 * @param {Object} event - Stripe event object
 */
exports.handleWebhookEvent = async (event) => {
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        
        // Handle credit purchase
        if (session.mode === 'payment' && session.metadata.creditAmount) {
          const customerId = session.customer;
          const creditAmount = parseInt(session.metadata.creditAmount, 10);
          
          // Find user by Stripe customer ID
          const user = await User.findOne({ stripeCustomerId: customerId });
          
          if (user) {
            // Add credits to user account
            user.credits += creditAmount;
            await user.save();
            console.log(`Added ${creditAmount} credits to user ${user._id}`);
          }
        }
        break;
      }
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        // Find user by Stripe customer ID
        const user = await User.findOne({ stripeCustomerId: customerId });
        
        if (user) {
          // Update user subscription status based on Stripe subscription
          const status = subscription.status;
          
          if (status === 'active' || status === 'trialing') {
            // Determine subscription tier based on price
            const priceId = subscription.items.data[0].price.id;
            
            // Map price IDs to subscription tiers
            // This would be configured based on your actual Stripe price IDs
            const priceTierMap = {
              'price_basic': 'basic',
              'price_premium': 'premium',
              'price_enterprise': 'enterprise'
            };
            
            // Set user subscription tier
            for (const [priceKey, tier] of Object.entries(priceTierMap)) {
              if (priceId.includes(priceKey)) {
                user.subscription = tier;
                break;
              }
            }
            
            await user.save();
            console.log(`Updated subscription for user ${user._id} to ${user.subscription}`);
          } else if (status === 'canceled' || status === 'unpaid') {
            // Downgrade to free tier
            user.subscription = 'free';
            await user.save();
            console.log(`Downgraded subscription for user ${user._id} to free`);
          }
        }
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Error handling webhook event:', error);
    throw error;
  }
};