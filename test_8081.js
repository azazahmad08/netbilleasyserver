const { RouterOSAPI } = require('node-routeros');

async function test() {
    const conn = new RouterOSAPI({
        host: '103.120.221.221',
        user: 'raju',
        password: '9192',
        port: 8081,
        timeout: 5
    });

    try {
        console.log('Connecting to 8081...');
        await conn.connect();
        console.log('Connected!');
        const secrets = await conn.menu('/ppp/secret').get();
        console.log('Secrets found:', secrets.length);
        await conn.close();
    } catch (err) {
        console.error('Error on 8081:', err.message);
    }
}

test();
