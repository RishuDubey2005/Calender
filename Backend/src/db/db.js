const mongoose = require('mongoose');

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to Database Successfully ✅");
    } catch (err) {
        console.error("Error connecting to Database:", err);
        process.exit(1);
    }
}

module.exports = connectDB;