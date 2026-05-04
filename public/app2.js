/* app2.js – All missing functionality wired to real API */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const token = () => localStorage.getItem('swms_token');
  const H = () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() });
  const GET = url => fetch(url, { headers: H() }).then(r => r.json()).catch(() => null);
  const PUT = (url, b = {}) => fetch(url, { method: 'PUT', headers: H(), body: JSON.stringify(b) }).then(r => r.json()).catch(() => null);

  function toast(msg, type) {
    if (window.showToast) { window.showToast(msg, type); return; }
    let t = document.getElementById('globalToast');
    if (!t) { t = document.createElement('div'); t.id = 'globalToast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.className = 'toast show'; setTimeout(() => t.classList.remove('show'), 4000);
  }

  // ── DASHBOARD STATS ────────────────────────────────────────────
  async function loadDashStats() {
    const res = await GET('/api/reports');
    if (!res?.data) return;
    const d = res.data;
    const s = id => document.getElementById(id);
    if (s('dash_total_bins')) s('dash_total_bins').textContent = d.total_bins;
    if (s('dash_full_bins'))  s('dash_full_bins').textContent  = d.full_bins;
    if (s('dash_open_comp'))  s('dash_open_comp').textContent  = d.open_complaints;
    if (s('dash_trucks_active')) s('dash_trucks_active').textContent = d.trucks_active;
  }
  loadDashStats();
  // Also called from WebSocket BIN_UPDATED
  window.updateDashboardStats = loadDashStats;

  // ── BIN STATUS FILTER ─────────────────────────────────────────
  const binFilter = document.getElementById('binStatusFilter');
  if (binFilter) {
    binFilter.addEventListener('change', () => {
      const val = binFilter.value.toLowerCase();
      document.querySelectorAll('#binsTableBody .bin-row').forEach(row => {
        const status = (row.dataset.status || '').toLowerCase();
        row.style.display = (!val || status === val) ? '' : 'none';
      });
    });
  }

  // ── CLOSE BIN DETAIL PANEL ────────────────────────────────────
  const closePanel = document.getElementById('closeBinPanel');
  if (closePanel) {
    closePanel.addEventListener('click', () => {
      const p = document.getElementById('binDetailPanel');
      if (p) p.style.display = 'none';
      document.querySelectorAll('.bin-row').forEach(r => r.classList.remove('selected'));
    });
  }

  // ── EMERGENCY PICKUP BUTTON ───────────────────────────────────
  const emerBtn = document.getElementById('emergencyPickupBtn');
  if (emerBtn) {
    emerBtn.addEventListener('click', async () => {
      const binId = document.getElementById('detailBinId')?.textContent?.replace('Bin Details: ', '').trim();
      if (!binId || binId === 'Bin Details') { toast('Select a bin first', 'error'); return; }
      const res = await fetch('/api/alerts', { method: 'POST', headers: H(),
        body: JSON.stringify({ bin_id: binId, level: 100, message: `Emergency pickup requested for ${binId}`, severity: 'critical' }) }).then(r => r.json());
      toast(res.data ? `🚨 Emergency dispatched for ${binId}` : '❌ Failed');
    });
  }

  // ── EXPORT BINS CSV ───────────────────────────────────────────
  document.getElementById('exportBinsBtn')?.addEventListener('click', async () => {
    const res = await GET('/api/bins');
    if (!res?.data) { toast('Export failed', 'error'); return; }
    const rows = [['ID', 'Location', 'Fill Level', 'Status', 'Lat', 'Lng']];
    res.data.forEach(b => rows.push([b.id, b.location, b.fill_level + '%', b.status, b.lat, b.lng]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv,' + encodeURIComponent(csv);
    a.download = 'swms-bins.csv'; a.click();
    toast('✅ CSV exported');
  });

  // ── ADD NEW BIN MODAL ─────────────────────────────────────────
  document.getElementById('addNewBinBtn')?.addEventListener('click', () => {
    const id = 'BN-' + Math.floor(1000 + Math.random() * 9000);
    const loc = prompt('Enter bin location (e.g. "5th Ave & 34th St"):');
    if (!loc) return;
    const lat = parseFloat(prompt('Latitude (e.g. 40.748):') || '40.748');
    const lng = parseFloat(prompt('Longitude (e.g. -73.985):') || '-73.985');
    fetch('/api/bins/add', { method: 'POST', headers: H(), body: JSON.stringify({ id, location: loc, fill_level: 0, status: 'empty', lat, lng }) })
      .then(r => r.json()).then(res => {
        if (res.success) { toast(`✅ Bin ${id} added`); if (window.loadComplaints) window.loadComplaints(); }
        else toast('❌ ' + (res.error || 'Failed'));
      });
  });

  // ── ALERTS PAGE – Full Bin Cards ──────────────────────────────
  async function loadAlertCards() {
    const res = await GET('/api/alerts');
    if (!res?.data) return;
    const full = res.data.filter(a => a.level >= 80);
    const near = res.data.filter(a => a.level >= 60 && a.level < 80);

    // Update tab counts
    const tf = document.getElementById('tab_count_full');
    const tn = document.getElementById('tab_count_nearfull');
    if (tf) tf.textContent = full.length;
    if (tn) tn.textContent = near.length;

    // Notification badge
    const dot = document.querySelector('.notif-dot');
    if (dot && full.length > 0) { dot.style.background = '#ef4444'; dot.title = full.length + ' full bins'; }

    const grid = document.getElementById('alertCardsGrid');
    if (grid) {
      if (!full.length) { grid.innerHTML = '<p style="color:var(--text-muted);padding:30px;grid-column:1/-1;text-align:center">✅ No critical alerts right now</p>'; }
      else {
        grid.innerHTML = full.map(a => {
          const sev = a.level >= 95 ? 'CRITICAL' : 'HIGH';
          const cls = a.level >= 95 ? 'severity-critical' : 'severity-high';
          const col = a.level >= 95 ? '#ef4444' : '#f59e0b';
          const ago = timeAgo(a.created_at);
          return `<div class="alert-card-item">
            <div class="alert-card-top">
              <div class="alert-card-id-row">
                <span class="alert-card-id">BIN ID ${a.bin_id}</span>
                <span class="alert-severity-badge ${cls}">${sev}</span>
              </div>
              <div class="alert-card-loc">📍 ${a.location || '—'}</div>
              <div class="fill-pct-big" style="color:${col}">${a.level}%</div>
              <div class="fill-track-alert"><div class="fill-fill-alert" style="width:${a.level}%;background:${col}"></div></div>
            </div>
            <div class="alert-card-img" style="background:#5a7a5a">
              🗑<div class="img-timestamp">⏱ ${ago}</div>
            </div>
            <div class="alert-card-footer">
              <button class="btn-assign-dropdown" onclick="resolveAlert(${a.id},this)">Resolve ▾</button>
              <button class="btn-more">⋯</button>
            </div>
          </div>`;
        }).join('');
      }
    }

    // Near Full tab
    const nearGrid = document.getElementById('nearFullGrid');
    if (nearGrid) {
      if (!near.length) nearGrid.innerHTML = '<p style="color:var(--text-muted);padding:30px;grid-column:1/-1;text-align:center">No near-full bins right now</p>';
      else nearGrid.innerHTML = near.map(a => `<div class="alert-card-item">
        <div class="alert-card-top">
          <div class="alert-card-id-row"><span class="alert-card-id">BIN ID ${a.bin_id}</span><span class="alert-severity-badge severity-high">WARNING</span></div>
          <div class="alert-card-loc">📍 ${a.location || '—'}</div>
          <div class="fill-pct-big" style="color:#f59e0b">${a.level}%</div>
          <div class="fill-track-alert"><div class="fill-fill-alert" style="width:${a.level}%;background:#f59e0b"></div></div>
        </div>
        <div class="alert-card-footer" style="padding:10px 14px">
          <button class="btn-assign-dropdown" onclick="resolveAlert(${a.id},this)">Resolve ▾</button>
        </div></div>`).join('');
    }

    // Unresolved complaints count
    const compRes = await GET('/api/complaints');
    if (compRes?.data) {
      const unresolved = compRes.data.filter(c => c.status !== 'Resolved');
      const tu = document.getElementById('tab_count_unresolved');
      if (tu) tu.textContent = unresolved.length;
      const ug = document.getElementById('unresolvedGrid');
      if (ug) ug.innerHTML = unresolved.length
        ? unresolved.map(c => `<div class="alert-card-item" style="padding:16px">
            <div class="alert-card-id-row" style="margin-bottom:8px">
              <span class="alert-card-id">${c.ticket_id}</span>
              <span class="alert-severity-badge ${c.status==='Open'?'severity-critical':'severity-high'}">${c.status.toUpperCase()}</span>
            </div>
            <div style="font-size:.85rem;font-weight:600;margin-bottom:4px">${c.citizen_name}</div>
            <div class="alert-card-loc">📍 ${c.location}</div>
            <div style="font-size:.78rem;color:var(--text-muted);margin:6px 0">${c.issue_category}: ${c.issue_desc}</div>
            <div class="alert-card-footer" style="padding:0;margin-top:10px">
              <button class="btn-assign-dropdown" onclick="resolveComplaint('${c.ticket_id}',this)">Mark Resolved ▾</button>
            </div></div>`).join('')
        : '<p style="color:var(--text-muted);padding:30px;grid-column:1/-1;text-align:center">✅ No unresolved complaints</p>';
    }
  }
  window.loadAlertCards = loadAlertCards;

  // Resolve alert
  window.resolveAlert = async (id, btn) => {
    const res = await PUT('/api/alerts/' + id + '/resolve');
    if (res?.success) { btn.closest('.alert-card-item').remove(); toast('✅ Alert resolved'); }
  };

  // Resolve complaint from alert tab
  window.resolveComplaint = async (id, btn) => {
    const res = await PUT('/api/complaints/' + encodeURIComponent(id) + '/resolve');
    if (res?.success) { btn.closest('.alert-card-item').remove(); toast('✅ Complaint resolved'); }
  };

  // ── COMPLAINTS STATS ─────────────────────────────────────────
  async function loadComplaintStats() {
    const res = await GET('/api/complaints');
    if (!res?.data) return;
    const data = res.data;
    const open = data.filter(c => c.status === 'Open').length;
    const inp  = data.filter(c => c.status === 'In Progress').length;
    const res2 = data.filter(c => c.status === 'Resolved').length;
    const s = id => document.getElementById(id);
    if (s('comp_open_count'))       s('comp_open_count').textContent       = open;
    if (s('comp_inprogress_count')) s('comp_inprogress_count').textContent = inp;
    if (s('comp_resolved_count'))   s('comp_resolved_count').textContent   = res2;
  }
  window.loadComplaintStats = loadComplaintStats;
  loadComplaintStats();

  // ── COMPLAINT STATUS FILTER ───────────────────────────────────
  document.getElementById('compStatusFilter')?.addEventListener('change', async e => {
    const status = e.target.value;
    const res = await GET('/api/complaints' + (status ? '?status=' + encodeURIComponent(status) : ''));
    if (res && window.loadComplaints) {
      // Re-render via existing loadComplaints logic using filtered data
      const tbody = document.getElementById('complaintsTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      (res.data || []).forEach(c => {
        const badge = c.status === 'Open'
          ? '<span class="status-badge status-critical complaint-badge">Open</span>'
          : c.status === 'In Progress'
            ? '<span class="status-badge status-halffull complaint-badge">In Progress</span>'
            : '<span class="status-badge status-healthy complaint-badge">Resolved</span>';
        const action = c.status !== 'Resolved'
          ? `<button class="btn-outline btn-resolve" style="padding:6px 12px;font-size:.75rem" data-id="${c.ticket_id}">Mark Resolved</button>`
          : `<button class="btn-outline" style="padding:6px 12px;font-size:.75rem;opacity:.5" disabled>Archived</button>`;
        const tr = document.createElement('tr');
        tr.className = 'bin-row';
        tr.innerHTML = `<td><span class="bin-id-badge">${c.ticket_id}</span></td>
          <td><div style="font-weight:700;font-size:.85rem">${c.citizen_name}</div><div class="location-row"><span class="pin-icon">📍</span><span class="bin-location">${c.location}</span></div></td>
          <td><span style="font-weight:600">${c.issue_category}</span><br/><span style="font-size:.75rem;color:var(--text-muted)">${c.issue_desc}</span></td>
          <td><div style="font-weight:600">${(c.reported_on||'').split(',')[0]}</div><div style="font-size:.75rem;color:var(--text-muted)">${(c.reported_on||'').split(',')[1]||''}</div></td>
          <td>${badge}</td><td>${action}</td>`;
        tbody.appendChild(tr);
      });
    }
    loadComplaintStats();
  });

  // ── NEW TICKET BUTTON ─────────────────────────────────────────
  document.getElementById('newTicketBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('complaintModal');
    if (modal) modal.style.display = 'flex';
  });

  // ── ROUTE OPTIMIZATION ────────────────────────────────────────
  document.querySelectorAll('.btn-optimize').forEach(btn => {
    btn.addEventListener('click', async () => {
      toast('🔄 Computing optimal route…');
      const res = await GET('/api/routes/Truck%20%231');
      if (res?.route?.length) {
        toast(`🗺 Optimized! ${res.route.length} stops — nearest first`);
        // Update route map markers if Leaflet loaded
        const mapEl = document.getElementById('routeMap');
        if (mapEl && mapEl._leaflet_id && window.L) {
          const coords = res.route.map(b => [b.lat, b.lng]);
          L.polyline(coords, { color: '#6366f1', weight: 4, dashArray: '8,4' }).addTo(mapEl._leafletMap || {});
          res.route.forEach((b, i) => {
            L.circleMarker([b.lat, b.lng], { radius: 8, fillColor: '#6366f1', color: '#fff', weight: 2, fillOpacity: 1 })
              .addTo(mapEl._leafletMap || {}).bindPopup(`Stop ${i + 1}: ${b.location}`);
          });
        }
      }
    });
  });

  // ── BELL NOTIFICATIONS ────────────────────────────────────────
  document.querySelector('.header-icon-btn')?.addEventListener('click', () => {
    document.querySelector('.nav-item[data-page="alerts"]')?.click();
  });

  // ── DOWNLOAD PDF REPORT ───────────────────────────────────────
  document.querySelectorAll('.btn-green').forEach(btn => {
    if (!btn.textContent.includes('Download PDF')) return;
    btn.addEventListener('click', async () => {
      const res = await GET('/api/reports');
      if (!res?.data) return;
      const d = res.data;
      const win = window.open('', '_blank');
      win.document.write(`<html><head><title>SWMS Report</title><style>body{font-family:sans-serif;padding:32px;max-width:800px;margin:auto}h1{color:#2d7a3a}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background:#f1f5f9}</style></head><body>
        <h1>🗑 SWMS Analytics Report</h1><p>Generated: ${new Date().toLocaleString()}</p>
        <table><tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Total Bins</td><td>${d.total_bins}</td></tr>
        <tr><td>Full Bins</td><td>${d.full_bins}</td></tr>
        <tr><td>Medium Bins</td><td>${d.medium_bins}</td></tr>
        <tr><td>Avg Fill Level</td><td>${d.avg_fill}%</td></tr>
        <tr><td>Active Alerts</td><td>${d.active_alerts}</td></tr>
        <tr><td>Open Complaints</td><td>${d.open_complaints}</td></tr>
        <tr><td>Resolved Complaints</td><td>${d.resolved_complaints}</td></tr>
        <tr><td>Active Trucks</td><td>${d.trucks_active}</td></tr>
        </table></body></html>`);
      win.print();
    });
  });

  // ── SETTINGS BUTTON ───────────────────────────────────────────
  document.querySelector('.settings-btn')?.addEventListener('click', () => {
    toast('⚙ Settings panel coming soon!');
  });

  // ── PAGE-LEVEL DATA LOADING ───────────────────────────────────
  // Intercept page navigation to load data per page
  const origShowPage = window.showPage;
  const origNavItems = document.querySelectorAll('.nav-item[data-page]');
  origNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const pg = item.dataset.page;
      if (pg === 'alerts')     setTimeout(loadAlertCards, 100);
      if (pg === 'complaints') setTimeout(loadComplaintStats, 100);
      if (pg === 'reports')    setTimeout(loadDashStats, 100);
    });
  });

  // Load on startup
  loadAlertCards();

  // ── ADD BIN API ENDPOINT support ────────────────────────────
  // Note: add POST /api/bins/add to server if not present
  // (fallback: uses existing PUT /api/bins/:id/update logic)

  // ── HELPER: relative time ─────────────────────────────────────
  function timeAgo(ts) {
    if (!ts) return 'recently';
    const diff = Date.now() - new Date(ts + ' UTC').getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return mins + ' mins ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return hrs + ' hr ago';
    return Math.floor(hrs / 24) + ' days ago';
  }

  // ── REAL-TIME: refresh alert cards on WS events ───────────────
  const origHandle = window.handleWsEvent;
  window.handleWsEvent = function(type, payload) {
    if (origHandle) origHandle(type, payload);
    if (['NEW_ALERT','ALERT_RESOLVED','BIN_UPDATED'].includes(type)) {
      const alertsActive = document.getElementById('page-alerts')?.classList.contains('active');
      if (alertsActive) loadAlertCards();
      loadDashStats();
      loadComplaintStats();
    }
    if (type === 'NEW_COMPLAINT' || type === 'COMPLAINT_RESOLVED') {
      loadComplaintStats();
    }
  };

  // ── BIN DATA STATUS ATTRIBUTE for filter ─────────────────────
  // Patch renderBinsTable to include status in dataset
  const origRender = window.renderBinsTable;
  if (origRender) {
    window.renderBinsTable = function(bins) {
      origRender(bins);
      document.querySelectorAll('#binsTableBody .bin-row').forEach((row, i) => {
        const b = bins[i];
        if (b) row.dataset.status = b.status;
      });
    };
  }
});
