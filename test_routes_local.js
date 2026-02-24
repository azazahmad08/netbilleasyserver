const axios = require('axios');

async function test() {
    try {
        console.log('Testing /api/mikrotik...');
        const res1 = await axios.get('http://localhost:5000/api/mikrotik');
        console.log('Routers:', res1.data);

        console.log('\nTesting /api/mikrotik/r1...');
        const res2 = await axios.get('http://localhost:5000/api/mikrotik/r1');
        console.log('Router r1:', res2.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.status : error.message);
        if (error.response) console.error('Data:', error.response.data);
    }
}

test();
