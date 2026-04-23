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


app.post('/api/users', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const { username, password, role } = req.body;
    try {
        const newUser = new User({ username, password, role: role || 'agent' });
        await newUser.save();
        res.status(201).json({ message: 'User created successfully' });
    } catch (err) { res.status(500).json({ message: 'Error creating user' }); }
});


app.get('/api/users', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const users = await User.find({ role: 'agent' }).select('-password');
    res.json(users);
});


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


// Real-time communication
io.on('connection', (socket) => {
    console.log('New client connected');
    socket.on('disconnect', () => console.log('Client disconnected'));
});


// API for scans
app.post('/api/scans', authenticate, async (req, res) => {
    const { voucherCode } = req.body;

    // Check if code already exists
    const existingScan = await Scan.findOne({ voucherCode });
    if (existingScan) {
        return res.status(400).json({ message: 'Duplicate code' });
    }
    const scan = new Scan({
        agent: req.user.id,
        voucherCode,
        status: Math.random() > 0.5 ? 'success' : 'failed'
    });
