const db = require('../db');

exports.getAllUsers = async (req, res) => {
    try {
        const users = await db.findAllUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getCurrentUser = async (req, res) => {
    try {
        // In a real app, this would come from the JWT token
        // For now, we take the ID from headers or use the last known reseller
        const userId = req.headers['x-user-id'] || 'reseller-1';
        const user = await db.findUserById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const user = await db.findUserById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createUser = async (req, res) => {
    try {
        const user = await db.createUser(req.body);
        res.status(201).json(user);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const user = await db.updateUser(req.params.id, req.body);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.addBalance = async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await db.addResellerBalance(req.params.id, amount);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
