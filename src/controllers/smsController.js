const { sendSMS, sendBulkSMS, checkBalance } = require('../utils/smsService');
const db = require('../db');

exports.sendManualSMS = async (req, res) => {
    try {
        const { number, message } = req.body;
        if (!number || !message) {
            return res.status(400).json({ success: false, message: 'Number and message are required' });
        }

        const result = await sendSMS(number, message);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.sendClientSMS = async (req, res) => {
    try {
        const { clientId, message } = req.body;
        const client = await db.findClientById(clientId);

        if (!client || !client.phone) {
            return res.status(404).json({ success: false, message: 'Client or phone number not found' });
        }

        const result = await sendSMS(client.phone, message);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.sendBulkMessages = async (req, res) => {
    try {
        const { messages } = req.body;
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ success: false, message: 'Invalid messages array' });
        }

        const result = await sendBulkSMS(messages);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getBalance = async (req, res) => {
    try {
        const result = await checkBalance();
        // Always return 200 so the frontend doesn't show "Request failed with status code 400"
        res.json({
            success: result.success,
            balance: result.balance || '0.00',
            data: result.data || null
        });
    } catch (error) {
        res.json({ success: false, balance: '0.00', message: error.message });
    }
};
