const https = require('https');
const querystring = require('querystring');

const apiKey = 'C3002844699989a73d1a56.67910950';
const postData = querystring.stringify({
    'api_key': apiKey,
    'type': 'text',
    'contacts': '8801700000000',
    'senderid': '8809612440734',
    'msg': 'test'
});

const options = {
    hostname: 'sms.mram.com.bd',
    port: 443,
    path: '/smsapi',
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => console.log('POST Response:', data));
});

req.write(postData);
req.end();
