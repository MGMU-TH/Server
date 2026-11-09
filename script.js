(() => {
  "use strict";

  const STORAGE_KEY = "opscore_console_v2";
  const NORMAL_EVENT_MIN_MS = 15000;      // general problem: random every 15-30 s
  const NORMAL_EVENT_MAX_MS = 30000;
  const SECURITY_EVENT_INTERVAL_MS = 60000; // security attack: every 60 s
  const ROUTES = [
    { id: "route-a", name: "Primary Fiber", detail: "Main uplink · 1 Gbps" },
    { id: "route-b", name: "Secondary Fiber", detail: "Backup uplink · 1 Gbps" },
    { id: "route-c", name: "Wireless Backup", detail: "Failover link · 300 Mbps" }
  ];

  const $ = (id) => document.getElementById(id);
  const nowTime = () => new Date().toLocaleTimeString("th-TH", { hour12: false });
  const nowDate = () => new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  const stamp = () => new Date().toISOString();

  function makeServers() {
    const names = ["AUTH", "DATABASE", "WEB", "STORAGE", "MAIL"];
    return Array.from({ length: 15 }, (_, i) => ({
      id: `SRV-${String(i + 1).padStart(2, "0")}`,
      rack: Math.floor(i / 5) + 1,
      name: names[i % 5],
      status: "online",
      route: ROUTES[0].id,
      uptime: `${98 + (i % 3)}.${(i * 7) % 10}%`,
      cpu: 18 + ((i * 11) % 46),
      memory: 32 + ((i * 13) % 48),
      lastCheck: stamp()
    }));
  }

  function initialState() {
    return {
      servers: makeServers(),
      incidents: [],
      logs: [{ id: 1, time: stamp(), level: "SUCCESS", event: "Console initialized", detail: "Operations console is ready." }],
      selectedServer: null,
      serverFilter: "all",
      incidentFilter: "all",
      sound: true,
      volume: 0.6,
      ambient: true,
      uiSounds: true,
      light: false,
      nextIncidentId: 1,
      lastEventAt: Date.now(),
      activeSpecial: null
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return initialState();
      const saved = JSON.parse(raw);
      const fresh = initialState();
      if (!Array.isArray(saved.servers) || saved.servers.length !== 15) return fresh;
      return { ...fresh, ...saved, activeSpecial: null };
    } catch (_) { return initialState(); }
  }

  let state = loadState();
  let eventTimer = null;
  let securityTimer = null;
  let currentModalAction = null;
  let keypadValue = "";

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function log(level, event, detail) {
    state.logs.unshift({ id: Date.now() + Math.random(), time: stamp(), level, event, detail });
    state.logs = state.logs.slice(0, 300);
    save();
    renderLogs();
    renderRecentActivity();
  }

  function toast(message, type = "success") {
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    node.textContent = message;
    $("toastRegion").appendChild(node);
    setTimeout(() => node.remove(), 3200);
  }

  function playTone(kind) { SFX.alert(kind); }
  function applyAudio() { SFX.configure({ on: state.sound, vol: state.volume, amb: state.ambient, ui: state.uiSounds }); }

  function serverById(id) { return state.servers.find(s => s.id === id); }
  const kindOf = (i) => i.type === "special" ? "security" : (i.kind || (i.title.includes("restart") ? "restart" : "switch"));
  const openNormalFor = (id) => state.incidents.find(i => i.serverId === id && i.status === "open" && i.type === "normal");
  const hasOpenSpecial = (id) => state.incidents.some(i => i.serverId === id && i.status === "open" && i.type === "special");
  function openIncidents() { return state.incidents.filter(i => i.status === "open"); }
  function setPage(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === `page-${page}`));
    document.querySelectorAll(".nav-item[data-page]").forEach(b => b.classList.toggle("active", b.dataset.page === page));
    const labels = { overview: "Overview", servers: "Server Room", security: "Security Center", incidents: "Incidents", logs: "System Logs" };
    $("pageCrumb").textContent = labels[page] || "Overview";
    $("sidebar").classList.remove("open");
    if (page === "servers") renderServers();
    if (page === "security") renderSecurity();
    if (page === "incidents") renderIncidents();
    if (page === "logs") renderLogs();
  }

  function renderClock() {
    $("clock").textContent = nowTime();
    $("footerTime").textContent = nowTime();
    $("dateLabel").textContent = nowDate();
  }

  function renderMetrics() {
    const online = state.servers.filter(s => s.status === "online").length;
    const warning = state.servers.filter(s => s.status !== "online").length;
    $("totalServers").textContent = state.servers.length;
    $("onlineServers").textContent = online;
    $("warningServers").textContent = warning;
    $("openIncidents").textContent = openIncidents().length;
    $("incidentNavCount").textContent = openIncidents().length;
    $("securityNavCount").textContent = state.incidents.filter(i => i.type === "special" && i.status === "open").length;
    $("filterAll").textContent = state.servers.length;
    $("filterOnline").textContent = online;
    $("filterWarning").textContent = warning;
  }

  function renderRackOverview() {
    $("rackOverview").innerHTML = [1, 2, 3].map(rack => {
      const servers = state.servers.filter(s => s.rack === rack);
      const online = servers.filter(s => s.status === "online").length;
      return `<div class="rack-row"><div class="rack-label">RACK 0${rack}</div><div class="rack-units">${servers.map(s => `<span class="rack-unit ${s.status !== "online" ? "warning" : ""}" title="${s.id} · ${s.status}"></span>`).join("")}</div><div class="rack-count">${online}/05</div></div>`;
    }).join("");
  }

  function renderRecentActivity() {
    const items = state.logs.slice(0, 5);
    $("recentActivity").innerHTML = items.length ? items.map(item => {
      const cls = item.level === "ALERT" ? "danger" : item.level === "WARN" ? "warning" : "";
      const symbol = item.level === "ALERT" ? "◈" : item.level === "WARN" ? "!" : "•";
      return `<div class="activity-item"><div class="activity-mark ${cls}">${symbol}</div><div class="activity-copy"><strong>${escapeHtml(item.event)}</strong><small>${escapeHtml(item.detail)}</small></div><span class="activity-time">${new Date(item.time).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"})}</span></div>`;
    }).join("") : `<div class="incident-empty">No recent activity.</div>`;
  }

  function renderServices() {
    const map = [["Identity & Access", "AUTH"], ["Database Cluster", "DATABASE"], ["Web Services", "WEB"], ["File Storage", "STORAGE"]];
    const bad = (n) => state.servers.some(s => s.name === n && s.status !== "online");
    $("serviceGrid").innerHTML = map.map(([label, n]) => `<div class="service-item"><span class="service-indicator" style="background:${bad(n) ? "var(--amber)" : "var(--green)"}"></span><strong>${label}</strong><small>${bad(n) ? "Degraded" : "Operational"}</small></div>`).join("");
    const down = state.servers.filter(s => s.status !== "online").length;
    $("serviceStatusPill").className = `status-pill ${down ? "warning" : "success"}`;
    $("serviceStatusPill").textContent = down ? `${down} SERVER${down > 1 ? "S" : ""} NEED ATTENTION` : "ALL SERVICES RUNNING";
    $("networkNote").textContent = down ? `${down} server(s) need attention` : "All systems operational";
  }

  function renderOverview() {
    renderMetrics(); renderRackOverview(); renderRecentActivity(); renderServices();
  }

  function renderServers() {
    const filter = state.serverFilter;
    $("serverFilters").querySelectorAll(".filter-tab").forEach(b => b.classList.toggle("active", b.dataset.filter === filter));
    $("serverRacks").innerHTML = [1,2,3].map(rack => {
      const servers = state.servers.filter(s => s.rack === rack && (filter === "all" || (filter === "online" ? s.status === "online" : s.status !== "online")));
      if (!servers.length) return "";
      return `<article class="server-rack"><div class="rack-title"><strong>RACK 0${rack}</strong><small>${servers.length} UNITS DISPLAYED</small></div><div class="rack-frame">${servers.map(s => `<button class="server-unit ${s.status !== "online" ? "warning" : ""} ${state.selectedServer === s.id ? "selected" : ""}" data-server="${s.id}"><span class="server-led"></span><span class="server-unit-info"><strong>${s.id} · ${s.name}</strong><small>${s.route === ROUTES[0].id ? "Primary Fiber" : ROUTES.find(r=>r.id===s.route)?.name || "Network route"}</small></span><span class="server-unit-state">${s.status === "online" ? "ONLINE" : "ATTENTION"}</span></button>`).join("")}</div></article>`;
    }).join("") || `<div class="incident-empty">No servers match this filter.</div>`;
    $("serverRacks").querySelectorAll("[data-server]").forEach(btn => btn.addEventListener("click", () => selectServer(btn.dataset.server)));
    renderServerDetails();
  }

  function selectServer(id) {
    state.selectedServer = id; save(); renderServers();
  }

  function renderServerDetails() {
    const s = serverById(state.selectedServer);
    if (!s) {
      $("selectedServerHint").textContent = "เลือกเครื่องแม่ข่ายเพื่อดูรายละเอียด";
      $("selectedServerStatus").textContent = "NO SELECTION";
      $("selectedServerStatus").className = "status-pill neutral";
      $("serverDetails").className = "server-details empty-state";
      $("serverDetails").textContent = "Select a server from the rack above.";
      return;
    }
    $("selectedServerHint").textContent = `${s.id} · Rack 0${s.rack} · ${s.name}`;
    $("selectedServerStatus").textContent = s.status === "online" ? "ONLINE" : "ATTENTION REQUIRED";
    $("selectedServerStatus").className = `status-pill ${s.status === "online" ? "success" : "warning"}`;
    $("serverDetails").className = "server-details";
    const routeName = ROUTES.find(r => r.id === s.route)?.name || "Unknown";
    $("serverDetails").innerHTML = `
      <div class="detail-cell"><small>HOSTNAME</small><strong>${s.id}-${s.name.toLowerCase()}</strong></div>
      <div class="detail-cell"><small>CPU UTILIZATION</small><strong>${s.cpu}%</strong></div>
      <div class="detail-cell"><small>MEMORY USAGE</small><strong>${s.memory}%</strong></div>
      <div class="detail-cell"><small>NETWORK ROUTE</small><strong>${routeName}</strong></div>
      <div class="detail-cell"><small>UPTIME</small><strong>${s.uptime}</strong></div>
      <div class="detail-cell"><small>LAST CHECK</small><strong>${new Date(s.lastCheck).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</strong></div>
      <div class="detail-actions"><button class="button button-quiet" id="manualRestart" ${hasOpenSpecial(s.id) ? "disabled" : ""}>↻ Restart Server</button><button class="button button-quiet" id="manualSwitch" ${hasOpenSpecial(s.id) ? "disabled" : ""}>⇄ Switch Connection</button></div>`;
    $("manualRestart")?.addEventListener("click", () => showRestartModal(s.id, null));
    $("manualSwitch")?.addEventListener("click", () => showSwitchModal(s.id, null));
  }

  function createIncident(type, server, title, detail, kind) {
    const incident = { id: state.nextIncidentId++, type, kind, serverId: server.id, title, detail, status: "open", createdAt: stamp(), resolvedAt: null, code: null, codeVerified: false, routeFrom: null, routeTo: null };
    state.incidents.unshift(incident);
    server.status = "warning";
    server.lastCheck = stamp();
    save();
    log(type === "special" ? "ALERT" : "WARN", title, `${server.id} · ${detail}`);
    playTone(type);
    renderAll();
    toast(`${title} · ${server.id}`, type === "special" ? "error" : "warning");
    return incident;
  }

  function pickOnlineServer() {
    const candidates = state.servers.filter(s => s.status === "online");
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
  }

  function generateNormalEvent() {
    const server = pickOnlineServer();
    if (!server) return;
    if (Math.random() < 0.5) {
      createIncident("normal", server, "Server requires restart", "ตรวจพบการทำงานผิดปกติ จำเป็นต้องเริ่มบริการใหม่", "restart");
    } else {
      createIncident("normal", server, "Network route unavailable", "เส้นทางการเชื่อมต่อมีปัญหา จำเป็นต้องเปลี่ยนเส้นทาง", "switch");
    }
    state.lastEventAt = Date.now(); save();
  }

  function generateSecurityEvent() {
    const server = pickOnlineServer();
    if (!server) return;
    const incident = createIncident("special", server, "Security alert detected", "ตรวจพบกิจกรรมที่ไม่ปกติ กรุณายืนยันตัวตนเพื่อปกป้องระบบ", "security");
    incident.code = String(Math.floor(100000 + Math.random() * 900000));
    state.lastEventAt = Date.now(); save();
  }

  function scheduleNormalEvent() {
    const wait = NORMAL_EVENT_MIN_MS + Math.random() * (NORMAL_EVENT_MAX_MS - NORMAL_EVENT_MIN_MS);
    eventTimer = setTimeout(() => { generateNormalEvent(); scheduleNormalEvent(); }, wait);
  }

  function resolveIncident(incident, message) {
    const server = serverById(incident.serverId);
    incident.status = "resolved";
    incident.resolvedAt = stamp();
    if (server) { server.status = "online"; server.lastCheck = stamp(); }
    log("SUCCESS", "Incident resolved", `${incident.serverId} · ${message}`);
    save(); renderAll();
    toast("Incident resolved successfully"); SFX.success();
  }

  function showModal({ symbol = "↻", eyebrow = "SERVER ACTION", title, description, body = "", actions = [] }) {
    $("modalSymbol").textContent = symbol;
    $("modalEyebrow").textContent = eyebrow;
    $("modalTitle").textContent = title;
    $("modalDescription").textContent = description;
    $("modalBody").innerHTML = body;
    $("modalActions").innerHTML = "";
    actions.forEach(a => {
      const btn = document.createElement("button");
      btn.className = `button ${a.className || "button-quiet"}`;
      btn.textContent = a.label;
      btn.disabled = !!a.disabled;
      btn.addEventListener("click", a.onClick);
      $("modalActions").appendChild(btn);
    });
    $("actionModal").classList.add("open");
    SFX.open();
    $("actionModal").setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    if ($("actionModal").classList.contains("open")) SFX.close();
    $("actionModal").classList.remove("open");
    $("actionModal").setAttribute("aria-hidden", "true");
    currentModalAction = null;
    keypadValue = "";
  }

  function showRestartModal(serverId, incidentId) {
    const server = serverById(serverId);
    if (!server) return;
    showModal({
      symbol: "↻", eyebrow: "SERVER MAINTENANCE", title: "Restart Server",
      description: `ยืนยันการเริ่มบริการใหม่ของ ${server.id} · ${server.name} เมื่อดำเนินการแล้ว สถานะเครื่องจะกลับมาออนไลน์`,
      body: `<div class="detail-cell"><small>TARGET SERVER</small><strong>${server.id} / RACK 0${server.rack}</strong></div>`,
      actions: [
        { label: "Cancel", onClick: closeModal },
        { label: "Confirm Restart", className: "button-primary", onClick: () => {
          closeModal();
          const incident = incidentId ? state.incidents.find(i => i.id === incidentId) : openNormalFor(server.id);
          if (incident) resolveIncident(incident, "Server restarted");
          else { server.status = "online"; server.lastCheck = stamp(); log("SUCCESS", "Server restarted", `${server.id} · Manual operation`); save(); renderAll(); toast(`${server.id} is online`); }
        }}
      ]
    });
  }

  function showSwitchModal(serverId, incidentId) {
    const server = serverById(serverId);
    if (!server) return;
    const options = ROUTES.filter(r => r.id !== server.route);
    showModal({
      symbol: "⇄", eyebrow: "NETWORK MANAGEMENT", title: "Switch Connection",
      description: `เลือกเส้นทางเครือข่ายใหม่สำหรับ ${server.id}`,
      body: `<div class="route-options">${options.map((r,i) => `<label class="route-option"><input type="radio" name="routeChoice" value="${r.id}" ${i===0?"checked":""}><span><strong>${r.name}</strong><small>${r.detail}</small></span></label>`).join("")}</div>`,
      actions: [
        { label: "Cancel", onClick: closeModal },
        { label: "Apply Route", className: "button-primary", onClick: () => {
          const selected = document.querySelector('input[name="routeChoice"]:checked')?.value;
          if (!selected) return;
          const oldRoute = ROUTES.find(r=>r.id===server.route)?.name || "Unknown";
          const newRoute = ROUTES.find(r=>r.id===selected)?.name || "Unknown";
          server.route = selected; server.status = "online"; server.lastCheck = stamp();
          const incident = incidentId ? state.incidents.find(i => i.id === incidentId) : openNormalFor(server.id);
          if (incident) { incident.routeFrom = oldRoute; incident.routeTo = newRoute; resolveIncident(incident, `Connection switched to ${newRoute}`); }
          else { log("SUCCESS", "Network route switched", `${server.id} · ${oldRoute} → ${newRoute}`); save(); renderAll(); toast(`Connection switched to ${newRoute}`); }
          closeModal();
        }}
      ]
    });
  }

  function showSpecialModal(incidentId) {
    const incident = state.incidents.find(i => i.id === incidentId);
    if (!incident || incident.status !== "open") return;
    keypadValue = "";
    const body = `<div class="detail-cell"><small>SECURITY TARGET</small><strong>${incident.serverId}</strong></div><p class="code-caption" style="margin-top:14px">SECURITY VERIFICATION CODE</p><div class="code-display" id="securityCodeDisplay">${incident.code}</div><p class="code-caption">กรอกรหัส 6 หลักเพื่อยืนยันการป้องกันระบบ</p><input class="code-entry" id="codeEntry" inputmode="numeric" maxlength="6" placeholder="••••••" readonly aria-label="รหัสยืนยัน"><div class="keypad" id="keypad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button type="button" data-key="${n}">${n}</button>`).join("")}<button type="button" class="key-clear" data-key="clear">ล้าง</button><button type="button" data-key="0">0</button><button type="button" class="key-back" data-key="back">⌫</button></div><div class="inline-message" id="codeMessage"></div>`;
    showModal({
      symbol: "◈", eyebrow: "SECURITY RESPONSE", title: "Defend System",
      description: `ยืนยันการป้องกันเครื่อง ${incident.serverId} ด้วยรหัสความปลอดภัย`,
      body,
      actions: [
        { label: "Close", onClick: closeModal },
        { label: "DEFEND SYSTEM", className: "button-primary", onClick: () => verifySecurityCode(incidentId) }
      ]
    });
    $("keypad").querySelectorAll("[data-key]").forEach(btn => btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      if (key === "clear") keypadValue = "";
      else if (key === "back") keypadValue = keypadValue.slice(0, -1);
      else if (keypadValue.length < 6) keypadValue += key;
      $("codeEntry").value = keypadValue;
      $("codeMessage").textContent = "";
    }));
  }

  function verifySecurityCode(incidentId) {
    const incident = state.incidents.find(i => i.id === incidentId);
    if (!incident || incident.status !== "open") return;
    if (keypadValue.length !== 6) { $("codeMessage").textContent = "กรุณากรอกรหัสให้ครบ 6 หลัก"; return; }
    if (keypadValue !== incident.code) {
      $("codeMessage").textContent = "รหัสไม่ถูกต้อง กรุณาลองอีกครั้ง"; SFX.error();
      keypadValue = ""; $("codeEntry").value = "";
      return;
    }
    incident.codeVerified = true;
    closeModal();
    resolveIncident(incident, "Security verification completed");
  }

  function renderSecurity() {
    const security = state.incidents.filter(i => i.type === "special");
    const open = security.filter(i => i.status === "open").length;
    const resolved = security.filter(i => i.status === "resolved").length;
    $("securityStats").innerHTML = `<div class="mini-stat"><small>OPEN ALERTS</small><strong>${open}</strong></div><div class="mini-stat"><small>RESOLVED ALERTS</small><strong>${resolved}</strong></div><div class="mini-stat"><small>TOTAL ALERTS</small><strong>${security.length}</strong></div>`;
    $("securityEvents").innerHTML = security.length ? security.map(i => `<div class="event-card"><div class="event-symbol">◈</div><div class="event-main"><strong>${escapeHtml(i.title)}</strong><small>${i.serverId} · ${escapeHtml(i.detail)}</small></div><span class="status-pill ${i.status === "open" ? "danger" : "success"}">${i.status === "open" ? "OPEN" : "RESOLVED"}</span>${i.status === "open" ? `<div class="event-actions"><button class="button button-primary" data-defend="${i.id}">DEFEND SYSTEM</button></div>` : ""}</div>`).join("") : `<div class="incident-empty">No security events to display.</div>`;
    $("securityEvents").querySelectorAll("[data-defend]").forEach(b => b.addEventListener("click", () => showSpecialModal(Number(b.dataset.defend))));
  }

  function renderIncidents() {
    const all = state.incidents;
    const filtered = all.filter(i => state.incidentFilter === "all" || i.status === state.incidentFilter);
    const open = all.filter(i=>i.status==="open").length;
    const resolved = all.length-open;
    $("incidentTotalLabel").textContent = `${all.length} INCIDENTS`;
    $("incidentSummary").innerHTML = `<div class="mini-stat"><small>OPEN INCIDENTS</small><strong>${open}</strong></div><div class="mini-stat"><small>RESOLVED</small><strong>${resolved}</strong></div><div class="mini-stat"><small>TOTAL RECORDED</small><strong>${all.length}</strong></div>`;
    $("incidentFilters").querySelectorAll(".filter-tab").forEach(b=>b.classList.toggle("active",b.dataset.filter===state.incidentFilter));
    $("incidentList").innerHTML = filtered.length ? filtered.map(i => {
      const special = i.type === "special";
      const action = i.status !== "open" ? "" : special ? `<button class="button button-primary" data-defend="${i.id}">DEFEND SYSTEM</button>` : kindOf(i) === "restart" ? `<button class="button button-quiet" data-restart="${i.id}">Restart Server</button>` : `<button class="button button-quiet" data-switch="${i.id}">Switch Connection</button>`;
      return `<div class="incident-card ${special?"security":""} ${i.status==="resolved"?"resolved":""}"><div class="event-symbol">${special?"◈":"!"}</div><div class="event-main"><strong>${escapeHtml(i.title)}</strong><small>${i.serverId} · ${escapeHtml(i.detail)} · ${new Date(i.createdAt).toLocaleString("th-TH")}</small></div><span class="status-pill ${i.status==="open"?(special?"danger":"warning"):"success"}">${i.status==="open"?"OPEN":"RESOLVED"}</span>${action ? `<div class="event-actions">${action}</div>` : ""}</div>`;
    }).join("") : `<div class="incident-empty">No incidents found.</div>`;
    $("incidentList").querySelectorAll("[data-defend]").forEach(b=>b.addEventListener("click",()=>showSpecialModal(Number(b.dataset.defend))));
    $("incidentList").querySelectorAll("[data-restart]").forEach(b=>b.addEventListener("click",()=>{const i=state.incidents.find(x=>x.id===Number(b.dataset.restart));showRestartModal(i.serverId,i.id)}));
    $("incidentList").querySelectorAll("[data-switch]").forEach(b=>b.addEventListener("click",()=>{const i=state.incidents.find(x=>x.id===Number(b.dataset.switch));showSwitchModal(i.serverId,i.id)}));
  }

  function renderLogs() {
    if (!$("logRows")) return;
    const q = ($("logSearch")?.value || "").toLowerCase();
    const rows = state.logs.filter(l => `${l.event} ${l.detail} ${l.level}`.toLowerCase().includes(q));
    $("logCount").textContent = `${rows.length} RECORDS`;
    $("logRows").innerHTML = rows.length ? rows.map(l=>`<tr><td>${new Date(l.time).toLocaleString("th-TH",{hour12:false})}</td><td><span class="log-level ${l.level}">${l.level}</span></td><td>${escapeHtml(l.event)}</td><td>${escapeHtml(l.detail)}</td></tr>`).join("") : `<tr><td colspan="4" class="empty-table">No matching records.</td></tr>`;
  }

  function renderAll() {
    renderOverview(); renderServers(); renderSecurity(); renderIncidents(); renderMetrics();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  }

  function exportLogs() {
    const header = "time,level,event,detail";
    const lines = state.logs.map(l => [l.time,l.level,l.event,l.detail].map(v => `"${String(v).replace(/"/g,'""')}"`).join(","));
    const blob = new Blob(["\uFEFF" + [header,...lines].join("\n")], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `opscore-logs-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast("Logs exported");
  }

  function resetData() {
    if (!confirm("ต้องการรีเซ็ตข้อมูลทั้งหมดกลับเป็นค่าเริ่มต้นหรือไม่?")) return;
    state = initialState(); save(); renderAll(); toast("System data reset");
  }

  function setup() {
    document.querySelectorAll(".nav-item[data-page]").forEach(b=>b.addEventListener("click",()=>setPage(b.dataset.page)));
    document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>setPage(b.dataset.goto)));
    $("serverFilters").querySelectorAll("[data-filter]").forEach(b=>b.addEventListener("click",()=>{state.serverFilter=b.dataset.filter;renderServers()}));
    $("incidentFilters").querySelectorAll("[data-filter]").forEach(b=>b.addEventListener("click",()=>{state.incidentFilter=b.dataset.filter;renderIncidents()}));
    $("closeModal").addEventListener("click",closeModal);
    $("actionModal").addEventListener("click",e=>{if(e.target===$("actionModal"))closeModal()});
    $("mobileMenu").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
    $("soundToggle").addEventListener("click",()=>{state.sound=!state.sound;applyAudio();$("soundToggle").style.color=state.sound?"#70b8ff":"";save();toast(state.sound?"Sound enabled":"Sound muted")});
    $("themeToggle").addEventListener("click",()=>{state.light=!state.light;document.body.classList.toggle("light-theme",state.light);save()});
    $("settingsButton").addEventListener("click",()=>showModal({symbol:"⚙",eyebrow:"PREFERENCES",title:"Console Preferences",description:"ตั้งค่าการแสดงผลและจัดการข้อมูลในเครื่องนี้",body:`<div class="route-options"><label class="route-option"><input type="checkbox" id="prefSound" ${state.sound?"checked":""}> <span><strong>Interface sounds</strong><small>เสียงแจ้งเตือนเมื่อมีเหตุการณ์</small></span></label><label class="route-option"><input type="checkbox" id="prefLight" ${state.light?"checked":""}> <span><strong>Light appearance</strong><small>เปลี่ยนรูปแบบสีหน้าจอ</small></span></label><label class="route-option"><input type="checkbox" id="prefAmbient" ${state.ambient?"checked":""}> <span><strong>Ambient server room</strong><small>เสียงพัดลม เสียงติ๊ก และบี๊บพื้นหลัง</small></span></label><label class="route-option"><input type="checkbox" id="prefUi" ${state.uiSounds?"checked":""}> <span><strong>Click sounds</strong><small>เสียงเมื่อกดปุ่มและเมนู</small></span></label><label class="route-option"><span style="flex:1"><strong>Volume</strong><input type="range" id="prefVolume" min="0" max="100" value="${Math.round(state.volume*100)}" style="width:100%"></span></label></div>`,actions:[{label:"Reset Data",className:"button-danger",onClick:()=>{closeModal();resetData()}},{label:"Save Preferences",className:"button-primary",onClick:()=>{state.sound=$("prefSound").checked;state.ambient=$("prefAmbient").checked;state.uiSounds=$("prefUi").checked;state.volume=$("prefVolume").value/100;applyAudio();state.light=$("prefLight").checked;document.body.classList.toggle("light-theme",state.light);$("soundToggle").style.color=state.sound?"#70b8ff":"";save();closeModal();toast("Preferences saved")}}]}));
    $("logSearch").addEventListener("input",renderLogs);
    $("exportLogs").addEventListener("click",exportLogs);
    $("refreshOverview").addEventListener("click",()=>{renderAll();toast("Overview refreshed")});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
    document.body.classList.toggle("light-theme",state.light);
    $("soundToggle").style.color=state.sound?"#70b8ff":"";
    document.addEventListener("click",e=>{const t=e.target.closest("button,.route-option,.filter-tab");if(!t)return;if(t.dataset.key)SFX.key(t.dataset.key);else SFX.click()});
    applyAudio();
    renderClock(); setInterval(renderClock,1000);
    renderAll();
    // Two independent timers: general problems every 15-30 s (random), security attacks every 60 s.
    scheduleNormalEvent();
    securityTimer = setInterval(generateSecurityEvent, SECURITY_EVENT_INTERVAL_MS);
  }

  setup();
})();