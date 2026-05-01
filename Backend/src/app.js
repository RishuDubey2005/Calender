const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const eventRoutes = require('./routes/event.routes');

const app = express();

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.use('/api/events', eventRoutes);

app.get('/health', (req, res) => res.json({ status: 'OK', time: new Date() }));

module.exports = app;