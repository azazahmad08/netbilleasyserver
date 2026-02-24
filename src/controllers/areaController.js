const db = require('../db');

exports.getAllAreas = async (req, res) => {
    try {
        const areas = await db.findAllAreas();
        res.json(areas);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createArea = async (req, res) => {
    try {
        const area = await db.createArea(req.body);
        res.status(201).json(area);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateArea = async (req, res) => {
    try {
        const area = await db.updateArea(req.params.id, req.body);
        if (!area) return res.status(404).json({ message: 'Area not found' });
        res.json(area);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteArea = async (req, res) => {
    try {
        await db.deleteArea(req.params.id);
        res.json({ message: 'Area deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createSubArea = async (req, res) => {
    try {
        const subArea = await db.createSubArea(req.params.id, req.body);
        if (!subArea) return res.status(404).json({ message: 'Area not found' });
        res.status(201).json(subArea);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
