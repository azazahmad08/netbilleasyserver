const https = require('https');

const url = `https://sms.mram.com.bd/getkey?username=C3002844&password=3NGFIx06OZ`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => console.log('GetKey Param Response:', data));
});
