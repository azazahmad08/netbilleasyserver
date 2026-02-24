const https = require('https');

const b64 = Buffer.from('C3002844:3NGFIx06OZ').toString('base64');
const url = `https://sms.mram.com.bd/smsapi?api_key=${b64}&type=text&contacts=8801700000000&senderid=8809612440734&msg=test`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => console.log('B64 Response:', data));
});
