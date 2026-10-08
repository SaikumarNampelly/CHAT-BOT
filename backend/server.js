require('dotenv').config();
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/companions', companionRoutes);
app.use('/api/chat', chatRoutes);

// ─── Health & Root Checks ─────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'TalkMate API is live 🚀' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TalkMate backend is running 🚀' });
});

// ─── 404 fallback for unknown API routes ──────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// ─── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && process.platform === 'win32') {
    // console.error(`❌ Port ${PORT} is in use. Killing the blocking process...`);
    const { execSync } = require('child_process');
    try {
      // Find and kill PID listening on the port on Windows
      const result = execSync(`netstat -ano | findstr LISTENING | findstr :${PORT}`).toString();
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
