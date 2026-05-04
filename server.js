/* ================================================================
   SWMS – Full-Stack Express Server
   Features:
     • JWT Authentication (login / register)
     • REST API: bins, alerts, complaints, trucks, reports
     • WebSocket server for real-time push
     • IoT Simulator: updates bin fill levels every 7s
     • Route optimization: nearest-first sort
   ================================================================ */

'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const http    = require('http');
const WebSocket = require('ws');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const db      = require('./db');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const PORT      = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'swms-super-secret-key-2024';

// ── MIDDLEWARE ────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── JWT MIDDLEWARE ────────────────────────────────────────────────
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Admin access required' });
  next();
}

// ── WEBSOCKET BROADCAST ───────────────────────────────────────────
function broadcast(type, payload) {
  const msg = JSON.stringify({ type, payload, ts: Date.now() });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

wss.on('connection', ws => {
  console.log('🔌 WebSocket client connected');
  ws.send(JSON.stringify({ type: 'CONNECTED', payload: { msg: 'SWMS real-time feed active' } }));
});

// ================================================================
//  AUTH ROUTES
// ================================================================

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role = 'citizen' } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email, password required' });

  const allowedRoles = ['admin', 'worker', 'citizen'];
  if (!allowedRoles.includes(role))
    return res.status(400).json({ error: 'Invalid role' });

  const hash = bcrypt.hashSync(password, 10);
  db.run(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    [name, email, hash, role],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE'))
          return res.status(409).json({ error: 'Email already registered' });
        return res.status(500).json({ error: err.message });
      }
      const token = jwt.sign({ id: this.lastID, name, email, role }, JWT_SECRET, { expiresIn: '8h' });
      res.status(201).json({ token, user: { id: this.lastID, name, email, role } });
    }
  );
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email and password required' });

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err)   return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET, { expiresIn: '8h' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });
});

// GET /api/auth/me  (verify token, return user)
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ================================================================
//  BIN ROUTES
// ================================================================

