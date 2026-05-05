# Smart Waste Management System (SWMS) - Chennai Metro Edition

A comprehensive, full-stack enterprise IoT platform designed to optimize waste collection and management for the Chennai metropolitan area.

## Features

### 🌟 Enterprise Admin Dashboard (`dashboard.html`)
- **Real-Time IoT Monitoring:** Live tracking of bin fill levels across major Chennai zones (Marina Beach, T. Nagar, Guindy, etc.).
- **Dynamic Routing:** Leaflet.js map tracking active garbage trucks and calculating optimized routes.
- **Analytics Engine:** Visualizes daily and monthly waste collection trends using dynamic SVG and Canvas charts.
- **Role-Based Access Control (RBAC):** Secure JWT authentication separating Admins, Workers, and Citizens.
- **User Settings:** Complete profile management and dark/light theme toggling.

### 🚛 Field Operations Portal (`worker.html`)
- **Mobile-Optimized:** Designed for garbage collectors in the field.
- **Priority Routing:** Displays only bins exceeding 50% capacity on the map.
- **One-Click Collection:** "Mark Collected" button instantly resets bin fill levels and updates the main admin dashboard in real-time via WebSockets.

### 🏙️ Citizen Portal (`citizen.html`)
- **Public Engagement:** Allows citizens to log in and view collection schedules for their specific locality.
- **Direct Reporting:** Integrated ticketing system for citizens to report overflowing bins or damaged infrastructure directly to the admin dashboard.

## Tech Stack

- **Frontend:** Vanilla HTML5, CSS3 (Custom Variables, Flexbox/Grid), JavaScript (ES6+).
- **Backend:** Node.js, Express.js.
- **Database:** SQLite3 (Auto-seeding with mock Chennai data).
- **Real-Time:** WebSockets (`ws` library).
- **Mapping:** Leaflet.js with CartoDB Voyager tiles.
- **Authentication:** JSON Web Tokens (JWT) & bcrypt.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- npm

### Installation
1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd smartbin
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
   *Note: On the first run, the SQLite database (`database.sqlite`) will be automatically created and seeded with mock locations, alerts, and users.*

### Default Credentials
- **Admin:** `admin@swms.gov` / `admin123`
- **Field Worker:** `worker@swms.gov` / `admin123`
- **Citizen:** `citizen@swms.gov` / `admin123`

## Usage
Open your browser and navigate to `http://localhost:3000`. Log in using one of the credentials above to be automatically routed to the correct portal based on your role.

## License
© 2026 SmartCity Waste Management Inc. All rights reserved.
