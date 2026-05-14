// Force IPv4 for all DNS — Render can't reach Supabase via IPv6
const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (_) {}
const _origLookup = dns.lookup.bind(dns);
dns.lookup = (hostname, options, cb) => {
  if (typeof options === 'function') return _origLookup(hostname, { family: 4 }, options);
  return _origLookup(hostname, { ...(typeof options === 'object' ? options : {}), family: 4 }, cb);
};

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: [
    'https://ccentrik-crm-8a84c.web.app',
    'https://ccentrik-crm-8a84c.firebaseapp.com',
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'CRM backend is running', version: '1.0.0' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api', (req, res) => {
  res.json({ status: 'ok', api: '/api/auth, /api/leads, /api/deals, /api/activities, /api/analytics, /api/ai' });
});

// Routes
const authRoutes = require('./routes/auth.routes');
const leadRoutes = require('./routes/lead.routes');
const dealRoutes = require('./routes/deal.routes');
const activityRoutes = require('./routes/activity.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const aiRoutes = require('./routes/ai.routes');
const userRoutes = require('./routes/user.routes');

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/users', userRoutes);
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 CRM Server running on port ${PORT}`);
});
