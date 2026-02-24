const https = require('https');

const apiKey = 'C3002844699989a73d1a56.67910950';
const number = '8801700000000';
const msg = encodeURIComponent('test');

const urls = [
    `https://sms.mram.com.bd/smsapi?api_key=${apiKey}&type=text&contacts=${number}&msg=${msg}`,
    `https://sms.mram.com.bd/smsapi?api_key=${apiKey}&type=text&contacts=${number}&senderid=&msg=${msg}`,
    `https://sms.mram.com.bd/smsapi?api_key=${apiKey}&type=text&contacts=${number}&senderid=Non-Masking&msg=${msg}`
];

async function test() {
    for (const url of urls) {
        console.log('\nTesting:', url);
        await new Promise((resolve) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', (c) => data += c);
                res.on('end', () => {
                    console.log('Response:', data);
                    resolve();
                });
            }).on('error', (err) => {
                console.log('Error:', err.message);
                resolve();
            });
        });
    }
}

test();
