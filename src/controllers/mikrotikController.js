const { RouterOSClient } = require('routeros-client');
const db = require('../db');

// Helper to connect to router
const connectRouter = async (routerData) => {
    console.log(`[MikroTik] Attempting connection to ${routerData.host}:${routerData.port || 8728} (User: ${routerData.username})`);
    const client = new RouterOSClient({
        host: routerData.host,
        user: routerData.username,
        password: routerData.password,
        port: parseInt(routerData.port) || 8728,
        timeout: 10
    });

    try {
        const api = await client.connect();
        return { client, api };
    } catch (error) {
        console.error(`[MikroTik] Connection failed to ${routerData.host}:`, error.message);
        throw error;
    }
};

exports.getAllRouters = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const routers = await db.findAllRouters(userId);
        res.json(routers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createRouter = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const router = await db.createRouter(req.body, userId);
        res.status(201).json(router);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getRouterById = async (req, res) => {
    console.log(`[MikroTik] Fetching router by ID: ${req.params.id}`);
    try {
        const router = await db.findRouterById(req.params.id);
        if (!router) {
            console.warn(`[MikroTik] Router with ID ${req.params.id} not found in DB`);
            return res.status(404).json({ message: 'Router not found' });
        }
        res.json(router);
    } catch (error) {
        console.error(`[MikroTik] Error fetching router ${req.params.id}:`, error.message);
        res.status(500).json({ message: error.message });
    }
};

exports.pingRouter = async (req, res) => {
    console.log(`[MikroTik] Ping request for router ID: ${req.params.id}`);
    try {
        const router = await db.findRouterById(req.params.id);
        if (!router) {
            return res.status(404).json({ message: 'Router not found' });
        }

        const { client } = await connectRouter(router);
        await client.close();
        console.log(`[MikroTik] Ping successful for ${router.name}`);
        res.json({ status: 'Online', message: 'Connection successful' });
    } catch (error) {
        console.error(`[MikroTik] Ping failed for router ID ${req.params.id}:`, error.message);
        res.json({ status: 'Offline', message: `Connection failed: ${error.message}` });
    }
};

exports.getRouterHistory = async (req, res) => {
    console.log(`[MikroTik] Resource request for router ID: ${req.params.id}`);
    try {
        const router = await db.findRouterById(req.params.id);
        if (!router) return res.status(404).json({ message: 'Router not found' });

        const { client, api } = await connectRouter(router);
        const resource = await api.menu('/system/resource').get();
        await client.close();

        const data = resource[0];
        res.json({
            version: data.version,
            cpu: data.cpu,
            cpuCount: data['cpu-count'],
            cpuFreq: data['cpu-frequency'],
            cpuLoad: data['cpu-load'],
            arch: data['architecture-name'],
            board: data['board-name'],
            platform: data.platform
        });
    } catch (error) {
        console.error(`[MikroTik] Resource error for router ${req.params.id}:`, error.message);
        res.status(500).json({ message: `Failed to fetch resources: ${error.message}` });
    }
};

exports.getSecrets = async (req, res) => {
    console.log(`[MikroTik] Secrets request for router: ${req.params.id}`);
    try {
        const router = await db.findRouterById(req.params.id);
        if (!router) return res.status(404).json({ message: 'Router not found' });

        const { client, api } = await connectRouter(router);
        const secrets = await api.menu('/ppp/secret').get();
        await client.close();

        res.json(secrets);
    } catch (error) {
        console.error(`[MikroTik] Secrets error for router ${req.params.id}:`, error.message);
        res.status(500).json({ message: `Failed to fetch secrets: ${error.message}` });
    }
};

exports.getProfiles = async (req, res) => {
    console.log(`[MikroTik] Profiles request for router: ${req.params.id}`);
    try {
        const router = await db.findRouterById(req.params.id);
        if (!router) return res.status(404).json({ message: 'Router not found' });

        const { client, api } = await connectRouter(router);
        const profiles = await api.menu('/ppp/profile').get();
        await client.close();

        res.json(profiles);
    } catch (error) {
        console.error(`[MikroTik] Profiles error for router ${req.params.id}:`, error.message);
        res.status(500).json({ message: `Failed to fetch profiles: ${error.message}` });
    }
};

exports.importSecrets = async (req, res) => {
    console.log(`[MikroTik] Import request for router: ${req.params.id}`);
    try {
        const router = await db.findRouterById(req.params.id);
        if (!router) return res.status(404).json({ message: 'Router not found' });

        const { client, api } = await connectRouter(router);
        const secrets = await api.menu('/ppp/secret').get();
        await client.close();

        // Map secrets to client format
        const clientsToImport = secrets.map(s => {
            const comment = String(s.comment || '');
            const match = comment ? comment.match(/\d{11}/) : null;
            return {
                name: String(s.comment || s.name),
                username: s.name,
                phone: match ? match[0] : '00000000000',
                package: s.profile,
                zone: 'Imported',
                price: 0, // Placeholder
                mikrotik: req.params.id
            };
        });

        const importedCount = await db.bulkCreateClients(clientsToImport);
        res.json({
            message: 'Import successful',
            total: secrets.length,
            imported: importedCount.length,
            duplicates: secrets.length - importedCount.length
        });
    } catch (error) {
        console.error(`[MikroTik] Import error for router ${req.params.id}:`, error.message);
        res.status(500).json({ message: `Failed to import secrets: ${error.message}` });
    }
};
exports.getActiveUsers = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const routers = await db.findAllRouters(userId);
        let allActiveUsers = [];

        await Promise.allSettled(routers.map(async (router) => {
            const { client, api } = await connectRouter(router);
            const active = await api.menu('/ppp/active').get();
            await client.close();

            const usersWithRouterName = active.map(u => ({
                ...u,
                routerName: router.name,
                _id: `${router._id}-${u['.id'] || u.name || Math.random()}`
            }));
            allActiveUsers = allActiveUsers.concat(usersWithRouterName);
        }));

        res.json(allActiveUsers);
    } catch (error) {
        console.error('[MikroTik] Failed to fetch active users:', error);
        res.status(500).json({ message: 'Failed to fetch active users' });
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const routers = await db.findAllRouters(userId);
        const clients = await db.findAllClients();
        let totalSecrets = 0;
        let activeUsers = 0;
        let onlineRouters = 0;

        // Fetch stats from all routers in parallel
        const routerStats = await Promise.allSettled(routers.map(async (router) => {
            try {
                const { client, api } = await connectRouter(router);
                const secrets = await api.menu('/ppp/secret').get();
                const active = await api.menu('/ppp/active').get();
                await client.close();
                return {
                    secrets: secrets.length,
                    active: active.length,
                    online: true
                };
            } catch (err) {
                // Fallback to local database counts if router is unreachable
                const localSecretsCount = clients.filter(c => c.mikrotik === router._id).length;
                return {
                    secrets: localSecretsCount,
                    active: 0,
                    online: false
                };
            }
        }));

        routerStats.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                totalSecrets += result.value.secrets;
                activeUsers += result.value.active;
                if (result.value.online) onlineRouters++;
            }
        });

        res.json({
            totalSecrets,
            activeUsers,
            offlineUsers: totalSecrets - activeUsers,
            onlineRouters,
            totalRouters: routers.length
        });
    } catch (error) {
        console.error('[MikroTik] Global dashboard stats error:', error);
        res.status(500).json({ message: 'Failed to fetch MT stats' });
    }
};
exports.syncSecret = async (routerId, secretData) => {
    console.log(`[MikroTik] Syncing secret for ${secretData.name} on router ${routerId}`);
    try {
        const router = await db.findRouterById(routerId);
        if (!router) {
            console.error(`[MikroTik] Router ${routerId} not found for sync`);
            return false;
        }

        const { client, api } = await connectRouter(router);
        try {
            await api.menu('/ppp/secret').add({
                name: secretData.name,
                password: secretData.password,
                profile: secretData.profile,
                service: 'pppoe',
                comment: secretData.comment || ''
            });
            console.log(`[MikroTik] Secret "${secretData.name}" created successfully`);
            return true;
        } finally {
            await client.close();
        }
    } catch (error) {
        console.error(`[MikroTik] Failed to sync secret:`, error.message);
        return false;
    }
};

