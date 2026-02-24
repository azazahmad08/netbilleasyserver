const db = require('../db');
const mikrotikController = require('./mikrotikController');
const { sendSMS } = require('../utils/smsService');


exports.getAllClients = async (req, res) => {
    try {
        const clients = await db.findAllClients();
        res.json(clients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAllInvoices = async (req, res) => {
    try {
        const invoices = await db.findAllInvoices() || [];
        const clients = await db.findAllClients() || [];

        // Create a map of clients for faster lookup
        const clientMap = clients.reduce((acc, client) => {
            acc[client._id] = client;
            return acc;
        }, {});

        const enrichedInvoices = invoices.map(inv => {
            const client = clientMap[inv.clientId] || {};
            return {
                ...inv,
                clientUsername: client.username || 'N/A',
                clientPackage: client.package || 'N/A',
                clientDue: client.balance || 0,
                clientType: client.connectionType || 'PPPoE', // Assuming connectionType exists or default to PPPoE
                clientName: client.name || inv.clientName || 'Unknown'
            };
        });

        res.json(enrichedInvoices.reverse()); // Show newest first
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getClientInvoices = async (req, res) => {
    try {
        const invoices = await db.findInvoicesByClient(req.params.id);
        res.json(invoices || []);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        const clients = await db.findAllClients();
        const invoices = await db.findAllInvoices() || [];
        const routers = await db.findAllRouters();
        const tickets = await db.findAllTickets();

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const monthStr = now.toISOString().slice(0, 7); // YYYY-MM

        const stats = {
            totalClients: clients.length,
            activeClients: clients.filter(c => c.status === 'Active').length,
            inactiveClients: clients.filter(c => c.status !== 'Active').length,
            totalDue: clients.reduce((acc, c) => acc + (Number(c.balance || 0) > 0 ? Number(c.balance) : 0), 0),
            expectedMonthly: clients.filter(c => c.status === 'Active').reduce((acc, c) => acc + Number(c.bill || 0), 0),
            totalCollection: invoices.reduce((acc, inv) => acc + Number(inv.amount || 0), 0),
            todayCollection: invoices.filter(inv => new Date(inv.createdAt).toISOString().split('T')[0] === todayStr).reduce((acc, inv) => acc + Number(inv.amount || 0), 0),
            monthCollection: invoices.filter(inv => new Date(inv.createdAt).toISOString().slice(0, 7) === monthStr).reduce((acc, inv) => acc + Number(inv.amount || 0), 0),
            openTickets: tickets.filter(t => t.status !== 'Resolved').length,
            totalRouters: routers.length
        };

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getClientById = async (req, res) => {
    try {
        const client = await db.findClientById(req.params.id);
        if (!client) return res.status(404).json({ message: 'Client not found' });
        res.json(client);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createClient = async (req, res) => {
    try {
        const client = await db.createClient(req.body);

        // If pppoe details and router are provided, sync to MikroTik
        if (req.body.pppoeName && req.body.mikrotik) {
            // Find router in DB to make sure it's valid, although syncSecret does it too
            // We use req.body.mikrotik which could be router ID or name
            const routers = await db.findAllRouters();
            const router = routers.find(r => r._id === req.body.mikrotik || r.name === req.body.mikrotik);

            if (router) {
                await mikrotikController.syncSecret(router._id, {
                    name: req.body.pppoeName,
                    password: req.body.password,
                    profile: req.body.package,
                    comment: `ID: ${req.body.customerId || ''}, Name: ${req.body.name || ''}`
                });
            }
        }

        res.status(201).json(client);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};


exports.updateClient = async (req, res) => {
    try {
        const oldClient = await db.findClientById(req.params.id);
        if (!oldClient) return res.status(404).json({ message: 'Client not found' });

        const client = await db.updateClient(req.params.id, req.body);

        // Sync to MikroTik if router is associated
        if (req.body.mikrotik || oldClient.mikrotik) {
            const routerId = req.body.mikrotik || oldClient.mikrotik;
            const routers = await db.findAllRouters();
            const router = routers.find(r => r._id === routerId || r.name === routerId);

            if (router) {
                // Update basic info
                await mikrotikController.updateSecret(router._id, oldClient.pppoeName || oldClient.username, {
                    name: req.body.pppoeName || client.pppoeName || client.username,
                    password: req.body.password || client.password,
                    profile: req.body.package || client.package,
                    comment: `ID: ${client.customerId || ''}, Name: ${client.name || ''}`
                });

                // Update status (Enable/Disable)
                if (req.body.status) {
                    const isDisabled = req.body.status.toLowerCase() !== 'active';
                    await mikrotikController.setSecretStatus(router._id, client.pppoeName || client.username, isDisabled);
                }
            }
        }

        res.json(client);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};


exports.deleteClient = async (req, res) => {
    try {
        const client = await db.findClientById(req.params.id);
        if (client && client.mikrotik) {
            const routers = await db.findAllRouters();
            const router = routers.find(r => r._id === client.mikrotik || r.name === client.mikrotik);
            if (router) {
                await mikrotikController.deleteSecret(router._id, client.pppoeName || client.username);
            }
        }
        await db.deleteClient(req.params.id);
        res.json({ message: 'Client deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.rechargeClient = async (req, res) => {
    try {
        const result = await db.rechargeClient(req.params.id, req.body);
        if (!result) return res.status(404).json({ message: 'Client not found' });

        const client = result.client;
        // Sync to MikroTik (Enable if it was disabled)
        if (client.mikrotik) {
            const routers = await db.findAllRouters();
            const router = routers.find(r => r._id === client.mikrotik || r.name === client.mikrotik);
            if (router) {
                await mikrotikController.setSecretStatus(router._id, client.pppoeName || client.username, false);
            }
        }

        // Send automated confirmation SMS
        if (client.phone && client.phone !== '00000000000') {
            const msg = `Respected Customer, your account has been recharged with ৳${req.body.amount}. Your current balance is ৳${client.balance || 0}. Billing Date: ${client.date}. Thank you for staying with us.`;
            sendSMS(client.phone, msg).catch(err => console.error('[SMS] Auto recharge notification failed:', err));
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
},

    exports.addNote = async (req, res) => {
        try {
            const result = await db.addClientNote(req.params.id, req.body.note);
            if (!result) return res.status(404).json({ message: 'Client not found' });
            res.json(result);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    };

