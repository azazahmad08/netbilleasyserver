const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    amount: { type: Number, required: true },
    month: { type: String, required: true }, // e.g., "February 2024"
    status: { type: String, enum: ['Paid', 'Unpaid', 'Partial'], default: 'Unpaid' },
    method: { type: String }, // bKash, Cash, etc.
    transactionId: { type: String },
    dueDate: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
