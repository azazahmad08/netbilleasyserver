const { RouterOSAPI } = require('node-routeros');

async function test() {
    const conn = new RouterOSAPI({
        host: '103.120.221.221',
        user: '1122',
        password: '1122',
        port: 11255,
        timeout: 10
    });

    try {
        console.log('Connecting to 103.120.221.221:11255...');
        await conn.connect();
        console.log('Connected successfully!');

        const secrets = await conn.menu('/ppp/secret').get();
        console.log(`Secrets found: ${secrets.length}`);

        const profiles = await conn.menu('/ppp/profile').get();
        console.log(`Profiles found: ${profiles.length}`);

        await conn.close();
        console.log('Connection closed.');
    } catch (err) {
        console.error('Connection failed:', err.message);
    }
}

test();
