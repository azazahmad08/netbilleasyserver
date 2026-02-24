const net = require('net');

const client = new net.Socket();
client.connect(8081, '103.120.221.221', () => {
    console.log('Connected to 8081');
    client.write('HEAD / HTTP/1.1\r\nHost: 103.120.221.221\r\n\r\n');
});

client.on('data', (data) => {
    console.log('Received:', data.toString());
    .
    client.destroy();
});

client.on('error', (err) => {
    console.log('Error:', err.message);
});

client.setTimeout(5000, () => {
    console.log('Timeout');
    client.destroy();
});