exports.updateSecret = async (routerId, oldName, secretData) => {
    console.log(`[MikroTik] Updating secret "${oldName}" on router ${routerId}`);
    try {
        const router = await db.findRouterById(routerId);
        if (!router) return false;

        const { client, api } = await connectRouter(router);
        try {
            const secretMenu = api.menu('/ppp/secret');
            const secrets = await secretMenu.get({ name: oldName });
            if (secrets.length > 0) {
                await secretMenu.set(secrets[0][".id"], {
                    name: secretData.name,
                    password: secretData.password,
                    profile: secretData.profile,
                    comment: secretData.comment || ''
                });
                console.log(`[MikroTik] Secret "${oldName}" updated to "${secretData.name}" successfully`);
                return true;
            } else {
                console.warn(`[MikroTik] Secret "${oldName}" not found on router for update, creating new one...`);
                return await exports.syncSecret(routerId, secretData);
            }
        } finally {
            await client.close();
        }
    } catch (error) {
        console.error(`[MikroTik] Failed to update secret:`, error.message);
        return false;
    }
};

exports.deleteSecret = async (routerId, name) => {
    console.log(`[MikroTik] Deleting secret "${name}" on router ${routerId}`);
    try {
        const router = await db.findRouterById(routerId);
        if (!router) return false;

        const { client, api } = await connectRouter(router);
        try {
            const secretMenu = api.menu('/ppp/secret');
            const secrets = await secretMenu.get({ name: name });
            if (secrets.length > 0) {
                await secretMenu.remove(secrets[0][".id"]);
                console.log(`[MikroTik] Secret "${name}" deleted successfully`);
                return true;
            }
        } finally {
            await client.close();
        }
    } catch (error) {
        console.error(`[MikroTik] Failed to delete secret:`, error.message);
        return false;
    }
};

