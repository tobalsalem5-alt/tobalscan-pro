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
    const { username, password, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword, role: role || 'agent' });
        await newUser.save();
        res.status(201).json({ message: 'User created' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', authenticate, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// New Sync and Upload Routes
app.post('/api/sync', authenticate, async (req, res) => {
    try {
        const { scans } = req.body;
        const scansToSave = scans.map(s => ({
            ...s,
            agent: req.user.id,
            createdAt: new Date()
        }));
        await Scan.insertMany(scansToSave);
        io.emit('newScan');
        res.json({ success: true, count: scansToSave.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/upload', authenticate, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

io.on('connection', (socket) => {
    console.log('New client connected');
    socket.on('disconnect', () => console.log('Client disconnected'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
