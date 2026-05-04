# 🧠 SWMS (Smart Waste Management System) - LLM Knowledge Transfer Document

This document is designed to provide complete context to any LLM working on this project. It outlines the architecture, data models, file structures, and data flows of the Smart Waste Management System.

---

## 📌 1. Project Overview
SWMS is a **Full-Stack IoT Dashboard** designed to monitor smart waste bins, manage alerts, handle citizen complaints, and optimize garbage truck routes. 

It started as a static frontend UI and was converted into a full-stack application with a Node.js/Express backend, SQLite database, and real-time WebSocket updates.

## 🛠 2. Tech Stack
*   **Backend:** Node.js, Express.js
*   **Database:** SQLite (`sqlite3` module)
*   **Authentication:** JWT (`jsonwebtoken`), Password Hashing (`bcryptjs`)
*   **Real-time:** WebSockets (`ws`)
*   **Frontend:** Vanilla HTML, CSS, JavaScript (No framework)
*   **Maps:** Leaflet.js (via CDN)

---

## 📂 3. File Structure & Responsibilities

```text
smartbin/
│
├── server.js          # Main Express server, API routes, WebSocket server, IoT simulator
├── db.js              # Database connection, Schema definition, Seeding logic
├── database.sqlite    # Auto-generated SQLite database file
├── package.json       # Project metadata and dependencies
│
└── public/            # Frontend static files
    ├── index.html     # Login and Registration page
    ├── dashboard.html # Single Page Application (SPA) layout for the admin panel
    ├── app.js         # Core frontend logic (Auth, WS, rendering tables, routing)
    ├── app2.js        # Supplementary frontend logic (Event listeners, charts, exports)
    └── style.css      # CSS styling
```

---

## 🗄 4. Database Schema (`db.js`)
The SQLite database contains 6 main tables:

1.  **users:** `id`, `name`, `email`, `password` (hashed), `role` (admin/worker/citizen), `created_at`
2.  **bins:** `id` (e.g. BN-1029), `location`, `fill_level` (0-100), `status` (empty/medium/full), `lat`, `lng`, `updated_at`
3.  **alerts:** `id`, `bin_id`, `level`, `message`, `severity` (high/critical), `status` (active/resolved), `created_at`
4.  **complaints:** `ticket_id`, `citizen_name`, `location`, `issue_category`, `issue_desc`, `status` (Open/In Progress/Resolved), `reported_on`
5.  **trucks:** `id`, `driver_name`, `capacity`, `current_load`, `status` (active/idle/maintenance), `lat`, `lng`
6.  **collections:** `id`, `truck_id`, `bin_id`, `collected_at`

*Note: Database auto-seeds upon initialization if the tables are empty.*

---

## ⚙️ 5. Backend Architecture (`server.js`)

### 5.1 REST API Endpoints
All protected endpoints require the header: `Authorization: Bearer <token>`

*   **Auth:** `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`
*   **Bins:** `GET /api/bins`, `GET /api/bins/:id`, `PUT /api/bins/:id/update`, `POST /api/bins/add`
*   **Alerts:** `GET /api/alerts`, `POST /api/alerts`, `PUT /api/alerts/:id/resolve`
*   **Complaints:** `GET /api/complaints`, `POST /api/complaints`, `PUT /api/complaints/:id/resolve`
*   **Trucks:** `GET /api/trucks`, `PUT /api/trucks/:id`
*   **Routes:** `GET /api/routes/:truckId` (Calculates nearest-first TSP route using Haversine distance)
*   **Reports:** `GET /api/reports` (Aggregates system-wide statistics)

### 5.2 Real-time & IoT Simulator
*   **WebSocket Server (`ws`):** Runs on the same port (3000) as Express. Broadcasts JSON payloads `({ type, payload })` to all connected clients.
*   **IoT Simulator:** A `setInterval` loop runs every 7 seconds. It picks random bins, modifies their `fill_level`, and updates the database.
*   **Auto-Alerting:** If the simulator pushes a bin's `fill_level` >= 80%, it automatically inserts a record into the `alerts` table and broadcasts a `NEW_ALERT` WS event.

---

## 🖥 6. Frontend Architecture

### 6.1 Authentication Flow
1. User logs in via `index.html`.
2. Token is stored in `localStorage.getItem('swms_token')`.
3. Redirects to `dashboard.html`.
4. `app.js` runs `AUTH.guard()`: if no token is present, it redirects back to `index.html`.
5. All API requests use the `AUTH.headers()` helper.

### 6.2 SPA Navigation
Navigation is handled by hiding/showing `<section class="page-section">` elements in `dashboard.html` based on sidebar clicks (managed in `app.js`).

### 6.3 Data Binding & WebSockets
*   **`app.js`:** Responsible for initializing the Leaflet Map, rendering the primary Bins table, rendering the Complaints table, and handling the WebSocket connection.
*   **WebSocket Handler:** Listens for `BIN_UPDATED`, `NEW_ALERT`, `NEW_COMPLAINT`, etc., and updates the DOM dynamically without page reloads.
*   **`app2.js`:** Contains all the event listeners for static UI elements (Filters, Buttons, Modals, Tab Switching, Dashboard Stats fetching, CSV Export, PDF generation).

---

## 🔄 7. Common Data Flows

**Flow 1: IoT Sensor to UI Update**
1. Backend IoT interval (every 7s) updates a bin's fill level in SQLite.
2. Backend calls `broadcast('BIN_UPDATED', binData)`.
3. Frontend WS receives `BIN_UPDATED`.
4. Frontend `app.js` updates the specific row in the Bins table, updates the map marker color, and calls `updateDashboardStats()` in `app2.js` to refresh the header stats.

**Flow 2: Submitting a Complaint**
1. User clicks "+ New Ticket" -> UI modal opens.
2. User submits form -> POST `/api/complaints`.
3. Backend saves to SQLite and broadcasts `NEW_COMPLAINT`.
4. Frontend WS receives `NEW_COMPLAINT`, triggers a toast notification, and calls `loadComplaints()` to re-fetch and render the table.

---

## 🏃 8. How to Run & Test
1. **Install:** `npm install`
2. **Run:** `npm start` (or `node server.js`)
3. **URL:** `http://localhost:3000`
4. **Default Logins:** 
   * `admin@swms.gov` / `admin123`
   * `worker@swms.gov` / `admin123`
   * `citizen@swms.gov` / `admin123`

*(To reset the database, simply delete `database.sqlite` and restart the server; it will automatically re-seed).*
