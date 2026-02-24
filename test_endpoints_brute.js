const https = require('https');

const apiKey = 'C3002844699989a73d1a56.67910950';
const endpoints = [
    'getSenderId',
    'getSenderList',
    'getMasking',
    'getMaskingList',
    'getProfile',
    'getUser',
    'getPrice',
    'getDLR/getAll'
];

async function test() {
    for (const ep of endpoints) {
        const url = `https://sms.mram.com.bd/miscapi/${apiKey}/${ep}`;
        console.log(`\nTesting Endpoint: [${ep}]`);
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
