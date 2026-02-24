const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

const seed = () => {
    let db = { clients: [], tickets: [], invoices: [], packages: [], routers: [], users: [] };

    if (fs.existsSync(DB_FILE)) {
        db = JSON.parse(fs.readFileSync(DB_FILE));
    }

    if (!db.users) db.users = [];

    // Add Admin if not exists
    if (!db.users.find(u => u.phone === '01781805104')) {
        db.users.push({
            _id: 'admin-1',
            name: 'Songeet Admin',
            phone: '01781805104',
            password: 'NF123456',
            role: 'Admin',
            balance: 0,
            status: 'Active',
            createdAt: new Date()
        });
    }

    // Add Reseller if not exists
    if (!db.users.find(u => u.phone === '01700000000')) {
        db.users.push({
            _id: 'reseller-1',
            name: 'Md Arham',
            phone: '01700000000',
            password: 'NF123456',
            role: 'Reseller',
            balance: 4,
            status: 'Active',
            createdAt: new Date()
        });
    }

    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    console.log('Seeded users successfully.');
};

seed();
