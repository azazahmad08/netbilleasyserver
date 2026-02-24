const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['Open', 'In Progress', 'Resolved', 'Closed'], default: 'Open' },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    category: { type: String, enum: ['Network', 'Billing', 'Speed', 'Other'], default: 'Network' },
    comments: [{
        text: String,
        sender: String,
        date: { type: Date, default: Date.now }
    }],
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
