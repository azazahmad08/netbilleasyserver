const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

router.get('/', clientController.getAllClients);
router.get('/stats', clientController.getDashboardStats);
router.get('/invoices', clientController.getAllInvoices);
router.get('/:id', clientController.getClientById);
router.post('/', clientController.createClient);
router.put('/:id', clientController.updateClient);
router.delete('/:id', clientController.deleteClient);
router.post('/:id/recharge', clientController.rechargeClient);
router.post('/:id/notes', clientController.addNote);
router.get('/:id/invoices', clientController.getClientInvoices);

module.exports = router;
