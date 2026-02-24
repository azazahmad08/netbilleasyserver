const net = require('net');

function probe(port) {
    console.log(`Checking port ${port}...`);
    const socket = new net.Socket();
    socket.setTimeout(3000);

    socket.connect(port, '103.120.221.221', () => {
        console.log(`SUCCESS: Port ${port} is OPEN`);
        socket.write('\x01\x00\x00\x00'); // Try to send something that might trigger a response from ROS API or something else
        setTimeout(() => socket.destroy(), 1000);
    });

    socket.on('data', (data) => {
        console.log(`DATA from ${port}:`, data.toString('hex').slice(0, 40));
        socket.destroy();
    });

    socket.on('error', (err) => {
        console.log(`ERROR on ${port}:`, err.message);
        socket.destroy();
    });

    socket.on('timeout', () => {
        console.log(`TIMEOUT on ${port}`);
        socket.destroy();
    });
}

[80, 8081, 8082, 8728, 8729, 8291].forEach(probe);
