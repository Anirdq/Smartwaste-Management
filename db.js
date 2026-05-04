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
        ('Alex Rivera',  'admin@swms.gov',   '${hash}', 'admin'),
        ('Mark Davis',   'worker@swms.gov',  '${hash}', 'worker'),
        ('Maria Citizen','citizen@swms.gov', '${hash}', 'citizen')`);
      console.log('👤 Seeded users (password: admin123)');
    });

    // ── SEED: bins ─────────────────────────────────────────────────
    db.get("SELECT COUNT(*) AS c FROM bins", (err, row) => {
      if (!row || row.c > 0) return;
      const bins = [
        { id:'BN-1022', location:'Central Park West',    fill:15, status:'empty',  lat:40.7829, lng:-73.9654 },
        { id:'BN-4092', location:'Times Square Plaza',   fill:92, status:'full',   lat:40.7580, lng:-73.9855 },
        { id:'BN-5033', location:'Brooklyn Bridge Path', fill:8,  status:'empty',  lat:40.6892, lng:-74.0445 },
        { id:'BN-3011', location:'Flushing Meadows',     fill:65, status:'medium', lat:40.7282, lng:-73.7949 },
        { id:'BN-1029', location:'Staten Island Ferry',  fill:88, status:'full',   lat:40.6501, lng:-73.9496 },
        { id:'BN-2201', location:'Queens Museum',        fill:40, status:'medium', lat:40.7614, lng:-73.8262 },
        { id:'BN-6701', location:'Madison Square',       fill:0,  status:'empty',  lat:40.7488, lng:-73.9967 },
        { id:'BN-7102', location:'Bronx Zoo Gate',       fill:55, status:'medium', lat:40.8528, lng:-73.8770 },
        { id:'BN-8803', location:'Prospect Park South',  fill:73, status:'medium', lat:40.6602, lng:-73.9690 },
        { id:'BN-9201', location:'JFK Airport Terminal', fill:95, status:'full',   lat:40.6413, lng:-73.7781 }
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
        { id:'#TCK-9901', name:'Maria Gonzalez', loc:'Downtown Plaza',      cat:'Overflowing Bin',   desc:'Garbage scattered around',     on:'Today, 10:45 AM',    status:'Open' },
        { id:'#TCK-9884', name:'John Smith',     loc:'W 4th Street Park',   cat:'Damaged Equipment', desc:'Smart bin lid jammed',         on:'Yesterday, 2:15 PM', status:'In Progress' },
        { id:'#TCK-9830', name:'Anonymous',      loc:'Eastside Alley',      cat:'Illegal Dumping',   desc:'Furniture on sidewalk',        on:'Aug 12, 9:00 AM',    status:'Resolved' },
        { id:'#TCK-9811', name:'David Chen',     loc:'North Avenue Station', cat:'Missed Pickup',     desc:'Bin not emptied on schedule', on:'Aug 11, 4:30 PM',   status:'Open' }
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
        { id:'Truck #1', driver:'Mark Davis',     progress:45, status:'En Route',    color:'#3b82f6' },
        { id:'Truck #2', driver:"Steve O'Connor", progress:98, status:'Returning',   color:'#22c55e' },
        { id:'Truck #3', driver:'Priya Patel',    progress:20, status:'En Route',    color:'#f59e0b' },
        { id:'Truck #4', driver:'Unknown',         progress:0,  status:'Maintenance', color:'#94a3b8' }
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
