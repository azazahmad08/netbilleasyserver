const mongoose = require('mongoose');

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
    mikrotikId: { type: String }, // For syncing
    connectionDate: { type: Date, default: Date.now },
    billingDate: { type: Number, default: 1 }, // Day of month
    balance: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);
