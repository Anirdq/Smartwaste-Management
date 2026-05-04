# 🗑 SmartCity Waste Management System (SWMS)

A full-stack IoT-enabled waste management platform built with Node.js, Express, SQLite, WebSocket, and JWT.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open in browser
http://localhost:3000
```

---

## 🔑 Default Login Credentials

| Role    | Email                | Password   |
|---------|----------------------|------------|
| Admin   | admin@swms.gov       | admin123   |
| Worker  | worker@swms.gov      | admin123   |
| Citizen | citizen@swms.gov     | admin123   |

---

## 🏗 Architecture

```
smartbin/
├── server.js          # Express server + WebSocket + IoT simulator
├── db.js              # SQLite schema + seed data
├── database.sqlite    # Auto-generated database file
├── package.json
└── public/
    ├── index.html     # Login page (JWT auth)
    ├── dashboard.html # Main SPA dashboard
    ├── app.js         # Frontend: API calls, WebSocket, state
    └── style.css      # All styles
```

---

## 🔌 REST API Endpoints

### Auth
| Method | Endpoint              | Description            | Auth? |
|--------|-----------------------|------------------------|-------|
| POST   | `/api/auth/login`     | Login, returns JWT     | No    |
| POST   | `/api/auth/register`  | Register new user      | No    |
| GET    | `/api/auth/me`        | Get current user       | Yes   |

### Bins
| Method | Endpoint              | Description            |
|--------|-----------------------|------------------------|
| GET    | `/api/bins`           | All bins (sorted)      |
| GET    | `/api/bins/:id`       | Single bin             |
| PUT    | `/api/bins/:id/update`| Update fill/status     |

### Alerts
| Method | Endpoint                    | Description          |
|--------|-----------------------------|----------------------|
| GET    | `/api/alerts`               | Active alerts        |
| POST   | `/api/alerts`               | Create alert         |
| PUT    | `/api/alerts/:id/resolve`   | Resolve alert        |

### Complaints
| Method | Endpoint                        | Description           |
|--------|---------------------------------|-----------------------|
| GET    | `/api/complaints`               | All complaints        |
| POST   | `/api/complaints`               | Submit complaint      |
| PUT    | `/api/complaints/:id/resolve`   | Resolve complaint     |

### Trucks / Fleet
| Method | Endpoint          | Description            |
|--------|-------------------|------------------------|
| GET    | `/api/trucks`     | All trucks             |
| PUT    | `/api/trucks/:id` | Update truck status    |

### Route Optimization
| Method | Endpoint                  | Description                    |
|--------|---------------------------|--------------------------------|
| GET    | `/api/routes/:truckId`    | Optimized bin route (nearest-first) |

### Reports
| Method | Endpoint        | Description         |
|--------|-----------------|---------------------|
| GET    | `/api/reports`  | Aggregate stats     |

---

## ⚡ Real-Time Features

- **WebSocket** — all connected browsers receive live updates
- **IoT Simulator** — every 7 seconds, bin fill levels change randomly
- **Auto-alerts** — when any bin crosses 80% fill, an alert is auto-created and pushed to all clients
- **Live DOM updates** — bin table + map markers update in-place without page reload

---

## 🔐 Security

- Passwords are hashed with **bcryptjs** (salt rounds: 10)
- All protected routes require `Authorization: Bearer <token>` header
- JWT tokens expire after **8 hours**

---

## 🛠 Tech Stack

| Layer     | Technology           |
|-----------|----------------------|
| Backend   | Node.js + Express 4  |
| Database  | SQLite3              |
| Auth      | JWT + bcryptjs       |
| Real-time | WebSocket (ws)       |
| Frontend  | Vanilla HTML/CSS/JS  |
| Maps      | Leaflet.js + OSM     |
