const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database (simulated for now)
let scans = [];

// API Endpoints
app.get('/api/status', (req, res) => {
      res.json({ status: 'TobalScan Backend is active', timestamp: new Date() });
});

app.post('/api/scan', (req, res) => {
      const { data } = req.body;
      if (!data) return res.status(400).json({ error: 'No data provided' });

             const newScan = { id: Date.now(), data, date: new Date() };
      scans.push(newScan);
      res.json({ success: true, scan: newScan });
});

app.get('/api/scans', (req, res) => {
      res.json(scans);
});

// Serve frontend
app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
      console.log(`TobalScan Pro server running on port ${PORT}`);
});
