const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    date:  { type: String, required: true, index: true },
    time:  { type: String, default: '' },
    description: { type: String, default: '', trim: true },
    color: { type: String, default: '#4285f4' },
    reminder: { type: Number, default: 0 },
    recurring: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
        default: 'none'
    },
    groupId: { type: String, default: null }   // links all recurring instances
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);