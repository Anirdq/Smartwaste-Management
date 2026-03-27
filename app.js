/* =====================================================================
   SWMS – SmartCity Waste Management System
   Application Script
   ===================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // -------- HAMBURGER MENU (mobile) ------------------------------
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const sidebar      = document.querySelector('.sidebar');
  const overlay      = document.getElementById('sidebarOverlay');

  function openSidebar() {
    sidebar && sidebar.classList.add('mobile-open');
    overlay && overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    sidebar && sidebar.classList.remove('mobile-open');
    overlay && overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (hamburgerBtn) hamburgerBtn.addEventListener('click', openSidebar);
  if (overlay)      overlay.addEventListener('click', closeSidebar);

  // Close sidebar when a nav item is clicked (mobile)
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth < 768) closeSidebar();
    });
  });

  // -------- LOGIN -------------------------------------------------
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', e => {
      e.preventDefault();
      const role = document.getElementById('roleSelect').value;
      if (!role) { alert('Please select a role'); return; }
      window.location.href = 'dashboard.html';
    });

    const togglePw = document.getElementById('togglePw');
    const pwInput  = document.getElementById('pwInput');
    if (togglePw) {
      togglePw.addEventListener('click', () => {
        pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
        togglePw.textContent = pwInput.type === 'password' ? '👁' : '🙈';
      });
    }
  }

  // -------- NAV ROUTING (SPA feel via page sections) --------------
  const navItems = document.querySelectorAll('.nav-item[data-page]');
  const pageSections = document.querySelectorAll('.page-section');

  function showPage(pageId) {
    pageSections.forEach(s => s.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));
    const section = document.getElementById('page-' + pageId);
    if (section) section.classList.add('active');
    const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (navItem) navItem.classList.add('active');
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => showPage(item.dataset.page));
  });

  // Show dashboard by default
  if (document.getElementById('page-dashboard')) showPage('dashboard');

  // -------- BIN TABLE ROW SELECTION -------------------------------
  const binRows = document.querySelectorAll('.bin-row');
  const detailPanel = document.getElementById('binDetailPanel');
  binRows.forEach(row => {
    row.addEventListener('click', () => {
      binRows.forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      if (detailPanel) {
        detailPanel.style.display = 'flex';
        const id  = row.dataset.binId  || '#BN-2091';
        const pct = row.dataset.fillPct || '92';
        const loc = row.dataset.loc    || '32nd Avenue, Central Park';
        document.getElementById('detailBinId').textContent  = 'Bin Details: ' + id;
        document.getElementById('detailLocation').textContent = loc;
        document.getElementById('detailPct').textContent    = pct + '%';
        const thumb = document.getElementById('fillThumbPos');
        if (thumb) thumb.style.right = (100 - parseInt(pct)) + '%';
      }
    });
  });

  // -------- TABS (Alerts page) ------------------------------------
  const tabBtns = document.querySelectorAll('.tab-btn[data-tab]');
  const tabContents = document.querySelectorAll('.tab-content');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const t = document.getElementById('tab-' + btn.dataset.tab);
      if (t) t.classList.add('active');
    });
  });

  // -------- ASSIGN WORKER buttons ---------------------------------
  document.querySelectorAll('.btn-assign, .btn-assign-dropdown').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      showToast('✅ Worker assigned successfully!');
    });
  });

  // -------- EMERGENCY button --------------------------------------
  document.querySelectorAll('.btn-emergency').forEach(btn => {
    btn.addEventListener('click', () => showToast('🚨 Emergency pickup request sent!'));
  });

  // -------- OPTIMIZE ROUTE button ---------------------------------
  document.querySelectorAll('.btn-optimize').forEach(btn => {
    btn.addEventListener('click', () => showToast('🗺 Route optimized for Truck #4!'));
  });

  // -------- TOAST -------------------------------------------------
  function showToast(msg) {
    let toast = document.getElementById('globalToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'globalToast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // -------- LEAFLET MAPS ------------------------------------------
  function initMaps() {
    // Live status map on dashboard
    const liveMapEl = document.getElementById('liveMap');
    if (liveMapEl && window.L && !liveMapEl._leaflet_id) {
      const map = L.map('liveMap', { zoomControl: true }).setView([40.7128, -74.006], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 18
      }).addTo(map);

      const bins = [
        { lat: 40.7829, lng: -73.9654, status: 'empty',  id: 'BN-1022' },
        { lat: 40.7580, lng: -73.9855, status: 'full',   id: 'BN-4092' },
        { lat: 40.6892, lng: -74.0445, status: 'empty',  id: 'BN-5033' },
        { lat: 40.7282, lng: -73.7949, status: 'medium', id: 'BN-3011' },
        { lat: 40.6501, lng: -73.9496, status: 'full',   id: 'BN-1029' },
        { lat: 40.7614, lng: -73.8262, status: 'medium', id: 'BN-2201' },
        { lat: 40.7488, lng: -73.9967, status: 'empty',  id: 'BN-6701' },
      ];

      const colors = { empty: '#22c55e', medium: '#f59e0b', full: '#ef4444' };

      bins.forEach(b => {
        const marker = L.circleMarker([b.lat, b.lng], {
          radius: 9, fillColor: colors[b.status], color: '#fff',
          weight: 2, opacity: 1, fillOpacity: 0.95
        }).addTo(map);
        marker.bindPopup(`<b>${b.id}</b><br>Status: <b style="color:${colors[b.status]}">${b.status.toUpperCase()}</b>`);
      });
    }

    // Concentration map on reports
    const concMapEl = document.getElementById('concMap');
    if (concMapEl && window.L && !concMapEl._leaflet_id) {
      const cmap = L.map('concMap', { zoomControl: false, attributionControl: false }).setView([40.7128, -74.006], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(cmap);
    }

    // Hotspot map on alerts
    const hotspotEl = document.getElementById('hotspotMap');
    if (hotspotEl && window.L && !hotspotEl._leaflet_id) {
      const hmap = L.map('hotspotMap', { zoomControl: false, attributionControl: false }).setView([40.7128, -74.006], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(hmap);

      const alertSpots = [
        { lat: 40.7580, lng: -73.9855, color: '#ef4444' },
        { lat: 40.7614, lng: -73.8262, color: '#f59e0b' },
        { lat: 40.7282, lng: -73.7949, color: '#f59e0b' },
      ];
      alertSpots.forEach(a => {
        L.circleMarker([a.lat, a.lng], {
          radius: 12, fillColor: a.color, color: '#fff', weight: 2, fillOpacity: 0.8
        }).addTo(hmap);
      });
    }
  }

  // Load Leaflet if not loaded yet
  if (!window.L) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = initMaps;
    document.head.appendChild(script);
  } else {
    initMaps();
  }

  // -------- DONUT CHART (Canvas) ----------------------------------
  function drawDonut(canvasId, data, colors, total) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const r = 38, lineWidth = 14;
    let startAngle = -Math.PI / 2;

    data.forEach((val, i) => {
      const slice = (val / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + slice);
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      startAngle += slice;
    });

    // Inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, r - lineWidth / 2, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  drawDonut('donutWasteChart', [65, 35], ['#2d7a3a', '#c8e6c9'], 100);

  // -------- LINE CHART (SVG) --------------------------------------
  function drawLineChart(svgId, data, color) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    const W = svg.clientWidth || 280;
    const H = svg.clientHeight || 110;
    const pad = 10;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const xStep = (W - pad * 2) / (data.length - 1);

    const points = data.map((v, i) => {
      const x = pad + i * xStep;
      const y = pad + ((max - v) / (max - min || 1)) * (H - pad * 2);
      return `${x},${y}`;
    }).join(' ');

    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', points);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', color);
    polyline.setAttribute('stroke-width', '2.5');
    polyline.setAttribute('stroke-linecap', 'round');
    polyline.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(polyline);

    // Area fill
    const areaPoints = `${pad},${H} ` + points + ` ${pad + (data.length-1)*xStep},${H}`;
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', areaPoints);
    polygon.setAttribute('fill', color);
    polygon.setAttribute('fill-opacity', '0.08');
    svg.insertBefore(polygon, polyline);
  }

  drawLineChart('monthlyTrendSvg', [12, 19, 15, 22, 18, 25, 28, 24, 30, 27, 35, 42], '#2d7a3a');
  drawLineChart('reportTrendSvg', [40, 55, 48, 62, 58, 70, 65, 72, 68, 80, 75, 89], '#2d7a3a');

  // -------- SEARCH BAR --------------------------------------------
  document.querySelectorAll('.search-input').forEach(input => {
    input.addEventListener('input', e => {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll('.bin-row').forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
      });
    });
  });

  // -------- REAL-TIME CLOCK ---------------------------------------
  function updateTime() {
    const el = document.getElementById('liveClock');
    if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  updateTime();
  setInterval(updateTime, 30000);

});
