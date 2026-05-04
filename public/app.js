/* =====================================================================
   SWMS – Frontend Application Script (Full-Stack Edition)
   - JWT auth state management
   - WebSocket real-time updates
   - API integration for all sections
   ===================================================================== */

'use strict';

// ── AUTH STATE ────────────────────────────────────────────────────────
const AUTH = {
  token: localStorage.getItem('swms_token'),
  user:  JSON.parse(localStorage.getItem('swms_user') || 'null'),

  headers() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` };
  },

  // Redirect to login if no token
  guard() {
    if (!this.token && window.location.pathname.includes('dashboard')) {
      window.location.href = 'index.html';
    }
  },

  logout() {
    localStorage.removeItem('swms_token');
    localStorage.removeItem('swms_user');
    window.location.href = 'index.html';
  }
};

// ── API HELPERS ───────────────────────────────────────────────────────
const API = {
  async get(url) {
    const r = await fetch(url, { headers: AUTH.headers() });
    if (r.status === 401) { AUTH.logout(); return null; }
    return r.json();
  },
  async post(url, body) {
    const r = await fetch(url, { method:'POST', headers: AUTH.headers(), body: JSON.stringify(body) });
    return r.json();
  },
  async put(url, body = {}) {
    const r = await fetch(url, { method:'PUT', headers: AUTH.headers(), body: JSON.stringify(body) });
    return r.json();
  }
};

// ── WEBSOCKET ─────────────────────────────────────────────────────────
let ws;
function connectWS() {
  ws = new WebSocket(`ws://${location.host}`);
  ws.onmessage = ({ data }) => {
    try {
      const { type, payload } = JSON.parse(data);
      handleWsEvent(type, payload);
    } catch {}
  };
  ws.onclose = () => setTimeout(connectWS, 3000); // auto-reconnect
}

