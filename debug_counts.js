const db = require('./src/db');
async function run() {
    const clients = await db.findAllClients();
    const r1Clients = clients.filter(c => c.mikrotik === 'r1');
    console.log('Total Clients:', clients.length);
    console.log('r1 Clients:', r1Clients.length);
    process.exit();
}
run();
