const https = require('https');

const username = 'C3002844';
const password = '3NGFIx06OZ';
const url = `https://sms.mram.com.bd/getkey/${username}/${password}`;

console.log('Testing Key Retrieval API:', url);

https.get(url, (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => {
        console.log('Response:', data);
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