// GET /api/bins
app.get('/api/bins', (req, res) => {
  db.all('SELECT * FROM bins ORDER BY fill_level DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

// POST /api/bins/add  (create a new bin)
app.post('/api/bins/add', authenticate, (req, res) => {
  const { id, location, fill_level = 0, status = 'empty', lat = 40.7128, lng = -74.0060 } = req.body;
  if (!id || !location) return res.status(400).json({ error: 'id and location required' });
  db.run('INSERT INTO bins (id,location,fill_level,status,lat,lng) VALUES (?,?,?,?,?,?)',
    [id, location, fill_level, status, lat, lng],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      broadcast('BIN_ADDED', { id, location, fill_level, status, lat, lng });
      res.status(201).json({ success: true, id });
    });
});

// GET /api/bins/:id
app.get('/api/bins/:id', (req, res) => {
  db.get('SELECT * FROM bins WHERE id = ?', [req.params.id], (err, row) => {
    if (err)  return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Bin not found' });
    res.json({ data: row });
  });
});

// PUT /api/bins/:id/update  (protected – admin/worker)
app.put('/api/bins/:id/update', authenticate, (req, res) => {
  const { fill_level, status } = req.body;
  db.run(
    `UPDATE bins SET fill_level = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
    [fill_level, status, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      broadcast('BIN_UPDATED', { id: req.params.id, fill_level, status });
      res.json({ success: true, changes: this.changes });
    }
  );
});

// ================================================================
//  ALERT ROUTES
// ================================================================

// GET /api/alerts  (last 50 unresolved)
app.get('/api/alerts', (req, res) => {
  db.all(
    `SELECT alerts.*, bins.location, bins.lat, bins.lng
     FROM alerts
     LEFT JOIN bins ON alerts.bin_id = bins.id
     WHERE alerts.resolved = 0
     ORDER BY alerts.created_at DESC
     LIMIT 50`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ data: rows });
    }
  );
});

// POST /api/alerts  (create manually)
app.post('/api/alerts', authenticate, (req, res) => {
  const { bin_id, level, message, severity = 'high' } = req.body;
  if (!bin_id || level == null)
    return res.status(400).json({ error: 'bin_id and level required' });

  db.run(
    'INSERT INTO alerts (bin_id, level, message, severity) VALUES (?, ?, ?, ?)',
    [bin_id, level, message || `Fill level reached ${level}%`, severity],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const alert = { id: this.lastID, bin_id, level, message, severity, resolved: 0 };
      broadcast('NEW_ALERT', alert);
      res.status(201).json({ data: alert });
    }
  );
});

// PUT /api/alerts/:id/resolve
app.put('/api/alerts/:id/resolve', authenticate, (req, res) => {
  db.run('UPDATE alerts SET resolved = 1 WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    broadcast('ALERT_RESOLVED', { id: req.params.id });
    res.json({ success: true, changes: this.changes });
  });
});

// ================================================================
//  COMPLAINT ROUTES
// ================================================================

// GET /api/complaints
app.get('/api/complaints', (req, res) => {
  const { status } = req.query;
  const sql = status
    ? 'SELECT * FROM complaints WHERE status = ? ORDER BY rowid DESC'
    : 'SELECT * FROM complaints ORDER BY rowid DESC';
  const params = status ? [status] : [];
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

// POST /api/complaints  (citizen submits a complaint)
app.post('/api/complaints', (req, res) => {
  const { citizen_name, location, issue_category, issue_desc } = req.body;
  if (!location || !issue_category)
    return res.status(400).json({ error: 'location and issue_category required' });

  const ticket_id  = '#TCK-' + Math.floor(1000 + Math.random() * 9000);
  const reported_on = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  db.run(
    `INSERT INTO complaints (ticket_id, citizen_name, location, issue_category, issue_desc, reported_on, status)
     VALUES (?, ?, ?, ?, ?, ?, 'Open')`,
    [ticket_id, citizen_name || 'Anonymous', location, issue_category, issue_desc || '', reported_on],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const complaint = { ticket_id, citizen_name, location, issue_category, issue_desc, reported_on, status: 'Open' };
      broadcast('NEW_COMPLAINT', complaint);
      res.status(201).json({ data: complaint });
    }
  );
});

// PUT /api/complaints/:id/resolve
app.put('/api/complaints/:id/resolve', authenticate, (req, res) => {
  db.run(
    `UPDATE complaints SET status = 'Resolved' WHERE ticket_id = ?`,
    [req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      broadcast('COMPLAINT_RESOLVED', { ticket_id: req.params.id });
      res.json({ success: true, changes: this.changes });
    }
  );
});

// ================================================================
//  TRUCK / FLEET ROUTES
// ================================================================

// GET /api/trucks
app.get('/api/trucks', (req, res) => {
  db.all('SELECT * FROM trucks', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

// PUT /api/trucks/:id  (update truck status)
app.put('/api/trucks/:id', authenticate, (req, res) => {
  const { progress, status } = req.body;
  db.run(
    `UPDATE trucks SET progress = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
    [progress, status, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      broadcast('TRUCK_UPDATED', { id: req.params.id, progress, status });
      res.json({ success: true, changes: this.changes });
    }
  );
});

// ================================================================
//  ROUTE OPTIMIZATION
// ================================================================

// GET /api/routes/:truckId  → returns bins sorted by distance (nearest first)
app.get('/api/routes/:truckId', authenticate, (req, res) => {
  // Origin: default truck depot at city center
  const depotLat = 40.7128, depotLng = -74.0060;

  db.all("SELECT * FROM bins WHERE status != 'empty' ORDER BY fill_level DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    // Haversine distance helper
    function haversine(lat1, lng1, lat2, lng2) {
      const R  = 6371; // km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 +
                Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    // Nearest-first greedy route
    let current = { lat: depotLat, lng: depotLng };
    const route = [];
    const remaining = [...rows];

    while (remaining.length) {
      let nearest = null, nearestDist = Infinity, nearestIdx = -1;
      remaining.forEach((bin, i) => {
        const d = haversine(current.lat, current.lng, bin.lat, bin.lng);
        if (d < nearestDist) { nearest = bin; nearestDist = d; nearestIdx = i; }
      });
      route.push({ ...nearest, distance_km: nearestDist.toFixed(2) });
      current = { lat: nearest.lat, lng: nearest.lng };
      remaining.splice(nearestIdx, 1);
    }

    res.json({ truck_id: req.params.truckId, depot: { lat: depotLat, lng: depotLng }, route });
  });
});

// ================================================================
//  REPORTS
// ================================================================

// GET /api/reports  → aggregate stats
app.get('/api/reports', authenticate, (req, res) => {
  const stats = {};

  db.get("SELECT COUNT(*) AS total FROM bins", (_, r) => { stats.total_bins = r?.total || 0;
  db.get("SELECT COUNT(*) AS c FROM bins WHERE status='full'", (_, r) => { stats.full_bins = r?.c || 0;
  db.get("SELECT COUNT(*) AS c FROM bins WHERE status='medium'", (_, r) => { stats.medium_bins = r?.c || 0;
  db.get("SELECT AVG(fill_level) AS avg FROM bins", (_, r) => { stats.avg_fill = Math.round(r?.avg || 0);
  db.get("SELECT COUNT(*) AS c FROM complaints WHERE status='Open'", (_, r) => { stats.open_complaints = r?.c || 0;
  db.get("SELECT COUNT(*) AS c FROM complaints WHERE status='Resolved'", (_, r) => { stats.resolved_complaints = r?.c || 0;
  db.get("SELECT COUNT(*) AS c FROM alerts WHERE resolved=0", (_, r) => { stats.active_alerts = r?.c || 0;
  db.get("SELECT COUNT(*) AS c FROM trucks WHERE status='En Route'", (_, r) => { stats.trucks_active = r?.c || 0;
    res.json({ data: stats });
  });});});});});});});});
});

// ================================================================
//  IOT SIMULATOR  (runs every 7 seconds)
// ================================================================
function runIoTSimulator() {
  db.all('SELECT * FROM bins', [], (err, bins) => {
    if (err || !bins) return;

    bins.forEach(bin => {
      // Random walk: ±5% per tick, clamp to 0–100
      const delta    = Math.floor(Math.random() * 11) - 4;  // -4 to +6
      const newFill  = Math.max(0, Math.min(100, bin.fill_level + delta));
      const newStatus = newFill >= 80 ? 'full' : newFill >= 40 ? 'medium' : 'empty';

      db.run(
        `UPDATE bins SET fill_level=?, status=?, updated_at=datetime('now') WHERE id=?`,
        [newFill, newStatus, bin.id],
        err => { if (err) return; }
      );

      // Create alert if bin crossed the 80% threshold
      if (newFill >= 80 && bin.fill_level < 80) {
        const msg = `⚠ Bin ${bin.id} at ${bin.location} reached ${newFill}% capacity`;
        db.run(
          'INSERT INTO alerts (bin_id, level, message, severity) VALUES (?, ?, ?, ?)',
          [bin.id, newFill, msg, newFill >= 95 ? 'critical' : 'high'],
          function(err) {
            if (!err) {
              broadcast('NEW_ALERT', {
                id: this.lastID, bin_id: bin.id, level: newFill,
                message: msg, severity: newFill >= 95 ? 'critical' : 'high',
                location: bin.location, lat: bin.lat, lng: bin.lng
              });
            }
          }
        );
        console.log(`🚨 Alert: ${msg}`);
      }

      // Always broadcast bin updates to connected clients
      broadcast('BIN_UPDATED', { id: bin.id, fill_level: newFill, status: newStatus });
    });
  });
}

// Start IoT sim after 2s (let DB seed first), then every 7s
setTimeout(() => {
  console.log('🤖 IoT Simulator started (7s interval)');
  runIoTSimulator();
  setInterval(runIoTSimulator, 7000);
}, 2000);

// ── START SERVER ──────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 SWMS Server running  → http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready      → ws://localhost:${PORT}`);
  console.log(`🔑 Default credentials  → admin@swms.gov / admin123\n`);
});
