const https = require('https');

const apiKey = 'C3002844699989a73d1a56.67910950';
const senderId = '8809612440734';

const payload = JSON.stringify({
    api_key: apiKey,
    senderid: senderId,
    messages: [
        {
            to: '8801700000000',
            message: 'test bulk'
        }
    ]
});

const options = {
    hostname: 'sms.mram.com.bd',
    port: 443,
    path: '/smsapimany',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => console.log('Bulk Response:', data));
});

req.write(payload);
req.end();
