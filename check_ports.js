const net = require('net');

const host = '103.120.221.221';
const ports = [80, 8080, 8081, 8082, 8291, 8728, 8729];

console.log(`Scanning ports on ${host}...`);

ports.forEach(port => {
    const socket = new net.Socket();
    socket.setTimeout(3000);
    socket.on('connect', () => {
        console.log(`Port ${port} is OPEN`);
        socket.destroy();
    });
    socket.on('timeout', () => {
        console.log(`Port ${port} is CLOSED (Timeout)`);
        socket.destroy();
    });
    socket.on('error', (err) => {
        console.log(`Port ${port} is CLOSED (${err.message})`);
    });
    socket.connect(port, host);
});
