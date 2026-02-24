const https = require('https');

const apiKey = 'C3002844699989a73d1a56.67910950';
const urls = [
    `https://sms.mram.com.bd/getBalance?api_key=${apiKey}`,
    `https://sms.mram.com.bd/api/getBalance?api_key=${apiKey}`,
    `https://sms.mram.com.bd/miscapi/getBalance/${apiKey}`,
    `https://sms.mram.com.bd/miscapi/${apiKey}/getBalance`
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
