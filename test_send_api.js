const https = require('https');

const apiKey = 'C3002844699989a73d1a56.67910950';
const senderId = '8809612440734';
const number = '8801700000000'; // Fake number for testing
const msg = encodeURIComponent('Test Message From System');

// Testing the standard endpoint from their doc
const url = `https://sms.mram.com.bd/smsapi?api_key=${apiKey}&type=text&contacts=${number}&senderid=${senderId}&msg=${msg}`;

console.log('Testing Send API:', url);

https.get(url, (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => {
        console.log('Response:', data);
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
