const express = require('express');
const router = express.Router();
const mikrotikController = require('../controllers/mikrotikController');

router.use((req, res, next) => {
    console.log(`[MikroTik Route] ${req.method} ${req.originalUrl}`);
    next();
});

router.get('/stats', mikrotikController.getDashboardStats);
router.get('/active', mikrotikController.getActiveUsers);
router.get('/', mikrotikController.getAllRouters);
router.post('/', mikrotikController.createRouter);

// Specific routes first
router.get('/:id/ping', mikrotikController.pingRouter);
router.get('/:id/history', mikrotikController.getRouterHistory);
router.get('/:id/secrets', mikrotikController.getSecrets);
router.get('/:id/profiles', mikrotikController.getProfiles);
router.post('/:id/import-secrets', mikrotikController.importSecrets);
router.get('/:id/monitor', mikrotikController.monitorTraffic);

// Parameter route last to avoid greedy match
router.get('/:id', mikrotikController.getRouterById);
router.put('/:id', mikrotikController.updateRouter);
router.delete('/:id', mikrotikController.deleteRouter);

// Catch-all for unmatched mikrotik routes
router.use((req, res) => {
    console.warn(`[MikroTik Route] 404 Not Found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ message: `Route ${req.originalUrl} not found in Mikrotik module` });
});

module.exports = router;