function handleWsEvent(type, payload) {
  switch(type) {
    case 'BIN_UPDATED':
      updateBinInDOM(payload);
      updateDashboardStats();
      break;
    case 'NEW_ALERT':
      showToast(`🚨 Alert: Bin ${payload.bin_id} at ${payload.level}%`);
      refreshAlerts();
      break;
    case 'NEW_COMPLAINT':
      showToast(`💬 New complaint submitted`);
      loadComplaints();
      break;
    case 'COMPLAINT_RESOLVED':
    case 'ALERT_RESOLVED':
      refreshAlerts();
      break;
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  AUTH.guard();

  // Populate user info in header
  if (AUTH.user) {
    const name = AUTH.user.name || 'Admin';
    const initials = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const el = document.querySelector('.user-name');
    const av = document.querySelector('.user-avatar');
    const rl = document.querySelector('.user-role');
    if (el) el.textContent = name;
    if (av) av.textContent = initials;
    if (rl) rl.textContent = AUTH.user.role?.charAt(0).toUpperCase() + AUTH.user.role?.slice(1);
  }

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', AUTH.logout.bind(AUTH));

  // ── HAMBURGER MENU ──────────────────────────────────────────────
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const sidebar      = document.querySelector('.sidebar');
  const overlay      = document.getElementById('sidebarOverlay');
  const openSidebar  = () => { sidebar?.classList.add('mobile-open'); overlay?.classList.add('active'); document.body.style.overflow='hidden'; };
  const closeSidebar = () => { sidebar?.classList.remove('mobile-open'); overlay?.classList.remove('active'); document.body.style.overflow=''; };
  if (hamburgerBtn) hamburgerBtn.addEventListener('click', openSidebar);
  if (overlay)      overlay.addEventListener('click', closeSidebar);
  document.querySelectorAll('.nav-item').forEach(i => i.addEventListener('click', () => { if(window.innerWidth<768) closeSidebar(); }));

  // ── LOGIN PAGE ──────────────────────────────────────────────────
  const loginForm = document.getElementById('loginForm');
  if (loginForm) { // handled inline in index.html now
    const togglePw = document.getElementById('togglePw');
    const pwInput  = document.getElementById('pwInput');
    if (togglePw) togglePw.addEventListener('click', () => {
      pwInput.type = pwInput.type==='password'?'text':'password';
      togglePw.textContent = pwInput.type==='password'?'👁':'🙈';
    });
    return; // don't run dashboard code on login page
  }

  // ── SPA NAVIGATION ──────────────────────────────────────────────
  const navItems     = document.querySelectorAll('.nav-item[data-page]');
  const pageSections = document.querySelectorAll('.page-section');

  function showPage(pageId) {
    pageSections.forEach(s => s.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + pageId)?.classList.add('active');
    document.querySelector(`.nav-item[data-page="${pageId}"]`)?.classList.add('active');
    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);

    // Load page-specific data
    if (pageId === 'complaints') loadComplaints();
    if (pageId === 'routes')     loadTrucksAndRoutes();
    if (pageId === 'alerts')     refreshAlerts();
    if (pageId === 'reports')    loadReports();
  }

  navItems.forEach(item => item.addEventListener('click', () => showPage(item.dataset.page)));
  if (document.getElementById('page-dashboard')) showPage('dashboard');

  // ── TABS (Alerts page) ──────────────────────────────────────────
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.style.display='none');
      btn.classList.add('active');
      const t = document.getElementById('tab-' + btn.dataset.tab);
      if (t) t.style.display = 'block';
    });
  });

  // ── TOAST ───────────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    let toast = document.getElementById('globalToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'globalToast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `toast show toast-${type}`;
    setTimeout(() => toast.classList.remove('show'), 4000);
  }
  // Make globally accessible for WS handler
  window.showToast = showToast;

  // ── BUTTONS (static) ───────────────────────────────────────────
  document.querySelectorAll('.btn-assign, .btn-assign-dropdown').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); showToast('✅ Worker assigned!'); })
  );
  document.querySelectorAll('.btn-emergency').forEach(btn =>
    btn.addEventListener('click', () => showToast('🚨 Emergency pickup sent!'))
  );

  // ── RESOLVE COMPLAINT ───────────────────────────────────────────
  function bindResolveButtons() {
    document.querySelectorAll('.btn-resolve').forEach(btn => {
      const fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener('click', async e => {
        const id  = e.target.dataset.id;
        if (!id) return;
        const res = await API.put(`/api/complaints/${encodeURIComponent(id)}/resolve`);
        if (res?.success) {
          const row   = e.target.closest('tr');
          const badge = row?.querySelector('.complaint-badge');
          if (badge) { badge.className='status-badge status-healthy complaint-badge'; badge.textContent='Resolved'; }
          e.target.disabled = true; e.target.textContent='Archived';
          e.target.style.cssText = 'color:var(--text-muted);border-color:var(--border)';
          showToast('✅ Complaint resolved');
        }
      });
    });
  }

  // ── BIN ROW CLICKS ──────────────────────────────────────────────
  function bindBinRowClicks() {
    const rows = document.querySelectorAll('.bin-row');
    rows.forEach(row => {
      row.addEventListener('click', () => {
        rows.forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        const panel = document.getElementById('binDetailPanel');
        if (panel) {
          panel.style.display='flex';
          document.getElementById('detailBinId').textContent  = 'Bin Details: ' + row.dataset.binId;
          document.getElementById('detailLocation').textContent = row.dataset.loc;
          document.getElementById('detailPct').textContent    = row.dataset.fillPct + '%';
          const thumb = document.getElementById('fillThumbPos');
          if (thumb) thumb.style.right = (100 - parseInt(row.dataset.fillPct)) + '%';
        }
      });
    });
  }

  // ── UPDATE A SINGLE BIN IN DOM (from WebSocket) ─────────────────
  function updateBinInDOM({ id, fill_level, status }) {
    const row = document.querySelector(`.bin-row[data-bin-id="${id}"]`);
    if (!row) return;
    row.dataset.fillPct = fill_level;
    const fillEl   = row.querySelector('.fill-fill-mini');
    const pctEl    = row.querySelector('.fill-pct');
    const badgeEl  = row.querySelector('.status-badge');
    const colors   = { full:'#ef4444', medium:'#f59e0b', empty:'#22c55e' };
    const col      = colors[status] || '#22c55e';
    if (fillEl) fillEl.style.width = fill_level + '%';
    if (pctEl)  { pctEl.textContent = fill_level+'%'; pctEl.style.color = col; }
    if (badgeEl) {
      const map = { full:'Critical', medium:'Half Full', empty:'Healthy' };
      const cls = { full:'status-critical', medium:'status-halffull', empty:'status-healthy' };
      badgeEl.className = `status-badge ${cls[status]}`;
      badgeEl.textContent = map[status];
    }
  }

  // ── LOAD BINS (map + table) ─────────────────────────────────────
  function initMaps() {
    const liveMapEl = document.getElementById('liveMap');
    if (liveMapEl && window.L && !liveMapEl._leaflet_id) {
      const map = L.map('liveMap', { zoomControl:true }).setView([40.7128,-74.006], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap', maxZoom:18 }).addTo(map);

      API.get('/api/bins').then(res => {
        if (!res) return;
        const bins   = res.data;
        const colors = { empty:'#22c55e', medium:'#f59e0b', full:'#ef4444' };
        bins.forEach(b => {
          const m = L.circleMarker([b.lat, b.lng], { radius:9, fillColor:colors[b.status], color:'#fff', weight:2, fillOpacity:.95 }).addTo(map);
          m.bindPopup(`<b>${b.id}</b><br>${b.location}<br>Fill: <b>${b.fill_level}%</b>`);
        });
        renderBinsTable(bins);
      });
    }

    // Other maps
    ['concMap','hotspotMap'].forEach(id => {
      const el = document.getElementById(id);
      if (el && window.L && !el._leaflet_id) {
        const m = L.map(id, { zoomControl:false, attributionControl:false }).setView([40.7128,-74.006], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(m);
      }
    });

    const routeMapEl = document.getElementById('routeMap');
    if (routeMapEl && window.L && !routeMapEl._leaflet_id) {
      const rmap = L.map('routeMap', { zoomControl:true }).setView([40.74,-73.95], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(rmap);
      const routeA=[[40.7829,-73.9654],[40.7729,-73.9754],[40.7629,-73.9654],[40.7580,-73.9855]];
      const routeB=[[40.6892,-74.0445],[40.6992,-74.0245],[40.7282,-73.9249]];
      L.polyline(routeA,{color:'#3b82f6',weight:4}).addTo(rmap);
      L.polyline(routeB,{color:'#22c55e',weight:4}).addTo(rmap);
    }
  }

  if (!window.L) {
    const link=document.createElement('link'); link.rel='stylesheet'; link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
    const s=document.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload=initMaps; document.head.appendChild(s);
  } else { initMaps(); }

  function renderBinsTable(bins) {
    const tbody = document.getElementById('binsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    bins.forEach((b, idx) => {
      const isFullColor  = b.status==='full'   ? '#ef4444' : b.status==='medium' ? '#f59e0b' : '#22c55e';
      const fillGrad     = b.status==='full'   ? 'linear-gradient(to right,#22c55e,#fbbf24,#ef4444)'
                         : b.status==='medium' ? 'linear-gradient(to right,#22c55e,#fbbf24)' : '#22c55e';
      const badgeClass   = b.status==='full'   ? 'status-critical' : b.status==='medium' ? 'status-halffull' : 'status-healthy';
      const badgeLabel   = b.status==='full'   ? 'Critical' : b.status==='medium' ? 'Half Full' : 'Healthy';
      const tr = document.createElement('tr');
      tr.className = `bin-row${idx===0?' selected':''}`;
      tr.dataset.binId   = b.id;
      tr.dataset.fillPct = b.fill_level;
      tr.dataset.loc     = b.location;
      tr.innerHTML = `
        <td><span class="bin-id-badge">${b.id}</span></td>
        <td><div class="location-row"><span class="pin-icon">📍</span><span class="bin-location">${b.location}</span></div></td>
        <td><div class="fill-bar-mini"><div class="fill-track-mini"><div class="fill-fill-mini" style="width:${b.fill_level}%;background:${fillGrad}"></div></div><span class="fill-pct" style="color:${isFullColor}">${b.fill_level}%</span></div></td>
        <td><span class="status-badge ${badgeClass}">${badgeLabel}</span></td>`;
      tbody.appendChild(tr);
    });
    bindBinRowClicks();
  }

  // ── DASHBOARD STATS ─────────────────────────────────────────────
  async function updateDashboardStats() {
    const res = await API.get('/api/reports');
    if (!res?.data) return;
    const d = res.data;
    const vals = document.querySelectorAll('.stat-value');
    if (vals[0]) vals[0].textContent = d.total_bins;
    if (vals[1]) vals[1].textContent = d.full_bins;
    if (vals[3]) vals[3].textContent = d.open_complaints;
  }
  updateDashboardStats();

  // ── COMPLAINTS ──────────────────────────────────────────────────
  async function loadComplaints() {
    const res = await API.get('/api/complaints');
    if (!res) return;
    const tbody = document.getElementById('complaintsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    res.data.forEach(c => {
      const badge = c.status==='Open'
        ? '<span class="status-badge status-critical complaint-badge">Open</span>'
        : c.status==='In Progress'
          ? '<span class="status-badge status-halffull complaint-badge">In Progress</span>'
          : '<span class="status-badge status-healthy complaint-badge">Resolved</span>';
      const actionBtn = c.status!=='Resolved'
        ? `<button class="btn-outline btn-resolve" style="padding:6px 12px;font-size:.75rem" data-id="${c.ticket_id}">Mark Resolved</button>`
        : `<button class="btn-outline" style="padding:6px 12px;font-size:.75rem;opacity:.5" disabled>Archived</button>`;
      const tr = document.createElement('tr');
      tr.className = 'bin-row';
      tr.innerHTML = `
        <td><span class="bin-id-badge">${c.ticket_id}</span></td>
        <td><div style="font-weight:700;font-size:.85rem">${c.citizen_name}</div><div class="location-row"><span class="pin-icon">📍</span><span class="bin-location">${c.location}</span></div></td>
        <td><span style="font-weight:600">${c.issue_category}</span><br/><span style="font-size:.75rem;color:var(--text-muted)">${c.issue_desc}</span></td>
        <td><div style="font-weight:600">${c.reported_on?.split(',')[0]||''}</div><div style="font-size:.75rem;color:var(--text-muted)">${c.reported_on?.split(',')[1]||''}</div></td>
        <td>${badge}</td>
        <td>${actionBtn}</td>`;
      tbody.appendChild(tr);
    });
    bindResolveButtons();
  }
  window.loadComplaints = loadComplaints;

  // ── SUBMIT COMPLAINT FORM ───────────────────────────────────────
  const complaintForm = document.getElementById('complaintForm');
  if (complaintForm) {
    complaintForm.addEventListener('submit', async e => {
      e.preventDefault();
      const body = {
        citizen_name:   document.getElementById('cf_name')?.value    || 'Anonymous',
        location:       document.getElementById('cf_location')?.value || '',
        issue_category: document.getElementById('cf_category')?.value || '',
        issue_desc:     document.getElementById('cf_desc')?.value     || ''
      };
      const res = await fetch('/api/complaints', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) { showToast('✅ Complaint submitted! Ticket: ' + data.data.ticket_id); complaintForm.reset(); loadComplaints(); }
      else showToast('❌ ' + (data.error || 'Submit failed'), 'error');
    });
  }

  // ── TRUCKS + ROUTES ─────────────────────────────────────────────
  async function loadTrucksAndRoutes() {
    const res = await API.get('/api/trucks');
    if (!res) return;
    const container = document.getElementById('fleetContainer');
    if (!container) return;
    container.innerHTML = '';
    res.data.forEach(t => {
      const badgeCls = t.status==='En Route' ? 'status-critical' : t.status==='Returning' ? 'status-healthy' : 'status-halffull';
      const inner    = t.status==='Maintenance'
        ? `<div style="font-size:.8rem;color:var(--text-muted)">Offline – Maintenance</div>`
        : `<div style="font-size:.8rem;color:var(--text-secondary);margin-bottom:10px">Driver: <b>${t.driver}</b></div>
           <div class="fill-bar-mini"><div class="fill-track-mini"><div class="fill-fill-mini" style="width:${t.progress}%;background:${t.route_color}"></div></div><span class="fill-pct" style="color:${t.route_color}">${t.progress}%</span></div>
           <div style="font-size:.7rem;color:var(--text-muted);text-align:right;margin-top:4px">Route Progress</div>`;
      container.innerHTML += `<div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;${t.status==='Maintenance'?'background:var(--bg-page)':''}">
        <div style="font-weight:700;font-size:.9rem;margin-bottom:8px">${t.id} <span class="status-badge ${badgeCls}" style="font-size:.65rem">${t.status}</span></div>${inner}</div>`;
    });
  }
  window.loadTrucksAndRoutes = loadTrucksAndRoutes;

  // Route optimizer button
  document.querySelectorAll('.btn-optimize').forEach(btn => {
    btn.addEventListener('click', async () => {
      showToast('🔄 Computing optimal route…');
      const res = await API.get('/api/routes/Truck%20%231');
      if (res?.route) showToast(`🗺 Optimized! ${res.route.length} stops planned (nearest-first)`);
    });
  });

  // ── ALERTS ──────────────────────────────────────────────────────
  async function refreshAlerts() {
    const res = await API.get('/api/alerts');
    if (!res) return;
    const container = document.getElementById('alertsFeed');
    if (!container) return;
    container.innerHTML = '';
    if (!res.data.length) { container.innerHTML = '<p style="color:var(--text-muted);padding:20px">No active alerts 🎉</p>'; return; }
    res.data.slice(0, 15).forEach(a => {
      const el = document.createElement('div');
      el.className = 'alert-item';
      el.innerHTML = `
        <div class="alert-item-top">
          <div><div class="alert-bin-id">${a.bin_id}</div><div class="alert-location">${a.location||''}</div></div>
          <span class="badge-full">${a.level}% FULL</span>
        </div>
        <div class="alert-time">${new Date(a.created_at).toLocaleTimeString()}</div>
        <button class="btn-assign" data-alert-id="${a.id}">Resolve Alert</button>`;
      el.querySelector('.btn-assign').addEventListener('click', async ev => {
        const r = await API.put(`/api/alerts/${ev.target.dataset.alertId}/resolve`);
        if (r?.success) { el.remove(); showToast('✅ Alert resolved'); }
      });
      container.appendChild(el);
    });
  }
  window.refreshAlerts = refreshAlerts;

  // ── REPORTS ─────────────────────────────────────────────────────
  async function loadReports() {
    const res = await API.get('/api/reports');
    if (!res?.data) return;
    const d = res.data;
    const set = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
    set('rpt_total_bins',    d.total_bins);
    set('rpt_full_bins',     d.full_bins);
    set('rpt_avg_fill',      d.avg_fill + '%');
    set('rpt_alerts',        d.active_alerts);
    set('rpt_open_comp',     d.open_complaints);
    set('rpt_resolved_comp', d.resolved_complaints);
    set('rpt_trucks',        d.trucks_active);
  }

  // ── CHARTS ──────────────────────────────────────────────────────
  function drawDonut(id, data, colors, total) {
    const canvas = document.getElementById(id); if (!canvas) return;
    const ctx=canvas.getContext('2d'), cx=canvas.width/2, cy=canvas.height/2, r=38, lw=14;
    let a=-Math.PI/2;
    data.forEach((val,i)=>{ const s=(val/total)*2*Math.PI; ctx.beginPath(); ctx.arc(cx,cy,r,a,a+s); ctx.strokeStyle=colors[i]; ctx.lineWidth=lw; ctx.stroke(); a+=s; });
    ctx.beginPath(); ctx.arc(cx,cy,r-lw/2,0,2*Math.PI); ctx.fillStyle='#fff'; ctx.fill();
  }
  drawDonut('donutWasteChart',[65,35],['#2d7a3a','#c8e6c9'],100);

  function drawLineChart(id, data, color) {
    const svg=document.getElementById(id); if(!svg) return;
    const W=svg.clientWidth||280, H=svg.clientHeight||110, p=10;
    const max=Math.max(...data), min=Math.min(...data), xStep=(W-p*2)/(data.length-1);
    const pts=data.map((v,i)=>`${p+i*xStep},${p+((max-v)/(max-min||1))*(H-p*2)}`).join(' ');
    const poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');
    poly.setAttribute('points',pts); poly.setAttribute('fill','none'); poly.setAttribute('stroke',color); poly.setAttribute('stroke-width','2.5'); poly.setAttribute('stroke-linecap','round');
    svg.appendChild(poly);
    const area=document.createElementNS('http://www.w3.org/2000/svg','polygon');
    area.setAttribute('points',`${p},${H} ${pts} ${p+(data.length-1)*xStep},${H}`); area.setAttribute('fill',color); area.setAttribute('fill-opacity','0.08');
    svg.insertBefore(area,poly);
  }
  drawLineChart('monthlyTrendSvg',[12,19,15,22,18,25,28,24,30,27,35,42],'#2d7a3a');
  drawLineChart('reportTrendSvg', [40,55,48,62,58,70,65,72,68,80,75,89],'#2d7a3a');

  // ── SEARCH ──────────────────────────────────────────────────────
  document.querySelectorAll('.search-input').forEach(input => {
    input.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.bin-row').forEach(row => { row.style.display = row.textContent.toLowerCase().includes(q)?'':'none'; });
    });
  });

  // ── REAL-TIME CLOCK ─────────────────────────────────────────────
  function tick() { const el=document.getElementById('liveClock'); if(el) el.textContent=new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}); }
  tick(); setInterval(tick, 30000);

  // ── START WEBSOCKET ─────────────────────────────────────────────
  connectWS();

  // Initial data loads
  loadComplaints();
  loadTrucksAndRoutes();
  refreshAlerts();
});
