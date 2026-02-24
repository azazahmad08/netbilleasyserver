const https = require('https');

const username = 'C3002844';
const password = '3NGFIx06OZ';

const urls = [
    `https://bulksmsbd.net/getkey/${username}/${password}`,
    `https://sms.mram.com.bd/getkey/${username}/${password}`
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
