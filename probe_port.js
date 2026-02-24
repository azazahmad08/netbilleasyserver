const net = require('net');

function probe(port) {
    console.log(`Probing ${port}...`);
    const socket = new net.Socket();
    socket.connect(port, '103.120.221.221', () => {
        console.log(`Connected to ${port}`);
        // Send HTTP GET
        socket.write("GET / HTTP/1.0\r\n\r\n");
    });

    socket.on('data', (data) => {
        console.log(`Data from ${port}:`, data.toString());
        socket.destroy();
    });

    socket.on('error', (err) => console.log(`Error on ${port}:`, err.message));
    socket.on('close', () => console.log(`Closed ${port}`));
}

probe(8081);
probe(8082);
