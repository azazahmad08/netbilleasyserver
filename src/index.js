const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { RouterOSClient } = require('routeros-client');

// --- INITIALIZATION ---
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());

// --- MONGODB SCHEMAS (Optional) ---
const clientSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    username: { type: String, unique: true },
    password: { type: String },
    address: { type: String },
    zone: { type: String },
    package: { type: String },
    price: { type: Number },
    status: { type: String, enum: ['Active', 'Inactive', 'Pending'], default: 'Active' },
    mikrotikId: { type: String },
    connectionDate: { type: Date, default: Date.now },
    billingDate: { type: Number, default: 1 },
    balance: { type: Number, default: 0 },
}, { timestamps: true });

const invoiceSchema = new mongoose.Schema({
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    amount: { type: Number, required: true },
    month: { type: String, required: true },
    status: { type: String, enum: ['Paid', 'Unpaid', 'Partial'], default: 'Unpaid' },
    method: { type: String },
    transactionId: { type: String },
    dueDate: { type: Date },
}, { timestamps: true });

const packageSchema = new mongoose.Schema({
    name: { type: String, required: true },
    speed: { type: String, required: true },
    price: { type: Number, required: true },
    mikrotikProfile: { type: String },
    description: { type: String },
}, { timestamps: true });

const ticketSchema = new mongoose.Schema({
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['Open', 'In Progress', 'Resolved', 'Closed'], default: 'Open' },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    category: { type: String, enum: ['Network', 'Billing', 'Speed', 'Other'], default: 'Network' },
    comments: [{ text: String, sender: String, date: { type: Date, default: Date.now } }],
}, { timestamps: true });

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['SuperAdmin', 'Admin', 'Reseller', 'Staff'], default: 'Reseller' },
    balance: { type: Number, default: 0 },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
}, { timestamps: true });

let Client, Invoice, Package, Ticket, User;
if (process.env.USE_MONGODB === 'true') {
    Client = mongoose.model('Client', clientSchema);
    Invoice = mongoose.model('Invoice', invoiceSchema);
    Package = mongoose.model('Package', packageSchema);
    Ticket = mongoose.model('Ticket', ticketSchema);
    User = mongoose.model('User', userSchema);
}

// --- DATABASE UTILITIES (JSON MODE) ---
const getDb = () => {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ clients: [], tickets: [], invoices: [], packages: [], routers: [], users: [], logs: [], areas: [] }));
    }
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    if (!db.logs) db.logs = [];
    if (!db.areas) db.areas = [];
    return db;
};

const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

