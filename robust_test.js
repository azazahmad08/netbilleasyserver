const { RouterOSAPI } = require('node-routeros');

process.on('unhandledRejection', (reason, p) => {
    console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

async function test(port) {
    console.log(`Testing port ${port}...`);
    const conn = new RouterOSAPI({
        host: '103.120.221.221',
        user: 'raju',
        password: '9192',
        port: port,
        timeout: 30, // 30 seconds
        keepalive: true
    });

    conn.on('error', (err) => console.log('Client Error:', err.message));

    try {
        console.log("Calling connect()...");
        await conn.connect();
        console.log(`CONNECTED to port ${port}!`);

        const resource = await conn.write('/system/resource/print');
        console.log("Resource:", resource);

        conn.close();
        return true;
    } catch (err) {
        console.log(`FAILED on port ${port}:`, err.message);
        try { conn.close(); } catch (e) { }
        return false;
    }
}

async function run() {
    // Try 8082
    if (await test(8082)) return;

    // Try 8081
    if (await test(8081)) return;

    // Try 8728 (standard)
    await test(8728);
}

run();
