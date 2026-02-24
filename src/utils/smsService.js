const https = require('https');

/**
 * Format number to 8801XXXXXXXXX
 */
const formatNumber = (number) => {
    let cleaned = number.toString().replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('01')) {
        return '88' + cleaned;
    }
    return cleaned;
};

/**
 * Common request handler for SMS API (GET method as per main example)
 */
const getRequest = (url) => {
    return new Promise((resolve, reject) => {
        const options = {
            timeout: 15000
        };

        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                data = data.trim();
                try {
                    // Try to parse as JSON
                    const result = JSON.parse(data);
                    console.log(`[SMS] Response:`, result);

                    // Handle both numeric/string raw codes and JSON objects
                    const code = result.response_code || result;
                    const isSuccess = code == 202 || !!result.success_message;

                    resolve({
                        success: isSuccess,
                        message: result.success_message || result.error_message || (isSuccess ? 'Success' : `Error ${code}`),
                        providerResponse: result
                    });
                } catch (e) {
                    // If not JSON, it might be a raw status code or HTML error
                    console.log(`[SMS] Non-JSON Response:`, data);
                    const isSuccess = data == '202';
                    resolve({
                        success: isSuccess,
                        message: isSuccess ? 'Success' : `Error ${data}`,
                        raw: data
                    });
                }
            });
        });

        req.on('error', (err) => {
            console.error('[SMS] Request error:', err);
            reject(err);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('SMS Gateway timeout'));
        });
    });
};

/**
 * Sends single SMS or same message to multiple contacts (One-to-Many)
 * @param {string|string[]} contacts - Recipient phone number or array of numbers
 * @param {string} message - Message content
 */
const sendSMS = async (contacts, message) => {
    const apiKey = process.env.SMS_API_KEY;
    const senderId = process.env.SMS_SENDER_ID || '8809612440734';

    if (!apiKey) return { success: false, message: 'API Key missing' };

    const contactList = Array.isArray(contacts) ? contacts : [contacts];
    const formattedContacts = contactList.map(formatNumber).join('+');

    // Detect if message is Unicode (Bangla)
    const type = /[\u0980-\u09FF]/.test(message) ? 'unicode' : 'text';

    const url = `https://sms.mram.com.bd/smsapi?api_key=${apiKey}&type=${type}&contacts=${formattedContacts}&senderid=${encodeURIComponent(senderId)}&msg=${encodeURIComponent(message)}&label=transactional`;

    return getRequest(url);
};

/**
 * Sends multiple different messages to different recipients (Many-to-Many)
 * Based on the provided documentation for JSON format
 */
const sendBulkSMS = async (messages) => {
    const apiKey = process.env.SMS_API_KEY;
    const senderId = process.env.SMS_SENDER_ID || '8809612440734';

    if (!apiKey) return { success: false, message: 'API Key missing' };

    const payload = {
        api_key: apiKey,
        senderid: senderId,
        messages: messages.map(m => ({
            to: formatNumber(m.to),
            message: m.message
        }))
    };

    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const options = {
            hostname: 'sms.mram.com.bd',
            port: 443,
            path: '/smsapimany',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            },
            timeout: 20000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve({
                        success: result.response_code == 202 || !!result.success_message,
                        providerResponse: result
                    });
                } catch (e) {
                    resolve({ success: false, raw: data });
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
};

/**
 * Check remaining credit balance
 */
const checkBalance = async () => {
    const apiKey = process.env.SMS_API_KEY;
    if (!apiKey) return { success: false, message: 'API Key missing' };

    const url = `https://sms.mram.com.bd/miscapi/${apiKey.trim()}/getBalance`;

    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => {
                // The API might return raw numbers or "Error: 1003"
                data = data.trim();
                if (!data || data.includes('Error')) {
                    console.warn('[SMS] Balance API returned error:', data);
                    return resolve({ success: false, balance: '0.00', raw: data });
                }

                try {
                    // If it's a number string (e.g. "125.50"), JSON.parse will work
                    const result = JSON.parse(data);
                    resolve({ success: true, balance: data, data: result });
                } catch (e) {
                    // If it's just a raw number "100.00" but not quoted JSON
                    if (!isNaN(data)) {
                        resolve({ success: true, balance: data, data: Number(data) });
                    } else {
                        resolve({ success: false, balance: '0.00', raw: data });
                    }
                }
            });
        }).on('error', (err) => {
            console.error('[SMS] Balance request failed:', err.message);
            resolve({ success: false, balance: '0.00' });
        });
    });
};

module.exports = { sendSMS, sendBulkSMS, checkBalance };