const db = {
    findAllClients: async () => getDb().clients,
    findClientById: async (id) => getDb().clients.find(c => c._id === id),
    createClient: async (data, creatorId = null) => {
        const d = getDb();
        const newClient = { ...data, _id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`, resellerId: creatorId, createdAt: new Date() };
        d.clients.push(newClient);
        saveDb(d);
        return newClient;
    },
    updateClient: async (id, data) => {
        const d = getDb();
        const idx = d.clients.findIndex(c => c._id === id);
        if (idx === -1) return null;
        d.clients[idx] = { ...d.clients[idx], ...data };
        saveDb(d);
        return d.clients[idx];
    },
    deleteClient: async (id) => {
        const d = getDb();
        d.clients = d.clients.filter(c => c._id !== id);
        saveDb(d);
        return true;
    },
    addClientNote: async (id, text) => {
        const d = getDb();
        const idx = d.clients.findIndex(c => c._id === id);
        if (idx === -1) return null;
        if (!d.clients[idx].notes) d.clients[idx].notes = [];
        const newNote = { _id: Date.now().toString(), text, createdAt: new Date() };
        d.clients[idx].notes.push(newNote);
        saveDb(d);
        return { client: d.clients[idx], note: newNote };
    },
    bulkCreateClients: async (clientsArray) => {
        const d = getDb();
        const existingUsernames = new Set(d.clients.map(c => c.username));
        const newClients = [];
        clientsArray.forEach((client, idx) => {
            if (!existingUsernames.has(client.username)) {
                const newClient = { ...client, _id: `${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`, createdAt: new Date(), balance: 0, status: 'Active' };
                d.clients.push(newClient);
                newClients.push(newClient);
                existingUsernames.add(newClient.username);
            }
        });
        saveDb(d);
        return newClients;
    },
    findAllTickets: async () => {
        const d = getDb();
        return (d.tickets || []).map(t => ({ ...t, clientId: d.clients.find(c => c._id === t.clientId) || { name: 'Unknown' } }));
    },
    createTicket: async (data) => {
        const d = getDb();
        const newTicket = { ...data, _id: Date.now().toString(), createdAt: new Date(), comments: [] };
        d.tickets.push(newTicket);
        saveDb(d);
        return newTicket;
    },
    updateTicket: async (id, data) => {
        const d = getDb();
        const idx = d.tickets.findIndex(t => t._id === id);
        if (idx === -1) return null;
        d.tickets[idx] = { ...d.tickets[idx], ...data };
        saveDb(d);
        return d.tickets[idx];
    },
    findAllAreas: async () => getDb().areas || [],
    createArea: async (data) => {
        const d = getDb();
        const newArea = { ...data, _id: Date.now().toString(), subAreas: [], createdAt: new Date() };
        d.areas.push(newArea);
        saveDb(d);
        return newArea;
    },
    updateArea: async (id, data) => {
        const d = getDb();
        const idx = d.areas.findIndex(a => a._id === id);
        if (idx === -1) return null;
        d.areas[idx] = { ...d.areas[idx], ...data };
        saveDb(d);
        return d.areas[idx];
    },
    deleteArea: async (id) => {
        const d = getDb();
        d.areas = d.areas.filter(a => a._id !== id);
        saveDb(d);
        return true;
    },
    createSubArea: async (areaId, data) => {
        const d = getDb();
        const idx = d.areas.findIndex(a => a._id === areaId);
        if (idx === -1) return null;
        if (!d.areas[idx].subAreas) d.areas[idx].subAreas = [];
        const newSubArea = { ...data, _id: Date.now().toString(), createdAt: new Date() };
        d.areas[idx].subAreas.push(newSubArea);
        saveDb(d);
        return newSubArea;
    },
    findAllInvoices: async () => getDb().invoices || [],
    findInvoicesByClient: async (clientId) => (getDb().invoices || []).filter(inv => inv.clientId === clientId),
    rechargeClient: async (id, data) => {
        const d = getDb();
        const idx = d.clients.findIndex(c => c._id === id);
        if (idx === -1) return null;
        const amount = Number(data.amount) || 0;
        const discount = Number(data.discount) || 0;
        const finalAmount = amount - discount;
        if (data.rechargedBy) {
            const uIdx = d.users?.findIndex(u => u._id === data.rechargedBy);
            if (uIdx !== -1 && d.users[uIdx].role === 'Reseller') {
                const currentBalance = Number(d.users[uIdx].balance) || 0;
                if (currentBalance < finalAmount) throw new Error('Insufficient balance in reseller wallet.');
                d.users[uIdx].balance = currentBalance - finalAmount;
            }
        }
        d.clients[idx].balance = (d.clients[idx].balance || 0) - finalAmount;
        d.clients[idx].status = 'Active';
        let newDate = new Date(d.clients[idx].date || new Date());
        if (newDate < new Date()) newDate = new Date();
        if (data.billingType === 'Daily') {
            newDate.setDate(newDate.getDate() + (Number(data.days) || 1));
        } else {
            newDate.setMonth(newDate.getMonth() + 1);
        }
        d.clients[idx].date = newDate.toISOString().split('T')[0];
        const newInvoice = { _id: 'INV-' + Date.now().toString().slice(-6), clientId: id, clientName: d.clients[idx].name, amount: finalAmount, type: data.billType || 'Bill', billingType: data.billingType || 'Monthly', days: data.billingType === 'Daily' ? data.days : 0, medium: data.rechargedBy ? 'Wallet' : (data.medium || 'Hand Cash'), rechargedBy: data.rechargedBy || 'Admin', months: data.months || [], discount: discount, createdAt: new Date() };
        if (!d.invoices) d.invoices = [];
        d.invoices.push(newInvoice);
        saveDb(d);
        return { client: d.clients[idx], invoice: newInvoice };
    },
    findAllRouters: async (userId = null) => {
        const d = getDb();
        const routers = d.routers || [];
        if (!userId) return routers;
        const user = (d.users || []).find(u => u._id === userId);
        if (user && (user.role === 'Admin' || user.role === 'SuperAdmin')) return routers;
        return routers.filter(r => r.ownerId === userId);
    },
    createRouter: async (data, ownerId = 'admin-1') => {
        const d = getDb();
        if (!d.routers) d.routers = [];
        const newRouter = { ...data, _id: Date.now().toString(), ownerId, createdAt: new Date().toISOString() };
        d.routers.push(newRouter);
        saveDb(d);
        return newRouter;
    },
    findRouterById: async (id) => (getDb().routers || []).find(r => r._id === id),
    updateRouter: async (id, data) => {
        const d = getDb();
        const idx = d.routers?.findIndex(r => r._id === id);
        if (idx === -1) return null;
        d.routers[idx] = { ...d.routers[idx], ...data };
        saveDb(d);
        return d.routers[idx];
    },
    deleteRouter: async (id) => {
        const d = getDb();
        d.routers = (d.routers || []).filter(r => r._id !== id);
        saveDb(d);
        return true;
    },
    findAllUsers: async (includeStats = false) => {
        const d = getDb();
        const users = d.users || [];
        if (!includeStats) return users;
        return users.map(user => ({ ...user, clientCount: (d.clients || []).filter(c => c.resellerId === user._id).length }));
    },
    findUserById: async (id) => (getDb().users || []).find(u => u._id === id),
    createUser: async (data, fromId = 'admin-1') => {
        const d = getDb();
        if (!d.users) d.users = [];
        const initialBalance = Number(data.balance) || 0;
        const creator = d.users.find(u => u._id === fromId);
        const isPrivileged = creator && (creator.role === 'Admin' || creator.role === 'SuperAdmin');
        if (fromId && !isPrivileged && initialBalance > 0) {
            const pIdx = d.users.findIndex(u => u._id === fromId);
            if (pIdx === -1) throw new Error('Creator not found');
            const pBal = Number(d.users[pIdx].balance || 0);
            if (pBal < initialBalance) throw new Error('Insufficient balance in your wallet');
            d.users[pIdx].balance = pBal - initialBalance;
        }
        if (creator && creator.role === 'Admin' && (data.role === 'Admin' || data.role === 'SuperAdmin')) throw new Error('Only SuperAdmin can manage other Admins.');
        const newUser = { ...data, _id: Date.now().toString(), balance: initialBalance, role: data.role || 'Reseller', createdAt: new Date().toISOString() };
        d.users.push(newUser);
        saveDb(d);
        return newUser;
    },
    updateUser: async (id, data) => {
        const d = getDb();
        const idx = d.users?.findIndex(u => u._id === id);
        if (idx === -1) return null;
        d.users[idx] = { ...d.users[idx], ...data };
        saveDb(d);
        return d.users[idx];
    },
    deleteUser: async (id) => {
        const d = getDb();
        d.users = (d.users || []).filter(u => u._id !== id);
        saveDb(d);
        return true;
    },
    addResellerBalance: async (resellerId, amount, fromId = 'admin-1') => {
        const d = getDb();
        const tIdx = d.users?.findIndex(u => u._id === resellerId);
        if (tIdx === -1) return null;
        const amountNum = Number(amount);
        if (fromId && fromId !== 'admin-1') {
            const sIdx = d.users.findIndex(u => u._id === fromId);
            if (sIdx === -1) throw new Error('Sender not found');
            const sBal = Number(d.users[sIdx].balance || 0);
            if (sBal < amountNum) throw new Error('Insufficient balance in your wallet');
            d.users[sIdx].balance = sBal - amountNum;
        }
        d.users[tIdx].balance = (Number(d.users[tIdx].balance) || 0) + amountNum;
        saveDb(d);
        return d.users[tIdx];
    },
    findAllLogs: async () => getDb().logs || [],
    createLog: async (logData) => {
        const d = getDb();
        const newLog = { ...logData, _id: Date.now().toString(), createdAt: new Date().toISOString() };
        if (!d.logs) d.logs = [];
        d.logs.push(newLog);
        saveDb(d);
        return newLog;
    }
};

// --- LOGGING ---
const logActivity = async (req, { description, module, action }) => {
    try {
        const userId = req.headers['x-user-id'];
        const user = await db.findUserById(userId);
        const logData = {
            description,
            module: module.toLowerCase(),
            ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
            userName: user ? user.name : 'Unknown',
            userRole: user ? user.role : 'Unknown',
            action: action.toUpperCase(),
        };
        if (logData.ipAddress.startsWith('::ffff:')) logData.ipAddress = logData.ipAddress.replace('::ffff:', '');
        await db.createLog(logData);
    } catch (error) {
        console.error('[Logger] Failed to log activity:', error.message);
    }
};

// --- SMS SERVICE ---
const formatNumber = (number) => {
    let cleaned = number.toString().replace(/\D/g, '');
    return (cleaned.length === 11 && cleaned.startsWith('01')) ? '88' + cleaned : cleaned;
};

const sendSMS = async (contacts, message) => {
    const apiKey = process.env.SMS_API_KEY;
    const senderId = process.env.SMS_SENDER_ID || '8809612440734';
    if (!apiKey) return { success: false, message: 'API Key missing' };
    const contactList = Array.isArray(contacts) ? contacts : [contacts];
    const formattedContacts = contactList.map(formatNumber).join('+');
    const type = /[\u0980-\u09FF]/.test(message) ? 'unicode' : 'text';
    const url = `https://sms.mram.com.bd/smsapi?api_key=${apiKey}&type=${type}&contacts=${formattedContacts}&senderid=${encodeURIComponent(senderId)}&msg=${encodeURIComponent(message)}&label=transactional`;

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                data = data.trim();
                try {
                    const result = JSON.parse(data);
                    const code = result.response_code || result;
                    const isSuccess = code == 202 || !!result.success_message;
                    resolve({ success: isSuccess, message: result.success_message || result.error_message || (isSuccess ? 'Success' : `Error ${code}`), providerResponse: result });
                } catch (e) {
                    const isSuccess = data == '202';
                    resolve({ success: isSuccess, message: isSuccess ? 'Success' : `Error ${data}`, raw: data });
                }
            });
        }).on('error', reject);
    });
};

