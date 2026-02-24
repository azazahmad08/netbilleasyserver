const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

const getDb = () => {
    if (!fs.existsSync(DB_FILE)) {
        console.log(`[DB] Creating new DB file at ${DB_FILE}`);
        fs.writeFileSync(DB_FILE, JSON.stringify({ clients: [], tickets: [], invoices: [], packages: [], routers: [], users: [] }));
    }
    const content = fs.readFileSync(DB_FILE);
    // console.log(`[DB] Read ${content.length} bytes from ${DB_FILE}`);
    return JSON.parse(content);
};

const saveDb = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

module.exports = {
    // Clients
    findAllClients: async () => getDb().clients,
    findClientById: async (id) => getDb().clients.find(c => c._id === id),
    createClient: async (data) => {
        const db = getDb();
        const newClient = {
            ...data,
            _id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            createdAt: new Date()
        };
        db.clients.push(newClient);
        saveDb(db);
        return newClient;
    },
    updateClient: async (id, data) => {
        const db = getDb();
        const index = db.clients.findIndex(c => c._id === id);
        if (index === -1) return null;
        db.clients[index] = { ...db.clients[index], ...data };
        saveDb(db);
        return db.clients[index];
    },
    deleteClient: async (id) => {
        const db = getDb();
        db.clients = db.clients.filter(c => c._id !== id);
        saveDb(db);
        return true;
    },
    addClientNote: async (id, text) => {
        const db = getDb();
        const index = db.clients.findIndex(c => c._id === id);
        if (index === -1) return null;

        if (!db.clients[index].notes) db.clients[index].notes = [];

        const newNote = {
            _id: Date.now().toString(),
            text,
            createdAt: new Date()
        };

        db.clients[index].notes.push(newNote);
        saveDb(db);
        return { client: db.clients[index], note: newNote };
    },
    bulkCreateClients: async (clientsArray) => {
        const db = getDb();
        const existingUsernames = new Set(db.clients.map(c => c.username));
        const newClients = [];

        clientsArray.forEach((client, idx) => {
            if (!existingUsernames.has(client.username)) {
                const newClient = {
                    ...client,
                    _id: `${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
                    createdAt: new Date(),
                    balance: 0,
                    status: 'Active'
                };
                db.clients.push(newClient);
                newClients.push(newClient);
                existingUsernames.add(newClient.username);
            }
        });

        saveDb(db);
        return newClients;
    },

    // Tickets
    findAllTickets: async () => {
        const db = getDb();
        if (!db.tickets) return [];
        return db.tickets.map(t => ({
            ...t,
            clientId: db.clients.find(c => c._id === t.clientId) || { name: 'Unknown' }
        }));
    },
    createTicket: async (data) => {
        const db = getDb();
        const newTicket = { ...data, _id: Date.now().toString(), createdAt: new Date(), comments: [] };
        db.tickets.push(newTicket);
        saveDb(db);
        return newTicket;
    },
    updateTicket: async (id, data) => {
        const db = getDb();
        const index = db.tickets.findIndex(t => t._id === id);
        if (index === -1) return null;
        db.tickets[index] = { ...db.tickets[index], ...data };
        saveDb(db);
        return db.tickets[index];
    },

    // Areas
    findAllAreas: async () => getDb().areas || [],
    createArea: async (data) => {
        const db = getDb();
        if (!db.areas) db.areas = [];
        const newArea = { ...data, _id: Date.now().toString(), subAreas: [], createdAt: new Date() };
        db.areas.push(newArea);
        saveDb(db);
        return newArea;
    },
    updateArea: async (id, data) => {
        const db = getDb();
        const index = db.areas.findIndex(a => a._id === id);
        if (index === -1) return null;
        db.areas[index] = { ...db.areas[index], ...data };
        saveDb(db);
        return db.areas[index];
    },
    deleteArea: async (id) => {
        const db = getDb();
        db.areas = db.areas.filter(a => a._id !== id);
        saveDb(db);
        return true;
    },
    createSubArea: async (areaId, data) => {
        const db = getDb();
        const index = db.areas.findIndex(a => a._id === areaId);
        if (index === -1) return null;
        if (!db.areas[index].subAreas) db.areas[index].subAreas = [];
        const newSubArea = { ...data, _id: Date.now().toString(), createdAt: new Date() };
        db.areas[index].subAreas.push(newSubArea);
        saveDb(db);
        return newSubArea;
    },

    // Invoices
    findAllInvoices: async () => getDb().invoices,
    findInvoicesByClient: async (clientId) => {
        const db = getDb();
        return (db.invoices || []).filter(inv => inv.clientId === clientId);
    },
    createInvoice: async (data) => {
        const db = getDb();
        const newInv = { ...data, _id: 'INV-' + Date.now().toString().slice(-6), createdAt: new Date() };
        db.invoices.push(newInv);
        saveDb(db);
        return newInv;
    },
    rechargeClient: async (id, data) => {
        const db = getDb();
        const index = db.clients.findIndex(c => c._id === id);
        if (index === -1) return null;

        const amount = Number(data.amount) || 0;
        const discount = Number(data.discount) || 0;
        const finalAmount = amount - discount;

        // NEW: Deduct from Reseller balance if applicable
        if (data.rechargedBy) {
            const userIndex = db.users?.findIndex(u => u._id === data.rechargedBy);
            if (userIndex !== -1 && db.users[userIndex].role === 'Reseller') {
                const currentBalance = Number(db.users[userIndex].balance) || 0;
                if (currentBalance < finalAmount) {
                    throw new Error('Insufficient balance in reseller wallet. Please top up.');
                }
                db.users[userIndex].balance = currentBalance - finalAmount;
            }
        }

        // Update client balance
        db.clients[index].balance = (db.clients[index].balance || 0) - finalAmount;

        // Automatically set status to Active
        db.clients[index].status = 'Active';

        // Extend billing date
        const currentDate = new Date(db.clients[index].date || new Date());
        const newDate = new Date(currentDate);
        if (newDate < new Date()) {
            newDate.setMonth(new Date().getMonth() + 1);
        } else {
            newDate.setMonth(newDate.getMonth() + 1);
        }
        db.clients[index].date = newDate.toISOString().split('T')[0];

        // Create Invoice/Transaction
        const newInvoice = {
            _id: 'INV-' + Date.now().toString().slice(-6),
            clientId: id,
            clientName: db.clients[index].name,
            amount: finalAmount,
            type: data.billType || 'Bill',
            billingType: data.billingType || 'Monthly',
            medium: data.rechargedBy ? 'Wallet' : (data.medium || 'Hand Cash'),
            rechargedBy: data.rechargedBy || 'Admin',
            months: data.months || [],
            discount: discount,
            createdAt: new Date()
        };

        if (!db.invoices) db.invoices = [];
        db.invoices.push(newInvoice);

        saveDb(db);
        return { client: db.clients[index], invoice: newInvoice };
    },


    // Mikrotik Routers
    findAllRouters: async () => getDb().routers || [],
    createRouter: async (data) => {
        const db = getDb();
        if (!db.routers) db.routers = [];
        const newRouter = { ...data, _id: Date.now().toString(), createdAt: new Date() };
        db.routers.push(newRouter);
        saveDb(db);
        return newRouter;
    },
    findRouterById: async (id) => {
        const db = getDb();
        const routers = db.routers || [];
        // console.log(`[DB] Looking for router ID: "${id}". Available: ${routers.map(r => `"${r._id}"`).join(', ')}`);
        return routers.find(r => r._id === id);
    },
    updateRouter: async (id, data) => {
        const db = getDb();
        const index = db.routers?.findIndex(r => r._id === id);
        if (index === -1) return null;
        db.routers[index] = { ...db.routers[index], ...data };
        saveDb(db);
        return db.routers[index];
    },
    deleteRouter: async (id) => {
        const db = getDb();
        db.routers = (db.routers || []).filter(r => r._id !== id);
        saveDb(db);
        return true;
    },

    // Users (Admins/Resellers)
    findAllUsers: async () => getDb().users || [],
    findUserById: async (id) => (getDb().users || []).find(u => u._id === id),
    createUser: async (data) => {
        const db = getDb();
        if (!db.users) db.users = [];
        const newUser = {
            ...data,
            _id: Date.now().toString(),
            balance: Number(data.balance) || 0,
            role: data.role || 'Reseller',
            createdAt: new Date()
        };
        db.users.push(newUser);
        saveDb(db);
        return newUser;
    },
    updateUser: async (id, data) => {
        const db = getDb();
        if (!db.users) return null;
        const index = db.users.findIndex(u => u._id === id);
        if (index === -1) return null;
        db.users[index] = { ...db.users[index], ...data };
        saveDb(db);
        return db.users[index];
    },
    addResellerBalance: async (resellerId, amount) => {
        const db = getDb();
        if (!db.users) return null;
        const index = db.users.findIndex(u => u._id === resellerId);
        if (index === -1) return null;
        db.users[index].balance = (Number(db.users[index].balance) || 0) + Number(amount);
        saveDb(db);
        return db.users[index];
    }
};
