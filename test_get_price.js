const https = require('https');

const apiKey = 'C3002844699989a73d1a56.67910950';
const url = `https://sms.mram.com.bd/miscapi/${apiKey}/getPrice`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => console.log('Response:', data));
});
