const { RouterOSClient } = require('routeros-client');

async function testConnection(routerData) {
    console.log(`Testing connection to ${routerData.name} (${routerData.host}:${routerData.port})...`);
    const client = new RouterOSClient({
        host: routerData.host.includes(':') ? routerData.host.split(':')[0] : routerData.host,
        user: routerData.username,
        password: routerData.password,
        port: parseInt(routerData.port) || 8728,
        timeout: 5
    });

    try {
        const api = await client.connect();
        console.log(`✅ Success! Connected to ${routerData.name}`);
        const resource = await api.menu('/system/resource').get();
        console.log('System Resource:', JSON.stringify(resource[0], null, 2));
        await client.close();
    } catch (error) {
        console.error(`❌ Failed! Could not connect to ${routerData.name}:`, error.message);
    }
}

const routers = [
    {
        "name": "Raju Main Router",
        "username": "1122",
        "password": "1122",
        "host": "103.120.221.221",
        "port": "11255"
    },
    {
        "name": "Raju",
        "username": "1234",
        "password": "1122",
        "host": "103.120.221.221", // Strip the :8082 if it was wrong
        "port": "11255"
    }
];

async function run() {
    for (const r of routers) {
        await testConnection(r);
        console.log('---');
    }
}

run();
