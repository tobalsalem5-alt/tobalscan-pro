const mongoose = require('mongoose');

const scanSchema = new mongoose.Schema({
    code: { type: String, required: true },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    agentName: { type: String },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Scan', scanSchema);
