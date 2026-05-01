const express = require('express');
const router  = express.Router();
const {
    getAllEvents, getEventsByDate, createEvent,
    updateEvent, deleteEvent, deleteByGroup, countGroup
} = require('../controllers/event.controller');

router.get('/all',                  getAllEvents);
router.get('/group/:groupId/count', countGroup);       // must be before /:date
router.get('/:date',                getEventsByDate);
router.post('/',                    createEvent);
router.put('/:id',                  updateEvent);
router.delete('/group/:groupId',    deleteByGroup);    // must be before /:id
router.delete('/:id',               deleteEvent);

module.exports = router;