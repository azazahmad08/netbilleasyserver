const http = require('http');

const apiKey = 'C3002844699989a73d1a56.67910950';
const number = '8801700000000';
const msg = encodeURIComponent('test');
const senderId = '8809612440734';

const url = `http://sms.mram.com.bd/smsapi?api_key=${apiKey}&type=text&contacts=${number}&senderid=${senderId}&msg=${msg}`;

console.log('Testing with HTTP:', url);

http.get(url, (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => {
        console.log('Response:', data);
    });
});
