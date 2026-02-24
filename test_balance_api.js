const https = require('https');
require('dotenv').config();

const apiKey = 'C3002844699989a73d1a56.67910950';
const url = `https://sms.mram.com.bd/miscapi/${apiKey}/getBalance`;

console.log('Testing Balance API:', url);

https.get(url, (res) => {
    let data = '';
    console.log('Status Code:', res.statusCode);
    res.on('data', (c) => data += c);
    res.on('end', () => {
        console.log('Raw Data:', data);
        try {
            const json = JSON.parse(data);
            console.log('Parsed JSON:', json);
        } catch (e) {
            console.log('Not a JSON response');
        }
    });
}).on('error', (err) => {
    console.error('Request Error:', err.message);
});
