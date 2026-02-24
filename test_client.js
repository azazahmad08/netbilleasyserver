const { RosClient } = require('routeros-client');

async function test() {
    const client = new RosClient({
        host: '103.120.221.221',
        user: 'raju',
        password: '9192',
        port: 8081
    });

    try {
        console.log('Connecting to 8081 with routeros-client...');
        const conn = await client.connect();
        console.log('Connected!');
        const secrets = await conn.menu('/ppp/secret').get();
        console.log('Secrets found:', secrets.length);
        await client.close();
    } catch (err) {
        console.error('Error on 8081:', err.message);
    }
}

test();
