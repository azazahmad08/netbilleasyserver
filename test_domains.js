const https = require('https');

const apiKey = 'C3002844699989a73d1a56.67910950';
const domains = [
    'sms.mram.com.bd',
    'bulksms.mram.com.bd',
    'netbill.com.bd',
    'sms.netbill.com.bd'
];

async function test() {
    for (const domain of domains) {
        const url = `https://${domain}/miscapi/${apiKey}/getBalance`;
        console.log('\nTesting Domain:', domain);
        await new Promise((resolve) => {
            const req = https.get(url, (res) => {
                let data = '';
                res.on('data', (c) => data += c);
                res.on('end', () => {
                    console.log(`[${domain}] Status:`, res.statusCode);
                    console.log(`[${domain}] Response:`, data.substring(0, 100));
                    resolve();
                });
            }).on('error', (err) => {
                console.log(`[${domain}] Error:`, err.message);
                resolve();
            });
            req.setTimeout(5000, () => {
                console.log(`[${domain}] Timeout`);
                req.destroy();
                resolve();
            });
        });
    }
}

test();
