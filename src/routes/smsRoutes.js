const express = require('express');
const router = express.Router();
const smsController = require('../controllers/smsController');

router.post('/send-manual', smsController.sendManualSMS);
router.post('/send-client', smsController.sendClientSMS);
router.post('/send-bulk', smsController.sendBulkMessages);
router.get('/balance', smsController.getBalance);

module.exports = router;