exports.setSecretStatus = async (routerId, name, disabled) => {
    console.log(`[MikroTik] Setting status for "${name}" (Disabled: ${disabled}) on router ${routerId}`);
    try {
        const router = await db.findRouterById(routerId);
        if (!router) return false;

        const { client, api } = await connectRouter(router);
        try {
            const secretMenu = api.menu('/ppp/secret');
            const secrets = await secretMenu.get({ name: name });
            if (secrets.length > 0) {
                await secretMenu.set(secrets[0][".id"], { disabled: disabled ? 'yes' : 'no' });
                console.log(`[MikroTik] Secret "${name}" ${disabled ? 'disabled' : 'enabled'} successfully`);
                return true;
            }
        } finally {
            await client.close();
        }
    } catch (error) {
        console.error(`[MikroTik] Failed to update secret status:`, error.message);
        return false;
    }
};


exports.monitorTraffic = async (req, res) => {
    console.log(`[MikroTik] Monitor traffic request for router: ${req.params.id}, Interface: ${req.query.interface}`);
    try {
        const { id } = req.params;
        const { interface: interfaceName } = req.query;

        if (!interfaceName) {
            return res.status(400).json({ message: 'Interface name is required' });
        }

        const router = await db.findRouterById(id);
        if (!router) return res.status(404).json({ message: 'Router not found' });

        const { client, api } = await connectRouter(router);

        try {
            // Note: The command structure might vary slightly based on routeros-client version
            // This assumes .call() works for commands like monitor-traffic
            // routeros-client usually supports .write() directly on the menu or connection
            // Using raw write to run the command
            const result = await api.menu('/interface').where({ name: interfaceName }).get();

            if (result.length === 0) {
                // Try looking for dynamic interface
                // If interfaceName is <pppoe-user>, try to find it
                return res.json({ "rx-bits-per-second": 0, "tx-bits-per-second": 0 });
            }

            // For monitor-traffic, we need to send a command, not just get
            // But since 'monitor-traffic' is an intricate command, let's try reading stats from interface/get first which is safer
            // 'monitor-traffic' provides live stats, 'get' provides cumulative. 
            // BUT the user wants live stats.

            // Alternative: use execute/command if available or standard write
            const connection = client; // Access raw client

            // Raw command execution
            // /interface/monitor-traffic =interface=<name> =once=
            // Using simplified raw command execution approach for routeros-client
            // Since api.menu returns a query builder, we might need a different approach.
            // Let's try to query the interface directly and see if we can get traffic stats.

            // However, monitor-traffic is special.
            // Let's use the low-level client.write method if exposed, or fallback to getting interface stats which might be close enough

            // Try 1: access interface stats (rx-byte, tx-byte) and calculate diff? No, that's stateful.
            // Try 2: use the raw command string

            // Assuming 'client' is the RosClient instance
            const cmd = ['/interface/monitor-traffic', `=interface=${interfaceName}`, '=once='];

            try {
                // Access the underlying raw client which has the write() method
                // The RouterOSClient wrapper stores it in 'rosApi'
                const rawClient = client.rosApi;

                if (rawClient && typeof rawClient.write === 'function') {
                    // Note: rawClient.write returns a Promise that resolves with the data
                    const monitorData = await rawClient.write(cmd);

                    if (monitorData && monitorData.length > 0) {
                        // Find the item that actually has traffic data (skipping !re and !done sometimes)
                        const dataItem = monitorData.find(item => item['rx-bits-per-second']);
                        if (dataItem) {
                            res.json(dataItem);
                        } else {
                            // Fallback to first item if structure is different
                            res.json(monitorData[0]);
                        }
                    } else {
                        res.json({ "rx-bits-per-second": 0, "tx-bits-per-second": 0 });
                    }
                } else {
                    console.log('[MikroTik] Critical: Could not access raw RouterOS client write method.');
                    res.json({ "rx-bits-per-second": 0, "tx-bits-per-second": 0 });
                }

            } catch (err) {
                // Fallback: Just return 0 to avoid crashing
                console.log(`[MikroTik] Monitor error: ${err.message}`);
                res.json({ "rx-bits-per-second": 0, "tx-bits-per-second": 0 });
            }

        } catch (cmdError) {
            // If monitor-traffic fails, return 0s instead of 500 to keep UI alive
            console.log(`[MikroTik] Monitor command warning: ${cmdError.message}`);
            // If headers sent, don't send again
            if (!res.headersSent) {
                res.json({ "rx-bits-per-second": 0, "tx-bits-per-second": 0, error: cmdError.message });
            }
        } finally {
            await client.close();
        }

    } catch (error) {
        console.error(`[MikroTik] Monitor traffic error for router ${req.params.id}:`, error.message);
        res.status(500).json({ message: `Failed to fetch traffic: ${error.message}` });
    }
};

exports.updateRouter = async (req, res) => {
    try {
        const router = await db.updateRouter(req.params.id, req.body);
        if (!router) return res.status(404).json({ message: 'Router not found' });
        res.json(router);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteRouter = async (req, res) => {
    try {
        await db.deleteRouter(req.params.id);
        res.json({ message: 'Router deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
