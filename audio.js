(() => {
  "use strict";
  // Synthesized sound engine (Web Audio). No audio files needed.
  const AC = window.AudioContext || window.webkitAudioContext;
  const cfg = { on: true, vol: 0.6, amb: true, ui: true };
  let ctx, master, ambBus, uiBus, ambNodes = null, ambTimers = [], unlocked = false;

  function ensure() {
    if (!AC) return false;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain(); master.connect(ctx.destination);
      ambBus = ctx.createGain(); ambBus.connect(master);
      uiBus = ctx.createGain(); uiBus.connect(master);
      apply();
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  function apply() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(cfg.on ? cfg.vol : 0, t, 0.05);
    uiBus.gain.setTargetAtTime(cfg.ui ? 1 : 0, t, 0.02);
    refreshAmbient();
  }

  function tone(freq, dur, type, vol, bus, delay = 0, slideTo = null) {
    if (!cfg.on || !ensure()) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || uiBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noiseBuffer(brown) {
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  function tick() {
    if (!ambNodes) return;
    const t = ctx.currentTime, src = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = ambNodes.white; hp.type = "highpass"; hp.frequency.value = 2500 + Math.random() * 3000;
    g.gain.setValueAtTime(0.05 + Math.random() * 0.04, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    src.connect(hp); hp.connect(g); g.connect(ambBus);
    src.start(t, Math.random()); src.stop(t + 0.03);
  }

  function blips() {
    const notes = [880, 1046, 1318, 1568, 1760], n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) tone(notes[Math.floor(Math.random() * notes.length)], 0.07, "sine", 0.035, ambBus, i * 0.11);
  }

  function schedule(fn, min, max) {
    const step = () => {
      if (!ambNodes) return;
      fn();
      ambTimers.push(setTimeout(step, min + Math.random() * (max - min)));
    };
    ambTimers.push(setTimeout(step, min + Math.random() * (max - min)));
  }

  function startAmbient() {
    if (ambNodes || !ensure()) return;
    const white = noiseBuffer(false), fan = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), fg = ctx.createGain();
    fan.buffer = noiseBuffer(true); fan.loop = true;
    lp.type = "lowpass"; lp.frequency.value = 380; fg.gain.value = 0.22;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.15; lg.gain.value = 60; lfo.connect(lg); lg.connect(lp.frequency);
    const hum = ctx.createOscillator(), hum2 = ctx.createOscillator(), hg = ctx.createGain();
    hum.frequency.value = 55; hum2.frequency.value = 110; hg.gain.value = 0.02;
    fan.connect(lp); lp.connect(fg); fg.connect(ambBus);
    hum.connect(hg); hum2.connect(hg); hg.connect(ambBus);
    [fan, lfo, hum, hum2].forEach(n => n.start());
    ambNodes = { white, stop: () => [fan, lfo, hum, hum2].forEach(n => { try { n.stop(); } catch (_) {} }) };
    schedule(tick, 350, 2200);
    schedule(blips, 6000, 14000);
  }

  function stopAmbient() {
    ambTimers.forEach(clearTimeout); ambTimers = [];
    if (ambNodes) { ambNodes.stop(); ambNodes = null; }
  }

  function refreshAmbient() {
    if (cfg.on && cfg.amb && unlocked && !document.hidden) startAmbient(); else stopAmbient();
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true; ensure(); refreshAmbient();
  }
  ["pointerdown", "keydown", "touchstart"].forEach(ev => document.addEventListener(ev, unlock, { once: true, passive: true }));
  document.addEventListener("visibilitychange", () => {
    refreshAmbient();
    if (ctx) { if (document.hidden) ctx.suspend(); else ctx.resume(); }
  });

  window.SFX = {
    configure(o) { Object.assign(cfg, o); apply(); },
    click() { tone(1500, 0.035, "square", 0.04); tone(300, 0.05, "sine", 0.05); },
    key(n) { tone(650 + (Number(n) || 0) * 55, 0.05, "triangle", 0.07); },
    open() { tone(480, 0.14, "sine", 0.07, uiBus, 0, 920); },
    close() { tone(920, 0.12, "sine", 0.06, uiBus, 0, 480); },
    success() { tone(660, 0.12, "sine", 0.09); tone(990, 0.2, "sine", 0.09, uiBus, 0.12); },
    error() { tone(150, 0.25, "sawtooth", 0.08); },
    alert(kind) {
      if (kind === "special") {
        // Security siren: always audible, even if UI sounds are off
        for (let i = 0; i < 3; i++) {
          tone(620, 0.3, "sawtooth", 0.07, master, i * 0.6, 1150);
          tone(1150, 0.3, "sawtooth", 0.07, master, i * 0.6 + 0.3, 620);
        }
      } else {
        tone(880, 0.1, "square", 0.05, master); tone(880, 0.1, "square", 0.05, master, 0.18);
      }
    }
  };
})();