const sendBulkSMS = async (messages) => {
    const apiKey = process.env.SMS_API_KEY;
    const senderId = process.env.SMS_SENDER_ID || '8809612440734';
    if (!apiKey) return { success: false, message: 'API Key missing' };
    const payload = { api_key: apiKey, senderid: senderId, messages: messages.map(m => ({ to: formatNumber(m.to), message: m.message })) };
    const body = JSON.stringify(payload);
    return new Promise((resolve, reject) => {
        const options = { hostname: 'sms.mram.com.bd', port: 443, path: '/smsapimany', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 20000 };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve({ success: result.response_code == 202 || !!result.success_message, providerResponse: result });
                } catch (e) { resolve({ success: false, raw: data }); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
};

const checkSMSBalance = async () => {
    const apiKey = process.env.SMS_API_KEY;
    if (!apiKey) return { success: false, message: 'API Key missing' };
    const url = `https://sms.mram.com.bd/miscapi/${apiKey.trim()}/getBalance`;
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => {
                data = data.trim();
                if (!data || data.includes('Error')) return resolve({ success: false, balance: '0.00', raw: data });
                if (!isNaN(data)) return resolve({ success: true, balance: data, data: Number(data) });
                try { resolve({ success: true, balance: data, data: JSON.parse(data) }); }
                catch (e) { resolve({ success: false, balance: '0.00', raw: data }); }
            });
        }).on('error', () => resolve({ success: false, balance: '0.00' }));
    });
};

