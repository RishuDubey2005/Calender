const Event = require('../models/event.model');
const { randomUUID } = require('crypto');

// GET all events
const getAllEvents = async (req, res) => {
    try {
        const events = await Event.find({}).sort({ date: 1, time: 1 });
        res.json({ success: true, events });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET events by date
const getEventsByDate = async (req, res) => {
    try {
        const events = await Event.find({ date: req.params.date }).sort({ time: 1 });
        res.json({ success: true, events });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST create event
const createEvent = async (req, res) => {
    try {
        const { title, date, time, description, color, reminder, recurring } = req.body;
        if (!title || !date) return res.status(400).json({ success: false, message: 'Title and date are required' });

        // Assign groupId if recurring
        const groupId = (recurring && recurring !== 'none') ? randomUUID() : null;

        const event = new Event({ title, date, time, description, color, reminder, recurring, groupId });
        await event.save();

        if (recurring && recurring !== 'none') {
            await createRecurringInstances(event, groupId);
        }

        res.status(201).json({ success: true, event });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Helper: generate future recurring instances
const createRecurringInstances = async (baseEvent, groupId) => {
    const { title, date, time, description, color, reminder, recurring } = baseEvent;
    const endDate = new Date(date);
    endDate.setFullYear(endDate.getFullYear() + 1);

    const instances = [];
    const cursor = new Date(date);

    while (true) {
        if      (recurring === 'daily')   cursor.setDate(cursor.getDate() + 1);
        else if (recurring === 'weekly')  cursor.setDate(cursor.getDate() + 7);
        else if (recurring === 'monthly') cursor.setMonth(cursor.getMonth() + 1);
        else if (recurring === 'yearly')  cursor.setFullYear(cursor.getFullYear() + 1);

        if (cursor > endDate) break;

        instances.push({
            title, time, description, color, reminder,
            date: cursor.toISOString().split('T')[0],
            recurring: 'none',   // instances themselves don't spawn more
            groupId
        });
    }

    if (instances.length > 0) await Event.insertMany(instances);
};

// PUT update event
const updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await Event.findById(id);
        if (!existing) return res.status(404).json({ success: false, message: 'Event not found' });

        const newRecurring = req.body.recurring;
        const today = new Date().toISOString().split('T')[0];

        // If recurring was turned OFF and event belongs to a group → delete all future siblings
        if (newRecurring === 'none' && existing.groupId) {
            await Event.deleteMany({
                groupId: existing.groupId,
                _id: { $ne: id },
                date: { $gt: existing.date }
            });
            req.body.groupId = null; // detach this event from the group
        }

        // If recurring type changed to a new active type → wipe old future siblings and regenerate
        if (newRecurring && newRecurring !== 'none' && existing.groupId && newRecurring !== existing.recurring) {
            await Event.deleteMany({
                groupId: existing.groupId,
                _id: { $ne: id },
                date: { $gt: today }
            });
            const newGroupId = randomUUID();
            req.body.groupId = newGroupId;
            // Temporarily build a fake base to reuse helper
            const fakeBase = { ...existing.toObject(), ...req.body, groupId: newGroupId };
            await createRecurringInstances(fakeBase, newGroupId);
        }

        // If turning recurring ON from none
        if (newRecurring && newRecurring !== 'none' && !existing.groupId) {
            const newGroupId = randomUUID();
            req.body.groupId = newGroupId;
            const fakeBase = { ...existing.toObject(), ...req.body, groupId: newGroupId };
            await createRecurringInstances(fakeBase, newGroupId);
        }

        const updated = await Event.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        res.json({ success: true, event: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE single event
const deleteEvent = async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        res.json({ success: true, groupId: event.groupId || null });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE all events in a recurring group
const deleteByGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const result = await Event.deleteMany({ groupId });
        res.json({ success: true, deletedCount: result.deletedCount });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Count events in a group (for UI confirmation message)
const countGroup = async (req, res) => {
    try {
        const count = await Event.countDocuments({ groupId: req.params.groupId });
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Auto-delete events older than 7 days
const deleteOldEvents = async () => {
    try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        const result = await Event.deleteMany({ date: { $lt: cutoffStr } });
        if (result.deletedCount > 0)
            console.log(`🗑️  Auto-deleted ${result.deletedCount} old events`);
    } catch (err) {
        console.error('Auto-delete error:', err.message);
    }
};

module.exports = {
    getAllEvents, getEventsByDate, createEvent,
    updateEvent, deleteEvent, deleteByGroup, countGroup, deleteOldEvents
};