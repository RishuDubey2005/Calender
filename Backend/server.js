require('dotenv').config();
require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);

const app = require('./src/app');
const connectDB = require('./src/db/db');
const { deleteOldEvents } = require('./src/controllers/event.controller');

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
    // Run cleanup once on startup, then every 24h
    deleteOldEvents();
    setInterval(deleteOldEvents, 24 * 60 * 60 * 1000);

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});