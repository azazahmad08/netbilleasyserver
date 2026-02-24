const { RouterOSClient } = require('routeros-client');

async function test() {
    console.log("Testing connection...");
    const conn = new RouterOSClient({
        host: '103.120.221.221',
        user: 'raju',
        password: '9192',
        port: 8082,
        timeout: 10
    });

    try {
        console.log("Connecting...");
        const client = await conn.connect();
        console.log("Connected!");

        console.log("Fetching resource...");
        const resource = await client.menu('/system/resource').get();
        console.log("Resource:", resource);

        conn.close();
        console.log("Closed.");
    } catch (err) {
        console.error("Connection failed:", err);
    }
}

test();
