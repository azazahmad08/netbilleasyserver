const { RouterOSClient } = require('routeros-client');

async function testPort(port) {
    console.log(`Testing port ${port}...`);
    const conn = new RouterOSClient({
        host: '103.120.221.221',
        user: 'raju',
        password: '9192',
        port: port,
        timeout: 5
    });

    try {
        const client = await conn.connect();
        console.log(`Port ${port}: SUCCESS!`);
        conn.close();
    } catch (err) {
        console.log(`Port ${port}: FAILED (${err.message})`);
    }
}

async function run() {
    await testPort(8081);
    await testPort(8082);
    await testPort(8728);
}

run();
