const https = require('https');

const apiKey = 'C3002844699989a73d1a56.67910950';
const url = `https://sms.mram.com.bd/smsapi?api_key=${apiKey}&type=text&contacts=8801700000000&msg=test`; // Missing senderid

https.get(url, (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => {
        console.log('Raw Response:', data);
        console.log('Type of response:', typeof data);
    });
});
