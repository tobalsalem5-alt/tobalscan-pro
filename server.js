require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const User = require('./models/User');
const Scan = require('./models/Scan');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('Connected to MongoDB'))
        .catch(err => console.error('MongoDB error:', err));
}

const authenticate = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Invalid token' });
        req.user = decoded;
        next();
    });
};

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    // Emergency Fallback Login (if DB is not connected or user doesn't exist)
    const fallbackPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if (username === 'admin' && password === fallbackPassword) {
        const token = jwt.sign({ id: 'fallback-admin', username: 'admin', role: 'admin' }, process.env.JWT_SECRET || 'secret');
        return res.json({ token, user: { username: 'admin', role: 'admin' } });
    }

    try {
        const user = await User.findOne({ username });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET || 'secret');
        res.json({ token, user: { username: user.username, role: user.role } });
    } catch (err) { 
        res.status(500).json({ message: 'Server error' }); 
    }
});

const setupAdmin = async () => {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if (!adminExists) {
            const admin = new User({ username: 'admin', password: process.env.ADMIN_PASSWORD || 'admin123', role: 'admin' });
            await admin.save();
        }
    } catch (e) {}
};
setupAdmin();

app.post('/api/scans', authenticate, async (req, res) => {
    const { code } = req.body;
    try {
        const scan = new Scan({ code, agent: req.user.id, agentName: req.user.username });
        await scan.save();
        io.emit('new-scan', scan);
        res.status(201).json(scan);
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

app.get('/api/scans', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const scans = await Scan.find().sort({ timestamp: -1 }).limit(50);
    res.json(scans);
});

app.get('/api/stats', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const totalScans = await Scan.countDocuments();
    const today = new Date(); today.setHours(0,0,0,0);
    const scansToday = await Scan.countDocuments({ timestamp: { $gte: today } });
    const activeAgents = await User.countDocuments({ role: 'agent' });
    res.json({ totalScans, scansToday, activeAgents });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('Server running');
});
