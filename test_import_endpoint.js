const axios = require('axios');

async function test() {
    try {
        console.log('Testing dynamic POST http://localhost:5000/api/mikrotik/r1/import-secrets...');
        const res = await axios.post('http://localhost:5000/api/mikrotik/r1/import-secrets');
        console.log('SUCCESS:', res.data);
    } catch (err) {
        console.error('FAILED:', err.response ? `${err.response.status} ${JSON.stringify(err.response.data)}` : err.message);
    }
}

test();
