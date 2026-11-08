(() => {
  "use strict";
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const STORAGE_KEY = "itoc_simulation_v1";
  const RACKS = 3, PER_RACK = 5;
  const state = {
    servers: [], incidents: [], logs: [], selectedServer: null, selectedIncident: null,
    sound: false, animations: true, incidentFilter: "all", pendingAction: null,
    networkRoutes: ["Primary Fiber", "Secondary Fiber", "Backup Wireless"]
  };

  const now = () => new Date();
  const stamp = (d=now()) => d.toLocaleString("th-TH", {dateStyle:"short",timeStyle:"medium"});
  const timeOnly = () => now().toLocaleTimeString("th-TH", {hour12:false});
  const id = () => Math.random().toString(36).slice(2,9).toUpperCase();
  const esc = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const statusText = s => s === "online" ? "ONLINE" : s === "warning" ? "WARNING" : "OFFLINE";

  function initData(){
    const saved = localStorage.getItem(STORAGE_KEY);
    if(saved){
      try {
        const parsed = JSON.parse(saved);
        if(parsed.servers?.length === RACKS*PER_RACK){
          state.servers = parsed.servers;
          state.incidents = parsed.incidents || [];
          state.logs = parsed.logs || [];
          return;
        }
      } catch(e) {}
    }
    for(let r=1;r<=RACKS;r++) for(let n=1;n<=PER_RACK;n++){
      state.servers.push({id:`R${r}-S${String(n).padStart(2,"0")}`,rack:r,name:`Server ${String(n).padStart(2,"0")}`,status:"online",power:"ON",network:"Primary Fiber",service:"Running",lastAction:"เริ่มต้นระบบ"});
    }
    addLog("SYSTEM","เริ่มต้น IT Operations Center ในโหมด Simulation");
    save();
  }
  function save(){ localStorage.setItem(STORAGE_KEY,JSON.stringify({servers:state.servers,incidents:state.incidents,logs:state.logs.slice(0,250)})); }
  function addLog(type,message){state.logs.unshift({time:stamp(),type,message});state.logs=state.logs.slice(0,250);save();}
  function toast(message,error=false){const el=document.createElement("div");el.className="toast"+(error?" error":"");el.textContent=message;$("#toastContainer").append(el);setTimeout(()=>el.remove(),3200);}
  function beep(freq=650,duration=.08){if(!state.sound)return;try{const C=window.AudioContext||window.webkitAudioContext;const ctx=new C();const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=freq;gain.gain.value=.035;osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+duration);osc.onended=()=>ctx.close();}catch(e){}}
  function getServer(serverId){return state.servers.find(s=>s.id===serverId);}
  function activeIncidents(){return state.incidents.filter(i=>i.status==="active");}
  function updateStats(){
    $("#totalServers").textContent=state.servers.length;
    $("#onlineServers").textContent=state.servers.filter(s=>s.status==="online").length;
    $("#activeIncidents").textContent=activeIncidents().length;
    $("#resolvedIncidents").textContent=state.incidents.filter(i=>i.status==="resolved").length;
    $("#securityNavDot").classList.toggle("show",activeIncidents().length>0);
  }
  function renderOverview(){
    $("#rackOverview").innerHTML=Array.from({length:RACKS},(_,i)=>{
      const servers=state.servers.filter(s=>s.rack===i+1);
      return `<div class="rack-mini"><b>RACK 0${i+1}</b><div class="led-row">${servers.map(s=>`<span class="led ${s.status}" title="${s.id}: ${statusText(s.status)}"></span>`).join("")}</div><small>${servers.filter(s=>s.status==="online").length}/5 ONLINE</small></div>`;
    }).join("");
    $("#recentActivity").innerHTML=state.logs.slice(0,5).map(l=>`<div class="activity-item"><span class="activity-dot"></span><div><b>${esc(l.message)}</b><small>${esc(l.time)} · ${esc(l.type)}</small></div></div>`).join("") || `<div class="empty-row">ยังไม่มีรายการกิจกรรม</div>`;
  }
  function renderServers(){
    $("#rackList").innerHTML=Array.from({length:RACKS},(_,i)=>{
      const list=state.servers.filter(s=>s.rack===i+1);
      return `<div class="rack-block"><div class="rack-title"><span>▤ RACK 0${i+1}</span><small>${list.filter(s=>s.status==="online").length}/5 ONLINE</small></div><div class="server-list">${list.map(s=>`<button class="server-select ${state.selectedServer===s.id?"selected":""}" data-server="${s.id}"><span class="led ${s.status}"></span><span>${s.id}</span><small>${statusText(s.status)}</small></button>`).join("")}</div></div>`;
    }).join("");
    $$(".server-select").forEach(btn=>btn.addEventListener("click",()=>{state.selectedServer=btn.dataset.server;renderServers();renderServerDetails();}));
    renderServerDetails();
  }
  function renderServerDetails(){
    const s=getServer(state.selectedServer), box=$("#serverDetails");
    if(!s){box.innerHTML=`<div class="empty-state"><div class="empty-icon">▤</div><h3>ยังไม่ได้เลือก Server</h3><p>เลือก Server จาก Rack ทางด้านซ้ายเพื่อดูรายละเอียดและเครื่องมือจัดการ</p></div>`;return;}
    box.innerHTML=`<div class="detail-head"><div><div class="eyebrow">SERVER DETAILS</div><h2>${s.id}</h2><p>Rack 0${s.rack} · ${s.name}</p></div><span class="status-tag ${s.status}">${statusText(s.status)}</span></div>
      <div class="detail-metrics"><div class="metric"><small>POWER</small><b>${s.power}</b></div><div class="metric"><small>NETWORK</small><b>${esc(s.network)}</b></div><div class="metric"><small>SERVICE</small><b>${s.service}</b></div></div>
      <div class="section-label">SERVER ACTIONS</div><div class="action-grid">
      <button class="action-card" id="restartServer"><span class="action-icon">↻</span><b>Restart Server</b><small>จำลองการเริ่มต้น Server ใหม่ เมื่อเครื่องค้างหรือทำงานผิดปกติ</small></button>
      <button class="action-card" id="switchNetwork"><span class="action-icon">⇄</span><b>Switch Connection</b><small>สลับไปยังเส้นทางเครือข่ายสำรองในระบบจำลอง</small></button></div>
      <div class="section-label">LAST ACTIVITY</div><div class="network-current">${esc(s.lastAction)}</div>
      <p class="hint">คำสั่งทั้งหมดเปลี่ยนเฉพาะสถานะจำลองในหน้าเว็บนี้เท่านั้น</p>`;
    $("#restartServer").addEventListener("click",()=>confirmAction("Restart Server",`ต้องการจำลองการ Restart ${s.id} หรือไม่?`,()=>restartServer(s.id)));
    $("#switchNetwork").addEventListener("click",()=>switchNetwork(s.id));
  }
  function restartServer(serverId){
    const s=getServer(serverId);if(!s)return;
    s.status="warning";s.service="Restarting";s.lastAction="กำลัง Restart";
    addLog("SERVER",`${serverId}: เริ่มกระบวนการ Restart (Simulation)`);
    renderAll();toast(`กำลัง Restart ${serverId}...`);beep(520);
    setTimeout(()=>{
      s.status="online";s.power="ON";s.service="Running";s.lastAction=`Restart สำเร็จ · ${timeOnly()}`;
      addLog("SERVER",`${serverId}: Restart สำเร็จ สถานะกลับมา ONLINE`);
      renderAll();toast(`${serverId} กลับมา ONLINE แล้ว`);beep(780);
    },1800);
  }
  function switchNetwork(serverId){
    const s=getServer(serverId);if(!s)return;
    const choices=state.networkRoutes.filter(x=>x!==s.network);
    const next=choices[(Math.random()*choices.length)|0];
    confirmAction("Switch Connection",`ต้องการสลับ ${serverId} จาก "${s.network}" ไปยัง "${next}" หรือไม่?`,()=>{
      const previous=s.network;s.network=next;s.status="online";s.lastAction=`สลับเส้นทาง ${previous} → ${next}`;
      addLog("NETWORK",`${serverId}: สลับเส้นทางเชื่อมต่อจาก ${previous} เป็น ${next}`);
      renderAll();toast(`สลับไปยัง ${next} เรียบร้อย`);beep(720);
    });
  }
  function createIncident(){
    const candidates=state.servers.filter(s=>!activeIncidents().some(i=>i.serverId===s.id));
    if(!candidates.length){addLog("SECURITY","ตรวจพบรอบเหตุการณ์ใหม่ แต่ทุก Server มีเหตุการณ์ที่กำลังดำเนินการอยู่");return;}
    const server=candidates[(Math.random()*candidates.length)|0];
    const types=["Suspicious Activity","Unusual Traffic","Access Anomaly","Service Integrity Alert"];
    const incident={id:`INC-${id()}`,serverId:server.id,rack:server.rack,type:types[(Math.random()*types.length)|0],status:"active",created:stamp(),resolved:null,code:String(Math.floor(100000+Math.random()*900000)),attempts:0};
    state.incidents.unshift(incident);server.status="warning";server.service="Security Alert";server.lastAction="ตรวจพบเหตุการณ์ความปลอดภัยจำลอง";
    addLog("SECURITY",`ตรวจพบ ${incident.type} ที่ ${server.id} · ${incident.id}`);
    state.selectedIncident=incident.id;renderAll();toast(`ตรวจพบเหตุการณ์จำลองที่ ${server.id}`);beep(880,.13);
  }
  function renderSecurity(){
    const incidents=activeIncidents();
    $("#securityIncidentList").innerHTML=incidents.length?incidents.map(i=>`<button class="incident-card ${state.selectedIncident===i.id?"selected":""}" data-incident="${i.id}"><div class="incident-card-top"><b>${esc(i.type)}</b><span class="severity">● ALERT</span></div><p>${i.serverId} · Rack 0${i.rack}</p><small>${i.id} · ${esc(i.created)}</small></button>`).join(""):`<div class="empty-state compact"><div class="empty-icon">✓</div><h3>ไม่พบเหตุการณ์ที่กำลังดำเนินการ</h3><p>ระบบกำลังเฝ้าระวังและจะสร้างเหตุการณ์จำลองตามรอบเวลา</p></div>`;
    $$(".incident-card").forEach(btn=>btn.addEventListener("click",()=>{state.selectedIncident=btn.dataset.incident;renderSecurity();}));
    renderDefense();
  }
  function renderDefense(){
    const i=state.incidents.find(x=>x.id===state.selectedIncident&&x.status==="active");
    const box=$("#defenseConsole");
    if(!i){box.innerHTML=`<div class="empty-state compact"><div class="empty-icon">⌑</div><h3>พร้อมปฏิบัติงาน</h3><p>เมื่อมีเหตุการณ์ ให้เลือกเหตุการณ์ทางด้านซ้ายแล้วกด DEFEND SYSTEM</p></div>`;return;}
    box.innerHTML=`<div class="incident-card"><div class="incident-card-top"><b>${esc(i.type)}</b><span class="severity">ALERT</span></div><p>Target: ${i.serverId} · ${i.id}</p><small>ตรวจพบเมื่อ ${esc(i.created)}</small></div>
      <button class="primary-btn defend-btn" id="startDefense">⬡ &nbsp; DEFEND SYSTEM</button>
      <p class="hint">ระบบจะสร้างรหัสยืนยันสำหรับ Simulation และให้กรอกผ่านแป้นตัวเลขเสมือน</p>`;
    $("#startDefense").addEventListener("click",()=>showKeypad(i.id));
  }
  function showKeypad(incidentId){
    const i=state.incidents.find(x=>x.id===incidentId&&x.status==="active");if(!i)return;
    let entry="";
    const box=$("#defenseConsole");
    box.innerHTML=`<div class="eyebrow">SIMULATED ACCESS VERIFICATION</div><div class="code-box"><small>รหัสยืนยันสำหรับการจำลอง</small><div class="code-value">${i.code}</div></div>
      <div class="code-entry" id="codeEntry">______</div>
      <div class="keypad">${["1","2","3","4","5","6","7","8","9","C","0","⌫"].map(k=>`<button class="key ${k==="C"||k==="⌫"?"utility":""}" data-key="${k}">${k}</button>`).join("")}</div>
      <button class="primary-btn defend-btn" id="verifyCode">VERIFY ACCESS</button><p class="hint">กดตัวเลขบนแป้นเพื่อกรอกรหัส · หากไม่ถูกต้องสามารถลองใหม่ได้โดยไม่มีบทลงโทษ</p>`;
    const display=()=>{$("#codeEntry").textContent=entry.padEnd(6,"_").split("").join(" ");};
    $$(".key",box).forEach(btn=>btn.addEventListener("click",()=>{
      const key=btn.dataset.key;beep(480,.04);
      if(key==="C")entry="";else if(key==="⌫")entry=entry.slice(0,-1);else if(entry.length<6)entry+=key;
      display();
    }));
    $("#verifyCode").addEventListener("click",()=>{
      if(entry.length!==6){toast("กรุณากรอกรหัสให้ครบ 6 หลัก",true);beep(220);return;}
      if(entry!==i.code){i.attempts++;toast("รหัสไม่ถูกต้อง สามารถลองใหม่ได้",true);beep(220);entry="";display();return;}
      resolveIncident(i);
    });
  }
  function resolveIncident(i){
    i.status="resolved";i.resolved=stamp();
    const s=getServer(i.serverId);if(s){s.status="online";s.service="Running";s.lastAction="Security defense simulation completed";}
    addLog("SECURITY",`${i.id}: ยืนยันรหัสสำเร็จ ระบบป้องกันจำลองทำงานแล้ว (${i.serverId})`);
    state.selectedIncident=null;renderAll();toast("ป้องกันเหตุการณ์จำลองสำเร็จ");beep(900,.16);
  }
  function renderIncidents(){
    const list=state.incidents.filter(i=>state.incidentFilter==="all"||i.status===state.incidentFilter);
    $("#incidentTable").innerHTML=`<div class="table-wrap"><table><thead><tr><th>INCIDENT ID</th><th>ประเภท</th><th>TARGET</th><th>เวลา</th><th>สถานะ</th></tr></thead><tbody>${list.length?list.map(i=>`<tr><td>${esc(i.id)}</td><td>${esc(i.type)}</td><td>${i.serverId}</td><td>${esc(i.created)}<small>${i.resolved?"Resolved: "+esc(i.resolved):"ยังไม่ปิดเหตุการณ์"}</small></td><td><span class="status-tag ${i.status==="resolved"?"":"warning"}">${i.status==="resolved"?"RESOLVED":"ACTIVE"}</span></td></tr>`).join(""):`<tr><td colspan="5" class="empty-row">ไม่พบเหตุการณ์ในหมวดนี้</td></tr>`}</tbody></table></div>`;
  }
  function renderLogs(){
    $("#logCount").textContent=`${state.logs.length} RECORDS`;
    $("#logList").innerHTML=state.logs.length?state.logs.map(l=>`<div class="log-entry"><span class="log-time">${esc(l.time)}</span><span class="log-type">${esc(l.type)}</span><p>${esc(l.message)}</p></div>`).join(""):`<div class="empty-row">ยังไม่มี Logs</div>`;
  }
  function renderAll(){updateStats();renderOverview();renderServers();renderSecurity();renderIncidents();renderLogs();}
  function confirmAction(title,message,action){
    $("#modalTitle").textContent=title;$("#modalMessage").textContent=message;state.pendingAction=action;$("#confirmModal").classList.add("show");
  }
  $("#modalCancel").addEventListener("click",()=>{$("#confirmModal").classList.remove("show");state.pendingAction=null;});
  $("#modalConfirm").addEventListener("click",()=>{const action=state.pendingAction;$("#confirmModal").classList.remove("show");state.pendingAction=null;if(action)action();});
  function navigate(page){
    $$(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${page}`));
    $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
    const names={overview:"ภาพรวมระบบ",servers:"ห้อง Server",security:"ศูนย์ความปลอดภัย",incidents:"จัดการเหตุการณ์",logs:"System Logs"};
    $("#pageName").textContent=names[page]||"Operations";
    $("#sidebar").classList.remove("open");
  }
  $$(".nav-item").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
  $$("[data-goto]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.goto)));
  $$(".filter-btn").forEach(b=>b.addEventListener("click",()=>{state.incidentFilter=b.dataset.filter;$$(".filter-btn").forEach(x=>x.classList.toggle("active",x===b));renderIncidents();}));
  $("#mobileMenu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  $("#soundToggle").addEventListener("click",()=>{state.sound=!state.sound;$("#soundToggle").classList.toggle("active",state.sound);$("#soundToggle").innerHTML=state.sound?"♫ <span>เสียง: เปิด</span>":"♫ <span>เสียง</span>";toast(state.sound?"เปิดเสียงแล้ว":"ปิดเสียงแล้ว");beep();});
  $("#animationToggle").addEventListener("click",()=>{state.animations=!state.animations;document.body.classList.toggle("reduced-motion",!state.animations);$("#animationToggle").innerHTML=state.animations?"✧ <span>เอฟเฟกต์: เปิด</span>":"✧ <span>เอฟเฟกต์: ปิด</span>";toast(state.animations?"เปิด Animation แล้ว":"ปิด Animation แล้ว");});
  $("#clearLogs").addEventListener("click",()=>confirmAction("ล้างประวัติ Logs","ต้องการลบประวัติ System Logs ทั้งหมดหรือไม่? การลบนี้ไม่กระทบสถานะ Server และเหตุการณ์",()=>{state.logs=[];save();renderLogs();renderOverview();toast("ล้างประวัติ Logs แล้ว");}));
  $("#clock").textContent=timeOnly();setInterval(()=>$("#clock").textContent=timeOnly(),1000);
  initData();renderAll();
  // One simulated security incident is generated every 60 seconds.
  setInterval(createIncident,60000);
})();