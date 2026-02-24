const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'src', 'db.json');

if (!fs.existsSync(DB_FILE)) {
    console.error('DB file not found!');
    process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

// Check router ID
const routerId = (db.routers && db.routers.length > 0) ? db.routers[0]._id : 'r1';
console.log(`Using Router ID: ${routerId}`);

let updatedCount = 0;
if (db.clients) {
    db.clients = db.clients.map(client => {
        if (!client.mikrotik && !client.mikrotikId) {
            updatedCount++;
            return { ...client, mikrotik: routerId };
        }
        return client;
    });
}

fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
console.log(`Updated ${updatedCount} clients with router ID: ${routerId}`);