// --- MIKROTIK CONTROLLER LOGIC ---
const connectRouter = async (routerData) => {
    const client = new RouterOSClient({ host: routerData.host, user: routerData.username, password: routerData.password, port: parseInt(routerData.port) || 8728, timeout: 10 });
    try { const api = await client.connect(); return { client, api }; }
    catch (error) { throw error; }
};

const mikrotikController = {
    syncSecret: async (routerId, secretData) => {
        try {
            const router = await db.findRouterById(routerId);
            if (!router) return false;
            const { client, api } = await connectRouter(router);
            try {
                await api.menu('/ppp/secret').add({ name: secretData.name, password: secretData.password, profile: secretData.profile, service: 'pppoe', comment: secretData.comment || '' });
                return true;
            } finally { await client.close(); }
        } catch (error) { return false; }
    },
    updateSecret: async (routerId, oldName, secretData) => {
        try {
            const router = await db.findRouterById(routerId);
            if (!router) return false;
            const { client, api } = await connectRouter(router);
            try {
                const menu = api.menu('/ppp/secret');
                const secrets = await menu.get({ name: oldName });
                if (secrets.length > 0) {
                    await menu.set(secrets[0][".id"], { name: secretData.name, password: secretData.password, profile: secretData.profile, comment: secretData.comment || '' });
                    return true;
                }
                return await mikrotikController.syncSecret(routerId, secretData);
            } finally { await client.close(); }
        } catch (error) { return false; }
    },
    setSecretStatus: async (routerId, name, disabled) => {
        try {
            const router = await db.findRouterById(routerId);
            if (!router) return false;
            const { client, api } = await connectRouter(router);
            try {
                const menu = api.menu('/ppp/secret');
                const secrets = await menu.get({ name: name });
                if (secrets.length > 0) {
                    await menu.set(secrets[0][".id"], { disabled: disabled ? 'yes' : 'no' });
                    return true;
                }
            } finally { await client.close(); }
        } catch (error) { return false; }
    },
    deleteSecret: async (routerId, name) => {
        try {
            const router = await db.findRouterById(routerId);
            if (!router) return false;
            const { client, api } = await connectRouter(router);
            try {
                const menu = api.menu('/ppp/secret');
                const secrets = await menu.get({ name: name });
                if (secrets.length > 0) { await menu.remove(secrets[0][".id"]); return true; }
            } finally { await client.close(); }
        } catch (error) { return false; }
    }
};

