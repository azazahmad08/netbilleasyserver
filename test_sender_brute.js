const https = require('https');

const apiKey = 'C3002844699989a73d1a56.67910950';
const number = '8801700000000';
const msg = encodeURIComponent('test');

const senderIds = [
    '8809612440734',
    'Non-Masking',
    'mram',
    'MRAM',
    'NetBill',
    'NetBillEasy',
    '8801712345678',
    'C3002844',
    '880447',
    '88018',
    ''
];

async function test() {
    for (const sid of senderIds) {
        const url = `https://sms.mram.com.bd/smsapi?api_key=${apiKey}&type=text&contacts=${number}&senderid=${encodeURIComponent(sid)}&msg=${msg}`;
        console.log(`\nTesting SenderID: [${sid}]`);
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
