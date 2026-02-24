const { RouterOSAPI } = require('node-routeros');

async function testConnection(options) {
    console.log(`Testing connection to ${options.host}:${options.port} (TLS: ${options.tls})...`);
    const conn = new RouterOSAPI({
        host: options.host,
        user: options.user,
        password: options.password,
        port: options.port,
        tls: options.tls,
        timeout: 20
    });

    try {
        console.log("Connecting...");
        const client = await conn.connect();
        console.log("Connected successfully!");

        console.log("Getting resource...");
        const resource = await client.menu('/system/resource').get();
        console.log("Resource:", resource);

        conn.close();
        return true;
    } catch (err) {
        console.error(`Connection failed: ${err.message}`);
        return false;
    }
}

async function run() {
    const creds = {
        host: '103.120.221.221',
        user: 'raju',
        password: '9192'
    };

    // Try port 8082 plain
    await testConnection({ ...creds, port: 8082, tls: false });

    // Try port 8082 TLS
    await testConnection({ ...creds, port: 8082, tls: true });

    // Try port 8081 plain
    await testConnection({ ...creds, port: 8081, tls: false });
}

run();