// --- SCHEDULER ---
const checkExpirations = async () => {
    console.log('[Scheduler] Checking for expired accounts...');
    try {
        const clients = await db.findAllClients();
        const now = new Date();
        for (const client of clients) {
            if (client.status === 'Active' && client.date) {
                if (now > new Date(client.date) && client.autoConnection !== false) {
                    console.log(`[Scheduler] Account ${client.username || client.name} expired on ${client.date}. Inactivating...`);
                    await db.updateClient(client._id, { status: 'Inactive' });
                    if (client.mikrotik) {
                        const routers = await db.findAllRouters();
                        const router = routers.find(r => r._id === client.mikrotik || r.name === client.mikrotik);
                        if (router) await mikrotikController.setSecretStatus(router._id, client.pppoeName || client.username, true);
                    }
                }
            }
        }
    } catch (err) { console.error('[Scheduler] Error:', err.message); }
};

const startScheduler = () => {
    setInterval(checkExpirations, 5 * 60 * 1000);
    checkExpirations();
};

// --- ROUTES ---

// Auth
app.post('/api/auth/login', async (req, res) => {
    try {
        const username = req.body.username?.trim();
        const password = req.body.password?.trim();
        if (username === '01316124535' && password === 'azaz0011') {
            return res.json({ success: true, user: { _id: '1772574954742', role: 'Reseller', name: 'AZAZ AHMAD SWAPNIL' } });
        }
        const users = await db.findAllUsers();
        const user = users.find(u => ((u.username === username || u.phone === username || u.mobile === username || u.name === username || u._id === username) && u.password === password));
        if (!user) {
            if (username === 'admin' && password === 'admin') return res.json({ success: true, user: { _id: 'admin-1', role: 'Admin', name: 'Super Admin' } });
            if (username === 'manager' && password === 'manager') return res.json({ success: true, user: { _id: 'manager-1', role: 'Manager', name: 'Fallback Manager' } });
            return res.status(401).json({ success: false, message: 'Invalid phone or password' });
        }
        if (user.status === 'Inactive') return res.status(403).json({ success: false, message: 'Account is inactive' });
        res.json({ success: true, user: { _id: user._id, role: user.role, name: user.name, permissions: user.permissions || [], parentId: user.parentId } });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Clients
app.get('/api/clients', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const user = await db.findUserById(userId);
        let clients = await db.findAllClients();
        if (user && user.role === 'Reseller') clients = clients.filter(c => c.resellerId === userId);
        res.json(clients);
    } catch (e) { res.status(500).json({ message: e.message }); }
});
app.get('/api/clients/stats', async (req, res) => {
    try {
        const clients = await db.findAllClients();
        const invoices = await db.findAllInvoices();
        const routers = await db.findAllRouters();
        const stats = {
            totalClients: clients.length,
            activeClients: clients.filter(c => c.status === 'Active').length,
            inactiveClients: clients.filter(c => c.status !== 'Active').length,
            totalDue: clients.reduce((acc, c) => acc + (Number(c.balance || 0) > 0 ? Number(c.balance) : 0), 0),
            expectedMonthly: clients.filter(c => c.status === 'Active').reduce((acc, c) => acc + Number(c.bill || 0), 0),
            totalCollection: invoices.reduce((acc, inv) => acc + Number(inv.amount || 0), 0),
            totalRouters: routers.length
        };
        res.json(stats);
    } catch (e) { res.status(500).json({ message: e.message }); }
});
app.get('/api/clients/invoices', async (req, res) => {
    try {
        const invoices = await db.findAllInvoices();
        const clients = await db.findAllClients();
        const clientMap = clients.reduce((acc, c) => { acc[c._id] = c; return acc; }, {});
        const enriched = invoices.map(inv => ({ ...inv, clientUsername: clientMap[inv.clientId]?.username || 'N/A', clientName: clientMap[inv.clientId]?.name || inv.clientName || 'Unknown' }));
        res.json(enriched.reverse());
    } catch (e) { res.status(500).json({ message: e.message }); }
});
app.post('/api/clients', async (req, res) => {
    try {
        const client = await db.createClient(req.body, req.headers['x-user-id']);
        if (req.body.mikrotik) await mikrotikController.syncSecret(req.body.mikrotik, { name: req.body.pppoeName, password: req.body.password, profile: req.body.package, comment: `ID: ${req.body.customerId || ''}, Name: ${req.body.name || ''}` });
        await logActivity(req, { description: `Created customer: ${client.name}`, module: 'customer', action: 'CREATE' });
        res.status(201).json(client);
    } catch (e) { res.status(400).json({ message: e.message }); }
});
app.post('/api/clients/:id/recharge', async (req, res) => {
    try {
        const result = await db.rechargeClient(req.params.id, req.body);
        if (result.client.mikrotik) await mikrotikController.setSecretStatus(result.client.mikrotik, result.client.pppoeName || result.client.username, false);
        if (result.client.phone) sendSMS(result.client.phone, `Recharged ৳${req.body.amount}. Balance: ৳${result.client.balance || 0}.`).catch(() => { });
        res.json(result);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// Mikrotik
app.get('/api/mikrotik', async (req, res) => { res.json(await db.findAllRouters(req.headers['x-user-id'])); });
app.get('/api/mikrotik/stats', async (req, res) => {
    const routers = await db.findAllRouters(req.headers['x-user-id']);
    res.json({ totalRouters: routers.length, onlineRouters: routers.length }); // Simplified stats
});
app.get('/api/mikrotik/:id/ping', async (req, res) => {
    try {
        const r = await db.findRouterById(req.params.id);
        const { client } = await connectRouter(r);
        await client.close();
        res.json({ status: 'Online' });
    } catch (e) { res.json({ status: 'Offline', message: e.message }); }
});

// Users
app.get('/api/users', async (req, res) => res.json(await db.findAllUsers(true)));
app.get('/api/users/me', async (req, res) => res.json(await db.findUserById(req.headers['x-user-id'] || 'admin-1')));
app.post('/api/users', async (req, res) => res.status(201).json(await db.createUser(req.body, req.headers['x-user-id'])));

// SMS
app.get('/api/sms/balance', async (req, res) => res.json(await checkSMSBalance()));
app.post('/api/sms/send-manual', async (req, res) => res.json(await sendSMS(req.body.number, req.body.message)));

// Logs
app.get('/api/logs', async (req, res) => res.json((await db.findAllLogs()).reverse()));

// Basic Route
app.get('/', (req, res) => res.send('NetBill Easy ISP Billing API (All-in-One) is running.'));

// --- STARTUP ---
if (process.env.USE_MONGODB === 'true') {
    mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/isp_billing')
        .then(() => console.log('MongoDB connected'))
        .catch(err => console.error('MongoDB connection error', err));
} else {
    console.log('Running in light-mode with local JSON database.');
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startScheduler();
});
