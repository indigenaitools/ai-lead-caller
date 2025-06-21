const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../utils/authMiddleware');

// Protected routes
router.post('/create-subscription', authMiddleware, paymentController.createSubscription);
router.post('/cancel-subscription', authMiddleware, paymentController.cancelSubscription);
router.post('/create-credit-checkout', authMiddleware, paymentController.createCreditCheckout);
router.get('/subscription', authMiddleware, paymentController.getSubscription);

// Public route for Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

module.exports = router;