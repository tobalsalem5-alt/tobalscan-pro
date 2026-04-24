require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const User = require('./models/User');
const Scan = require('./models/Scan');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// Auth Middleware
const authenticate = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Invalid Token' });
        req.user = decoded;
        next();
    });
};

// Routes
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET || 'secret');
        res.json({ token, user: { id: user._id, username: user.username, role: user.role } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/scans', authenticate, async (req, res) => {
    try {
        const scans = await Scan.find().populate('agent', 'username').sort({ createdAt: -1 });
        res.json(scans);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users', authenticate, async (req, res) => {
    try {
        const users = await User.find({ role: 'agent' }).select('-password');
        res.json(users);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const { username, password, role } = req.body;
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ message: 'Username already exists' });
        
        // Pass the plain password, User model pre-save hook will handle hashing
        const newUser = new User({ username, password, role: role || 'agent' });
        await newUser.save();
        res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error creating user' });
    }
});

app.post('/api/scans', authenticate, upload.single('image'), async (req, res) => {
    const { code } = req.body;
    try {
        const newScan = new Scan({
            code,
            image: req.file ? `/uploads/${req.file.filename}` : null,
            agent: req.user.id
        });
        await newScan.save();
        io.emit('newScan', newScan);
        res.status(201).json(newScan);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
