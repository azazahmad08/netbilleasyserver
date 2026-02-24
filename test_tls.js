const { RouterOSAPI } = require('node-routeros');

async function testTLS() {
    console.log("Testing TLS connection to port 8082...");
    const conn = new RouterOSAPI({
        host: '103.120.221.221',
        user: 'raju',
        password: '9192',
        port: 8082,
        tls: true,
        timeout: 10
    });

    conn.on('error', (err) => console.log('Client Error:', err.message));

    try {
        console.log("Calling connect()...");
        await conn.connect();
        console.log("CONNECTED with TLS!");
        conn.close();
    } catch (err) {
        console.log("FAILED TLS:", err.message);
        try { conn.close(); } catch (e) { }
    }
}

testTLS();
