require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/auth');
const companionRoutes = require('./src/routes/companion');
const chatRoutes = require('./src/routes/chat');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.onrender.com') ||
      origin.endsWith('.vercel.app') ||
      /^http:\/\/localhost:\d+$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/companions', companionRoutes);
app.use('/api/chat', chatRoutes);

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Telugu AI Companion backend is running 🚀' });
});

// ─── Serve static frontend ─────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// ─── SPA fallback ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// ─── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // console.error(`❌ Port ${PORT} is in use. Killing the blocking process...`);
    const { execSync } = require('child_process');
    try {
      // Find and kill PID using the port on Windows
      const result = execSync(`netstat -ano | findstr :${PORT}`).toString();
      const lines = result.trim().split('\n');
      const pids = new Set();
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') pids.add(pid);
      });
      pids.forEach(pid => {
        try { execSync(`taskkill /PID ${pid} /F`); console.log(`✅ Killed PID ${pid}`); }
        catch (_) {}
      });
      console.log('🔄 Retrying in 1 second...');
      setTimeout(() => server.listen(PORT), 1000);
    } catch (e) {
      console.error('Could not auto-kill process. Kill manually with: netstat -ano | findstr :5000');
      process.exit(1);
    }
  } else {
    throw err;
  }
});
