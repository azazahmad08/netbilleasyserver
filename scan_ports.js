const net = require('net');

async function probe(host, port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);
        socket.connect(port, host, () => {
            console.log(`Port ${port} is OPEN on ${host}`);
            socket.destroy();
            resolve(true);
        });

        socket.on('error', (err) => {
            // console.log(`Port ${port} is closed: ${err.message}`);
            socket.destroy();
            resolve(false);
        });

        socket.on('timeout', () => {
            // console.log(`Port ${port} timed out`);
            socket.destroy();
            resolve(false);
        });
    });
}

const host = '103.120.221.221';
const ports = [80, 81, 8080, 8081, 8082, 8728, 8729, 8291, 22, 23];

async function scan() {
    console.log(`Scanning ${host}...`);
    for (const port of ports) {
        await probe(host, port);
    }
    console.log('Scan complete.');
}

scan();
