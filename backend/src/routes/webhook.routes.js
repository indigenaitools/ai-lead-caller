const express = require('express');
const router = express.Router();
const WebhookController = require('../controllers/webhook.controller');

// Middleware to parse raw body for webhook signature validation
const rawBodyParser = express.raw({ type: 'application/x-www-form-urlencoded' });

// Plivo webhook routes
router.post('/plivo/answer', 
  rawBodyParser,
  WebhookController.validateWebhookSignature,
  WebhookController.handleAnswer
);

router.post('/plivo/input',
  rawBodyParser,
  WebhookController.validateWebhookSignature,
  WebhookController.handleInput
);

router.post('/plivo/hangup',
  rawBodyParser,
  WebhookController.validateWebhookSignature,
  WebhookController.handleHangup
);

router.post('/plivo/machine',
  rawBodyParser,
  WebhookController.validateWebhookSignature,
  WebhookController.handleMachine
);

router.post('/plivo/recording',
  rawBodyParser,
  WebhookController.validateWebhookSignature,
  WebhookController.handleRecording
);

router.post('/plivo/callback',
  rawBodyParser,
  WebhookController.validateWebhookSignature,
  WebhookController.handleCallback
);

// Generic webhook endpoint for testing
router.post('/plivo/test', (req, res) => {
  console.log('Test webhook received:', req.body);
  res.status(200).json({ status: 'received' });
});

module.exports = router;