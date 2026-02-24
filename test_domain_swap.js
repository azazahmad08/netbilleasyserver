const https = require('https');

const apiKey = 'C3002844699989a73d1a56.67910950';
const number = '8801700000000';

const urls = [
    `https://sms.mram.com.bd/smsapi?api_key=${apiKey}&type=text&contacts=${number}&senderid=8809612440734&msg=test`,
    `https://bulksmsbd.net/api/smsapi?api_key=${apiKey}&type=text&number=${number}&senderid=8809612440734&message=test`
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
