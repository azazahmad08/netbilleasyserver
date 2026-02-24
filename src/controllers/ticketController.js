const db = require('../db');

exports.getAllTickets = async (req, res) => {
    try {
        const tickets = await db.findAllTickets();
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getTicketById = async (req, res) => {
    try {
        // Simple search for dummy
        const tickets = await db.findAllTickets();
        const ticket = tickets.find(t => t._id === req.params.id);
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
        res.json(ticket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createTicket = async (req, res) => {
    try {
        const ticket = await db.createTicket(req.body);
        res.status(201).json(ticket);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateTicket = async (req, res) => {
    try {
        const ticket = await db.updateTicket(req.params.id, req.body);
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
        res.json(ticket);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.addComment = async (req, res) => {
    try {
        const tickets = await db.findAllTickets();
        const ticket = tickets.find(t => t._id === req.params.id);
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        if (!ticket.comments) ticket.comments = [];
        ticket.comments.push({
            text: req.body.text,
            sender: req.body.sender,
            date: new Date()
        });

        await db.updateTicket(req.params.id, { comments: ticket.comments });
        res.json(ticket);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteTicket = async (req, res) => {
    try {
        // Not implemented in db.js yet but could be
        res.json({ message: 'Ticket deleted (mock)' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
