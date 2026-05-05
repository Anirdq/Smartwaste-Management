/* ================================================================
   SWMS – Database Initializer (SQLite)
   Tables: users, bins, alerts, complaints, trucks, collections
   ================================================================ */

const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, err => {
  if (err) console.error('DB connection error:', err.message);
  else     console.log('✅ Connected to SQLite database.');
});

function initDB() {
  db.serialize(() => {

    // ── USERS ──────────────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT    NOT NULL,
      email     TEXT    NOT NULL UNIQUE,
      password  TEXT    NOT NULL,
      role      TEXT    NOT NULL DEFAULT 'citizen'
    )`);

    // ── BINS ───────────────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS bins (
      id         TEXT    PRIMARY KEY,
      location   TEXT,
      fill_level INTEGER DEFAULT 0,
      status     TEXT    DEFAULT 'empty',
      lat        REAL,
      lng        REAL,
      updated_at TEXT    DEFAULT (datetime('now'))
    )`);

    // ── ALERTS ─────────────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS alerts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      bin_id     TEXT    NOT NULL,
      level      INTEGER NOT NULL,
      message    TEXT,
      severity   TEXT    DEFAULT 'high',
      resolved   INTEGER DEFAULT 0,
      created_at TEXT    DEFAULT (datetime('now'))
    )`);

    // ── COMPLAINTS ─────────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS complaints (
      ticket_id      TEXT PRIMARY KEY,
      citizen_name   TEXT,
      location       TEXT,
      issue_category TEXT,
      issue_desc     TEXT,
      reported_on    TEXT,
      status         TEXT DEFAULT 'Open'
    )`);

    // ── TRUCKS ─────────────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS trucks (
      id          TEXT PRIMARY KEY,
      driver      TEXT,
      progress    INTEGER DEFAULT 0,
      status      TEXT    DEFAULT 'Idle',
      route_color TEXT    DEFAULT '#3b82f6',
      updated_at  TEXT    DEFAULT (datetime('now'))
    )`);

    // ── COLLECTIONS (worker activity log) ─────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS collections (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      truck_id     TEXT,
      bin_id       TEXT,
      collected_at TEXT DEFAULT (datetime('now'))
    )`);

    // ── SEED: users ────────────────────────────────────────────────
    db.get("SELECT COUNT(*) AS c FROM users", (err, row) => {
      if (!row || row.c > 0) return;
      const bcrypt = require('bcryptjs');
      const hash   = bcrypt.hashSync('admin123', 10);
      db.run(`INSERT INTO users (name,email,password,role) VALUES
        ('Anirudh',  'admin@swms.gov',   '${hash}', 'admin'),
        ('Murugan S',   'worker@swms.gov',  '${hash}', 'worker'),
        ('Priya Citizen','citizen@swms.gov', '${hash}', 'citizen')`);
      console.log('👤 Seeded users (password: admin123)');
    });

    // ── SEED: bins ─────────────────────────────────────────────────
    db.get("SELECT COUNT(*) AS c FROM bins", (err, row) => {
      if (!row || row.c > 0) return;
      const bins = [
        { id:'BN-1022', location:'Marina Beach',           fill:15, status:'empty',  lat:13.0500, lng:80.2824 },
        { id:'BN-4092', location:'T Nagar Bus Stand',      fill:92, status:'full',   lat:13.0418, lng:80.2341 },
        { id:'BN-5033', location:'Velachery MRTS',         fill:8,  status:'empty',  lat:12.9815, lng:80.2180 },
        { id:'BN-3011', location:'Guindy National Park',   fill:65, status:'medium', lat:13.0067, lng:80.2206 },
        { id:'BN-1029', location:'Anna Nagar Tower Park',  fill:88, status:'full',   lat:13.0850, lng:80.2101 },
        { id:'BN-2201', location:'Besant Nagar Beach',     fill:40, status:'medium', lat:13.0002, lng:80.2738 },
        { id:'BN-6701', location:'Adyar Depot',            fill:0,  status:'empty',  lat:13.0012, lng:80.2565 },
        { id:'BN-7102', location:'Nungambakkam Station',   fill:55, status:'medium', lat:13.0569, lng:80.2425 },
        { id:'BN-8803', location:'Mylapore Temple',        fill:73, status:'medium', lat:13.0368, lng:80.2676 },
        { id:'BN-9201', location:'OMR IT Expressway',      fill:95, status:'full',   lat:12.9675, lng:80.2489 }
      ];
      const s = db.prepare("INSERT INTO bins (id,location,fill_level,status,lat,lng) VALUES (?,?,?,?,?,?)");
      bins.forEach(b => s.run(b.id, b.location, b.fill, b.status, b.lat, b.lng));
      s.finalize();
      console.log('🗑 Seeded bins');
    });

    // ── SEED: complaints ───────────────────────────────────────────
    db.get("SELECT COUNT(*) AS c FROM complaints", (err, row) => {
      if (!row || row.c > 0) return;
      const complaints = [
        { id:'#TCK-9901', name:'Srinivasan K', loc:'T Nagar Main Road',     cat:'Overflowing Bin',   desc:'Garbage scattered around',     on:'Today, 10:45 AM',    status:'Open' },
        { id:'#TCK-9884', name:'Anjali S',     loc:'Velachery Lake Area',   cat:'Damaged Equipment', desc:'Smart bin lid jammed',         on:'Yesterday, 2:15 PM', status:'In Progress' },
        { id:'#TCK-9830', name:'Anonymous',    loc:'Besant Nagar',          cat:'Illegal Dumping',   desc:'Furniture on sidewalk',        on:'Aug 12, 9:00 AM',    status:'Resolved' },
        { id:'#TCK-9811', name:'Ramesh D',     loc:'Anna Nagar East',       cat:'Missed Pickup',     desc:'Bin not emptied on schedule',  on:'Aug 11, 4:30 PM',   status:'Open' }
      ];
      const s = db.prepare("INSERT INTO complaints (ticket_id,citizen_name,location,issue_category,issue_desc,reported_on,status) VALUES (?,?,?,?,?,?,?)");
      complaints.forEach(c => s.run(c.id, c.name, c.loc, c.cat, c.desc, c.on, c.status));
      s.finalize();
      console.log('💬 Seeded complaints');
    });

    // ── SEED: trucks ───────────────────────────────────────────────
    db.get("SELECT COUNT(*) AS c FROM trucks", (err, row) => {
      if (!row || row.c > 0) return;
      const trucks = [
        { id:'Truck #1', driver:'Murugan',     progress:45, status:'En Route',    color:'#3b82f6' },
        { id:'Truck #2', driver:"Suresh",      progress:98, status:'Returning',   color:'#22c55e' },
        { id:'Truck #3', driver:'Dinesh',      progress:20, status:'En Route',    color:'#f59e0b' },
        { id:'Truck #4', driver:'Unknown',     progress:0,  status:'Maintenance', color:'#94a3b8' }
      ];
      const s = db.prepare("INSERT INTO trucks (id,driver,progress,status,route_color) VALUES (?,?,?,?,?)");
      trucks.forEach(t => s.run(t.id, t.driver, t.progress, t.status, t.color));
      s.finalize();
      console.log('🚛 Seeded trucks');
    });

  }); // end serialize
}

initDB();
module.exports = db;
