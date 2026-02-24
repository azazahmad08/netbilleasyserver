const https = require('https');

const apiKey = 'C3002844';
const url = `https://sms.mram.com.bd/miscapi/${apiKey}/getBalance`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => console.log('Username as Key Balance Response:', data));
});
