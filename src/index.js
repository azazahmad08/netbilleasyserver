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
    role: { type: String, enum: ['SuperAdmin', 'Admin', 'Reseller', 'SubReseller', 'Staff'], default: 'Reseller' },
    balance: { type: Number, default: 0 },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    permissions: { type: [String], default: [] },
    parentId: { type: String }
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
    const defaultData = {
        clients: [],
        tickets: [],
        invoices: [],
        packages: [],
        routers: [],
        users: [{ _id: 'admin-1', name: 'Super Admin', username: 'admin', password: 'admin', role: 'SuperAdmin', status: 'Active', permissions: ['All Permission'] }],
        logs: [],
        areas: []
    };
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
    }
    const db = JSON.parse(fs.readFileSync(DB_FILE));

    // Ensure all keys exist
    Object.keys(defaultData).forEach(key => {
        if (!db[key]) db[key] = defaultData[key];
    });

    // Bootstrap if no users exist
    if (!db.users || db.users.length === 0) {
        db.users = defaultData.users;
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    }
    return db;
};

const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

const db = {
    findAllClients: async () => getDb().clients || [],
    findClientById: async (id) => (getDb().clients || []).find(c => c._id === id),
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
        const clients = d.clients || [];
        return (d.tickets || []).map(t => ({ ...t, clientId: clients.find(c => c._id === t.clientId) || { name: 'Unknown' } }));
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
    deleteTicket: async (id) => {
        const d = getDb();
        d.tickets = (d.tickets || []).filter(t => t._id !== id);
        saveDb(d);
        return true;
    },
    addTicketComment: async (id, commentData) => {
        const d = getDb();
        const idx = d.tickets?.findIndex(t => t._id === id);
        if (idx === -1) return null;
        if (!d.tickets[idx].comments) d.tickets[idx].comments = [];
        const newComment = { ...commentData, date: new Date() };
        d.tickets[idx].comments.push(newComment);
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
    findClientsWithDue: async () => {
        const d = getDb();
        return (d.clients || []).filter(c => Number(c.balance || 0) > 0);
    },
    batchGenerateInvoices: async (month) => {
        const d = getDb();
        const activeClients = (d.clients || []).filter(c => c.status === 'Active');
        let count = 0;
        for (const c of activeClients) {
            const bill = Number(c.bill || 0);
            if (bill > 0) {
                const cIdx = d.clients.findIndex(cli => cli._id === c._id);
                d.clients[cIdx].balance = (Number(d.clients[cIdx].balance) || 0) + bill;
                const newInv = {
                    _id: 'SYS-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 100),
                    clientId: c._id,
                    clientName: c.name,
                    amount: bill,
                    type: 'Monthly Bill',
                    status: 'Pending',
                    clientBalance: d.clients[cIdx].balance,
                    monthly: bill,
                    createdAt: new Date()
                };
                if (!d.invoices) d.invoices = [];
                d.invoices.push(newInv);
                count++;
            }
        }
        saveDb(d);
        return count;
    },

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
        const newInvoice = { _id: 'INV-' + Date.now().toString().slice(-6), clientId: id, clientName: d.clients[idx].name, amount: finalAmount, type: data.billType || 'Bill', billingType: data.billingType || 'Monthly', days: data.billingType === 'Daily' ? data.days : 0, medium: data.rechargedBy ? 'Wallet' : (data.medium || 'Hand Cash'), rechargedBy: data.rechargedBy || 'Admin', months: data.months || [], discount: discount, clientBalance: d.clients[idx].balance, monthly: d.clients[idx].price || d.clients[idx].bill || 0, createdAt: new Date() };
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

        // 2. Check System Users (Admin, Reseller, Staff) from Database
        const users = await db.findAllUsers();
        let user = users.find(u => (
            (u.username === username || u.phone === username || u.mobile === username || u._id === username) &&
            u.password === password
        ));

        if (user) {
            if (user.status === 'Inactive') return res.status(403).json({ success: false, message: 'Account is inactive' });
            return res.json({
                success: true,
                user: {
                    _id: user._id,
                    role: user.role,
                    name: user.name,
                    permissions: user.permissions || [],
                    parentId: user.parentId,
                    balance: user.balance || 0
                }
            });
        }

        // 3. Check Clients (Regular User/Customer)
        const clients = await db.findAllClients();
        const client = clients.find(c => (
            (c.username === username || c.phone === username || c.pppoeName === username || c.customerId === username) &&
            c.password === password
        ));

        if (client) {
            if (client.status === 'Inactive') return res.status(403).json({ success: false, message: 'Your internet account is inactive. Please contact support.' });
            return res.json({
                success: true,
                user: {
                    _id: client._id,
                    role: 'User',
                    name: client.name,
                    username: client.username,
                    package: client.package,
                    balance: client.balance || 0,
                    expiryDate: client.date,
                    phone: client.phone
                }
            });
        }

        return res.status(401).json({ success: false, message: 'Invalid credentials. Please check your username/phone and password.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Clients
app.get('/api/clients', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const user = await db.findUserById(userId);
        const dbClients = await db.findAllClients();
        const routers = await db.findAllRouters(userId);

        let allSecrets = [];
        for (const r of routers) {
            try {
                const { client, api } = await connectRouter(r);
                const secrets = await api.menu('/ppp/secret').get();
                allSecrets = allSecrets.concat(secrets.map(s => ({
                    ...s,
                    routerId: r._id,
                    routerName: r.name
                })));
                await client.close();
            } catch (err) {
                console.error(`Client sync skipped for ${r.name}: Router offline`);
            }
        }

        // Map secrets to DB clients
        const enrichedClients = allSecrets.map(s => {
            const dbClient = dbClients.find(c => c.username === s.name || c.pppoeName === s.name);
            return {
                _id: dbClient?._id || `mt-${s[".id"]}`,
                name: dbClient?.name || s.comment || s.name,
                username: s.name,
                password: s.password,
                package: s.profile,
                status: s.disabled === 'true' ? 'Inactive' : 'Active',
                balance: dbClient?.balance || 0,
                bill: dbClient?.price || dbClient?.bill || 0,
                date: dbClient?.date || dbClient?.createdAt || '',
                phone: dbClient?.phone || '',
                mikrotik: s.routerId,
                routerName: s.routerName,
                isAutoImported: !dbClient
            };
        });

        let filtered = enrichedClients;
        if (user && user.role === 'Reseller') {
            // Further filter if reseller is implemented
        }

        res.json(filtered);
    } catch (e) { res.status(500).json({ message: e.message }); }
});
app.get('/api/clients/stats', async (req, res) => {
    try {
        const routers = await db.findAllRouters(req.headers['x-user-id']);
        const invoices = await db.findAllInvoices();
        const dbClients = await db.findAllClients();

        let totalSecrets = 0;
        let activeSecrets = 0;
        let activeSessions = 0;

        for (const r of routers) {
            try {
                const { client, api } = await connectRouter(r);
                const secrets = await api.menu('/ppp/secret').get();
                const active = await api.menu('/ppp/active').get();

                totalSecrets += secrets.length;
                activeSecrets += secrets.filter(s => s.disabled === 'false').length;
                activeSessions += active.length;
                await client.close();
            } catch (err) {
                console.error(`Router stats failed for ${r.name}: ${err.message}`);
            }
        }

        const stats = {
            totalClients: totalSecrets,
            activeClients: activeSecrets,
            inactiveClients: totalSecrets - activeSecrets,
            totalDue: dbClients.reduce((acc, c) => acc + (Number(c.balance || 0) > 0 ? Number(c.balance) : 0), 0),
            expectedMonthly: dbClients.filter(c => c.status === 'Active').reduce((acc, c) => acc + Number(c.bill || 0), 0),
            totalCollection: invoices.reduce((acc, inv) => acc + Number(inv.amount || 0), 0),
            totalRouters: routers.length,
            onlineSessions: activeSessions
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
app.get('/api/clients/:id/invoices', async (req, res) => {
    try {
        const invoices = await db.findInvoicesByClient(req.params.id);
        res.json(invoices.reverse());
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

app.put('/api/clients/:id', async (req, res) => {
    try {
        const oldClient = (await db.findAllClients()).find(c => c._id === req.params.id);
        const client = await db.updateClient(req.params.id, req.body);
        if (client && client.mikrotik) {
            await mikrotikController.updateSecret(client.mikrotik, oldClient.pppoeName || oldClient.username, {
                name: client.pppoeName || client.username,
                password: client.password,
                profile: client.package,
                comment: `ID: ${client.customerId || ''}, Name: ${client.name || ''}`
            });
        }
        await logActivity(req, { description: `Updated customer: ${client.name}`, module: 'customer', action: 'UPDATE' });
        res.json(client);
    } catch (e) { res.status(400).json({ message: e.message }); }
});

app.delete('/api/clients/:id', async (req, res) => {
    try {
        const client = (await db.findAllClients()).find(c => c._id === req.params.id);
        if (client && client.mikrotik) {
            await mikrotikController.deleteSecret(client.mikrotik, client.pppoeName || client.username);
        }
        await db.deleteClient(req.params.id);
        await logActivity(req, { description: `Deleted customer: ${client ? client.name : req.params.id}`, module: 'customer', action: 'DELETE' });
        res.json({ message: 'Client deleted' });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// Mikrotik
app.get('/api/mikrotik', async (req, res) => { res.json(await db.findAllRouters(req.headers['x-user-id'])); });
app.get('/api/mikrotik/stats', async (req, res) => {
    try {
        const routers = await db.findAllRouters(req.headers['x-user-id']);
        let onlineRouters = 0;
        let totalSecrets = 0;
        let activeUsers = 0;

        for (const r of routers) {
            try {
                const { client, api } = await connectRouter(r);
                onlineRouters++;
                const secrets = await api.menu('/ppp/secret').get();
                const active = await api.menu('/ppp/active').get();
                totalSecrets += secrets.length;
                activeUsers += active.length;
                await client.close();
            } catch (err) {
                console.error(`Router ${r.name} stats fetch failed: ${err.message}`);
            }
        }

        res.json({
            totalRouters: routers.length,
            onlineRouters,
            totalSecrets,
            activeUsers,
            offlineUsers: totalSecrets - activeUsers
        });
    } catch (e) { res.status(500).json({ message: e.message }); }
});
app.get('/api/mikrotik/active', async (req, res) => {
    try {
        const routers = await db.findAllRouters(req.headers['x-user-id']);
        let allActive = [];
        for (const r of routers) {
            try {
                const { client, api } = await connectRouter(r);
                const active = await api.menu('/ppp/active').get();
                allActive = allActive.concat(active.map(a => ({ ...a, routerName: r.name })));
                await client.close();
            } catch (err) { console.error(`Failed to fetch active users from ${r.name}`); }
        }
        res.json(allActive);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/mikrotik/:id/ping', async (req, res) => {
    try {
        const r = await db.findRouterById(req.params.id);
        const { client } = await connectRouter(r);
        await client.close();
        res.json({ status: 'Online' });
    } catch (e) { res.json({ status: 'Offline', message: e.message }); }
});
app.post('/api/mikrotik', async (req, res) => {
    try {
        const router = await db.createRouter(req.body, req.headers['x-user-id']);
        res.status(201).json(router);
    } catch (e) { res.status(400).json({ message: e.message }); }
});
app.get('/api/mikrotik/:id', async (req, res) => {
    const router = await db.findRouterById(req.params.id);
    router ? res.json(router) : res.status(404).json({ message: 'Router not found' });
});
app.put('/api/mikrotik/:id', async (req, res) => {
    try {
        const router = await db.updateRouter(req.params.id, req.body);
        router ? res.json(router) : res.status(404).json({ message: 'Router not found' });
    } catch (e) { res.status(400).json({ message: e.message }); }
});
app.delete('/api/mikrotik/:id', async (req, res) => {
    await db.deleteRouter(req.params.id);
    res.json({ message: 'Router deleted' });
});
app.get('/api/mikrotik/:id/secrets', async (req, res) => {
    try {
        const router = await db.findRouterById(req.params.id);
        const { client, api } = await connectRouter(router);
        const secrets = await api.menu('/ppp/secret').get();
        await client.close();
        res.json(secrets);
    } catch (e) { res.status(500).json({ message: e.message }); }
});
app.get('/api/mikrotik/:id/profiles', async (req, res) => {
    try {
        const router = await db.findRouterById(req.params.id);
        const { client, api } = await connectRouter(router);
        const profiles = await api.menu('/ppp/profile').get();
        await client.close();
        res.json(profiles);
    } catch (e) { res.status(500).json({ message: e.message }); }
});
app.post('/api/mikrotik/:id/import-secrets', async (req, res) => {
    try {
        const router = await db.findRouterById(req.params.id);
        const { client, api } = await connectRouter(router);
        const secrets = await api.menu('/ppp/secret').get();
        await client.close();
        const clientsToImport = secrets.map(s => ({
            name: String(s.comment || s.name),
            username: s.name,
            phone: (s.comment?.match(/\d{11}/) || ['00000000000'])[0],
            package: s.profile,
            zone: 'Imported',
            mikrotik: req.params.id
        }));
        const imported = await db.bulkCreateClients(clientsToImport);
        res.json({ message: 'Import successful', total: secrets.length, imported: imported.length });
    } catch (e) { res.status(500).json({ message: e.message }); }
});
app.get('/api/mikrotik/:id/history', async (req, res) => {
    try {
        const router = await db.findRouterById(req.params.id);
        const { client, api } = await connectRouter(router);
        const resources = await api.menu('/system/resource').get();
        await client.close();
        res.json(resources[0] || {});
    } catch (e) { res.status(500).json({ message: e.message }); }
});
app.get('/api/mikrotik/:id/monitor', async (req, res) => {
    try {
        const router = await db.findRouterById(req.params.id);
        const { client, api } = await connectRouter(router);
        const interfaceName = req.query.interface || 'ether1';
        // Note: routeros-client's monitor traffic might be complex. This is a simplified version.
        const stats = await api.write(['/interface/monitor-traffic', '=interface=' + interfaceName, '=once=']);
        await client.close();
        res.json(stats);
    } catch (e) { res.status(500).json({ message: e.message }); }
});



// Users
app.get('/api/users', async (req, res) => res.json(await db.findAllUsers(true)));
app.get('/api/users/me', async (req, res) => res.json(await db.findUserById(req.headers['x-user-id'] || 'admin-1')));
app.post('/api/users', async (req, res) => res.status(201).json(await db.createUser(req.body, req.headers['x-user-id'])));
app.get('/api/users/:id', async (req, res) => {
    const user = await db.findUserById(req.params.id);
    user ? res.json(user) : res.status(404).json({ message: 'User not found' });
});
app.put('/api/users/:id', async (req, res) => {
    const user = await db.updateUser(req.params.id, req.body);
    user ? res.json(user) : res.status(404).json({ message: 'User not found' });
});
app.delete('/api/users/:id', async (req, res) => {
    await db.deleteUser(req.params.id);
    res.status(204).send();
});
app.post('/api/users/:id/add-balance', async (req, res) => {
    try {
        const user = await db.addResellerBalance(req.params.id, req.body.amount, req.headers['x-user-id']);
        user ? res.json(user) : res.status(404).json({ message: 'User not found' });
    } catch (e) { res.status(400).json({ message: e.message }); }
});


// SMS
app.get('/api/sms/balance', async (req, res) => res.json(await checkSMSBalance()));
app.post('/api/sms/send-manual', async (req, res) => res.json(await sendSMS(req.body.number, req.body.message)));
app.post('/api/sms/send-bulk', async (req, res) => res.json(await sendBulkSMS(req.body.messages)));
app.post('/api/sms/send-client', async (req, res) => {
    try {
        const client = (await db.findAllClients()).find(c => c._id === req.body.clientId);
        if (client && client.phone) {
            const result = await sendSMS(client.phone, req.body.message);
            res.json(result);
        } else {
            res.status(404).json({ message: 'Client or phone not found' });
        }
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// Billing/Accounts
app.get('/api/billing/stats', async (req, res) => {
    try {
        const clients = await db.findAllClients();
        const invoices = await db.findAllInvoices();
        const stats = {
            totalCollected: invoices.filter(i => i.type === 'Bill' || !i.status || i.status === 'Paid').reduce((acc, i) => acc + Number(i.amount || 0), 0),
            pendingDues: clients.reduce((acc, c) => acc + (Number(c.balance || 0) > 0 ? Number(c.balance) : 0), 0),
            dueClientsCount: clients.filter(c => Number(c.balance || 0) > 0).length,
            targetRevenue: clients.reduce((acc, c) => acc + Number(c.bill || 0), 0)
        };
        res.json(stats);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/billing/generate-batch', async (req, res) => {
    try {
        const count = await db.batchGenerateInvoices(req.body.month);
        await logActivity(req, { description: `Generated batch invoices for ${count} clients`, module: 'billing', action: 'BATCH' });
        res.json({ success: true, count });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/billing/broadcast-sms', async (req, res) => {
    try {
        const dueClients = await db.findClientsWithDue();
        const messages = dueClients.filter(c => c.phone && c.phone.length >= 11).map(c => ({
            to: c.phone,
            message: req.body.template.replace('{name}', c.name).replace('{balance}', c.balance).replace('{id}', c.customerId || c.username)
        }));
        if (messages.length === 0) return res.json({ success: true, sent: 0, message: 'No clients with due found' });
        const result = await sendBulkSMS(messages);
        await logActivity(req, { description: `Broadcasted SMS to ${messages.length} clients`, module: 'sms', action: 'BROADCAST' });
        res.json({ success: true, sent: messages.length, providerResponse: result });
    } catch (e) { res.status(500).json({ message: e.message }); }
});


// Areas & Zones
app.get('/api/areas', async (req, res) => res.json(await db.findAllAreas()));
app.post('/api/areas', async (req, res) => {
    try {
        const area = await db.createArea(req.body);
        await logActivity(req, { description: `Created Area: ${area.name}`, module: 'area', action: 'CREATE' });
        res.status(201).json(area);
    } catch (e) { res.status(400).json({ message: e.message }); }
});
app.delete('/api/areas/:id', async (req, res) => {
    await db.deleteArea(req.params.id);
    res.status(204).send();
});
app.post('/api/areas/:id/subareas', async (req, res) => {
    try {
        const subArea = await db.createSubArea(req.params.id, req.body);
        res.status(201).json(subArea);
    } catch (e) { res.status(400).json({ message: e.message }); }
});

// Tickets
app.get('/api/tickets', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const user = await db.findUserById(userId);
        let tickets = await db.findAllTickets();

        // If it's a regular Customer (User), show only their tickets
        if (!user) {
            const clients = await db.findAllClients();
            const client = clients.find(c => c._id === userId);
            if (client) {
                tickets = tickets.filter(t => t.clientId?._id === userId || t.clientId === userId);
            }
        } else if (user.role === 'Reseller' || user.role === 'SubReseller') {
            // Future: filter by reseller's clients
        }

        res.json(tickets);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/tickets', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const user = await db.findUserById(userId);
        let ticketData = { ...req.body };

        // If User/Customer is creating the ticket, force their clientId
        if (!user) {
            ticketData.clientId = userId;
        }

        const ticket = await db.createTicket(ticketData);
        await logActivity(req, { description: `Raised support ticket: ${ticket.subject}`, module: 'support', action: 'CREATE' });
        res.status(201).json(ticket);
    } catch (e) { res.status(400).json({ message: e.message }); }
});

app.put('/api/tickets/:id', async (req, res) => {
    try {
        const ticket = await db.updateTicket(req.params.id, req.body);
        ticket ? res.json(ticket) : res.status(404).json({ message: 'Ticket not found' });
    } catch (e) { res.status(400).json({ message: e.message }); }
});

app.delete('/api/tickets/:id', async (req, res) => {
    await db.deleteTicket(req.params.id);
    res.status(204).send();
});

app.post('/api/tickets/:id/comments', async (req, res) => {
    try {
        const ticket = await db.addTicketComment(req.params.id, req.body);
        ticket ? res.json(ticket) : res.status(404).json({ message: 'Ticket not found' });
    } catch (e) { res.status(400).json({ message: e.message }); }
});

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
