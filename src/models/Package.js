const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
    name: { type: String, required: true }, // e.g., "10 Mbps Starter"
    speed: { type: String, required: true }, // e.g., "10 Mbps"
    price: { type: Number, required: true }, // e.g., 1000
    mikrotikProfile: { type: String }, // The profile name in Mikrotik
    description: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Package', packageSchema);
