const axios = require('axios');

async function test() {
    try {
        console.log('Testing /api/mikrotik/r1/profiles...');
        const res = await axios.get('http://localhost:5000/api/mikrotik/r1/profiles');
        console.log('Profiles:', res.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.status : error.message);
        if (error.response) console.error('Data:', error.response.data);
    }
}

test();
