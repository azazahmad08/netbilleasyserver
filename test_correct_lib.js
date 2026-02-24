const { RouterOSClient } = require('routeros-client');

async function test() {
    const client = new RouterOSClient({
        host: '103.120.221.221',
        user: '1122',
        password: '1122',
        port: 11255
    });

    try {
        console.log('Connecting to 103.120.221.221:11255 with RouterOSClient...');
        const api = await client.connect();
        console.log('Connected!');

        // With routeros-client, connect() returns an api object that has .menu()
        const secrets = await api.menu('/ppp/secret').get();
        console.log(`Secrets found: ${secrets.length}`);

        const profiles = await api.menu('/ppp/profile').get();
        console.log(`Profiles found: ${profiles.length}`);

        await client.close();
        console.log('Connection closed.');
    } catch (err) {
        console.error('Connection failed:', err.message);
    }
}

test();
