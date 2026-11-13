/* ==================================================================
   Personal details
================================================================== */
const SITE = {
  email: "lassmara1906@gmail.com"
};

(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const TAU = Math.PI * 2;

  /* ----------------------------------------------------------------
     Colors for the canvases, read from the CSS tokens
  ---------------------------------------------------------------- */
  const COL = {};
  function refreshColors() {
    const cs = getComputedStyle(root), g = (n) => cs.getPropertyValue(n).trim();
    COL.ink = g("--ink"); COL.paper = g("--paper"); COL.card = g("--card"); COL.muted = g("--muted");
    COL.rule = g("--rule-strong"); COL.signal = g("--signal"); COL.soft = g("--signal-soft"); COL.pen = g("--pen-red");
    COL.dark = root.getAttribute("data-theme") === "dark";
  }
  const hex = (h) => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const c = hex(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`; };
  const mmPx = () => parseFloat(getComputedStyle(root).getPropertyValue("--mm")) || 6;

  function fit(cv) {
    const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return { w, h, dpr };
  }

  /* ----------------------------------------------------------------
     Theme
  ---------------------------------------------------------------- */
  const themeBtn = $("#themeBtn"), themeColor = document.querySelector('meta[name="theme-color"]');
  const modules = [];
  function setTheme(t) {
    root.setAttribute("data-theme", t);
    themeBtn.setAttribute("aria-pressed", String(t === "dark"));
    if (themeColor) themeColor.content = t === "dark" ? "#170F18" : "#FFF3F0";
    try { localStorage.setItem("theme", t); } catch (e) {}
    refreshColors();
    modules.forEach((m) => m.redraw && m.redraw());
  }
  themeBtn.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    if (!document.startViewTransition || RM) { setTheme(next); return; }
    const r = themeBtn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = document.startViewTransition(() => setTheme(next));
    vt.ready.then(() => root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rad}px at ${x}px ${y}px)`] },
      { duration: 700, easing: "cubic-bezier(.3,.7,.2,1)", pseudoElement: "::view-transition-new(root)" }
    )).catch(() => {});
  });
  refreshColors();
  setTheme(root.getAttribute("data-theme") || "light");

  /* ----------------------------------------------------------------
     ECG waveform model: every wave is a Gaussian, times in seconds from the R peak
  ---------------------------------------------------------------- */
  const gs = (t, c, s, a) => a * Math.exp(-0.5 * ((t - c) / s) ** 2);
  const normalBeat = (d) => gs(d, -0.2, 0.036, 0.13) + gs(d, -0.038, 0.011, -0.13) + gs(d, 0, 0.0125, 1) + gs(d, 0.034, 0.013, -0.24) + gs(d, 0.27, 0.07, 0.3);
  // A PVC: no P wave, a wide bizarre QRS, and a T wave pointing the other way
  const pvcBeat = (d) => gs(d, -0.03, 0.035, 0.18) + gs(d, 0.02, 0.045, 1.15) + gs(d, 0.12, 0.05, -0.4) + gs(d, 0.33, 0.095, -0.38);
  function ecgAt(beats, t) {
    let v = 0;
    for (const b of beats) { const d = t - b.t; if (d < -0.35 || d > 0.7) continue; v += b.pvc ? pvcBeat(d) : normalBeat(d); }
    return v + 0.015 * Math.sin(TAU * t * 0.22) + 0.004 * (Math.sin(t * 37.1) + Math.sin(t * 91.7));
  }

  /* ================================================================
     Hero: an interactive map of the work.
     Projects orbit a hub; drag them around, click one to jump to it.
  ================================================================ */
  const graph = (() => {
    const cv = $("#heroGraph"), cx = cv.getContext("2d");
    let W = 1, H = 1, dpr = 1, t = 0, placed = false;
    const DATA = [
      { label: "VineNet",      tag: "vision · U-Net",  href: "#projects" },
      { label: "PVC detection", tag: "ML · signals",   href: "#work" },
      { label: "3D anatomy",   tag: "geometry",        href: "#work" },
      { label: "Chat ECG",     tag: "vision · FCN",    href: "#work" },
      { label: "SABA",         tag: "RAG · LLMs",      href: "#earlier" },
      { label: "CatVision",    tag: "vision · Flask",  href: "#earlier" },
      { label: "GreenDesk",    tag: "Flutter · APIs",  href: "#earlier" }
    ];
    const nodes = DATA.map((d, i) => ({ ...d, x: 0, y: 0, vx: 0, vy: 0, hx: 0, hy: 0, w: 0, h: 0, hot: 0, seed: Math.random() * TAU }));
    const hub = { x: 0, y: 0 };
    let ptr = null, drag = null, downAt = null, downX = 0, downY = 0;

    function layout() {
      hub.x = W * 0.5; hub.y = H * 0.52;
      const rx = Math.min(W * 0.4, 540 * dpr), ry = Math.min(H * 0.33, 215 * dpr);
      nodes.forEach((n, i) => {
        const a = -Math.PI / 2 + (i / nodes.length) * TAU;
        n.hx = hub.x + Math.cos(a) * rx; n.hy = hub.y + Math.sin(a) * ry;
        if (!placed) { n.x = n.hx; n.y = n.hy; }
      });
      placed = true;
    }
    function measure() {
      nodes.forEach((n) => {
        cx.font = `${15 * dpr}px Adventor, sans-serif`; const tw = cx.measureText(n.label).width;
        cx.font = `${11 * dpr}px Readout, monospace`; const tg = cx.measureText(n.tag).width;
        n.w = Math.max(tw, tg) + 36 * dpr; n.h = 52 * dpr;
      });
    }
    function resize() { ({ w: W, h: H, dpr } = fit(cv)); layout(); measure(); }
    const toCv = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }; };
    function at(px, py) { for (let k = nodes.length - 1; k >= 0; k--) { const n = nodes[k]; if (Math.abs(px - n.x) < n.w / 2 && Math.abs(py - n.y) < n.h / 2) return n; } return null; }
    function go(href) { const el = $(href); if (el) el.scrollIntoView({ behavior: RM ? "auto" : "smooth" }); }

    function step(dt) {
      t += dt;
      for (const n of nodes) {
        if (n === drag) { n.x += (drag.tx - n.x) * 0.4; n.y += (drag.ty - n.y) * 0.4; n.vx = n.vy = 0; }
        else {
          const dx = n.hx + Math.cos(t * 0.5 + n.seed) * 9 * dpr, dy = n.hy + Math.sin(t * 0.6 + n.seed) * 9 * dpr;
          n.vx += (dx - n.x) * 0.014; n.vy += (dy - n.y) * 0.014;
          for (const m of nodes) if (m !== n) {
            const ddx = n.x - m.x, ddy = n.y - m.y, d2 = ddx * ddx + ddy * ddy, min = (n.w + m.w) * 0.46;
            if (d2 < min * min && d2 > 1) { const d = Math.sqrt(d2), f = (min - d) / d * 0.03; n.vx += ddx * f; n.vy += ddy * f; }
          }
          if (ptr) { const ddx = n.x - ptr.x, ddy = n.y - ptr.y, d2 = ddx * ddx + ddy * ddy, R = 150 * dpr; if (d2 < R * R && d2 > 1) { const d = Math.sqrt(d2), f = (R - d) / d * 0.07; n.vx += ddx * f; n.vy += ddy * f; } }
          n.vx *= 0.85; n.vy *= 0.85; n.x += n.vx; n.y += n.vy;
        }
        const near = ptr && Math.abs(ptr.x - n.x) < n.w / 2 + 14 * dpr && Math.abs(ptr.y - n.y) < n.h / 2 + 14 * dpr;
        n.hot += ((near || n === drag ? 1 : 0) - n.hot) * 0.2;
      }
    }
    function rr(x, y, w, h, r) { cx.beginPath(); cx.roundRect(x, y, w, h, r); }
    function draw() {
      refreshColors();
      cx.clearRect(0, 0, W, H);
      cx.lineWidth = 1.2 * dpr;
      for (const n of nodes) { cx.strokeStyle = rgba(COL.ink, 0.1 + 0.3 * n.hot); cx.beginPath(); cx.moveTo(hub.x, hub.y); cx.lineTo(n.x, n.y); cx.stroke(); }
      cx.fillStyle = COL.ink; cx.beginPath(); cx.arc(hub.x, hub.y, 6.5 * dpr, 0, TAU); cx.fill();
      cx.strokeStyle = rgba(COL.ink, 0.22); cx.lineWidth = 1 * dpr; cx.beginPath(); cx.arc(hub.x, hub.y, 13 * dpr, 0, TAU); cx.stroke();
      for (const n of nodes) {
        const s = 1 + 0.05 * n.hot, w = n.w * s, h = n.h * s, x = n.x - w / 2, y = n.y - h / 2;
        cx.save(); cx.shadowColor = rgba(COL.ink, 0.1 + 0.14 * n.hot); cx.shadowBlur = (7 + 12 * n.hot) * dpr; cx.shadowOffsetY = 3 * dpr;
        cx.fillStyle = COL.card; rr(x, y, w, h, 13 * dpr); cx.fill(); cx.restore();
        cx.lineWidth = (1.5 + n.hot) * dpr; cx.strokeStyle = n.hot > 0.5 ? COL.signal : COL.ink; rr(x, y, w, h, 13 * dpr); cx.stroke();
        cx.textAlign = "left"; cx.textBaseline = "alphabetic";
        cx.fillStyle = COL.ink; cx.font = `${15 * dpr}px Adventor, sans-serif`; cx.fillText(n.label, x + 17 * dpr, y + 23 * dpr);
        cx.fillStyle = n.hot > 0.5 ? COL.signal : COL.muted; cx.font = `${11 * dpr}px Readout, monospace`; cx.fillText(n.tag, x + 17 * dpr, y + 39 * dpr);
      }
    }
    function frame(dt) { step(dt); draw(); }

    cv.addEventListener("pointermove", (e) => {
      ptr = toCv(e);
      if (drag) { drag.tx = ptr.x; drag.ty = ptr.y; }
      const probe = document.body.classList.contains("probe-on");
      cv.style.cursor = at(ptr.x, ptr.y) ? (probe ? "none" : (drag ? "grabbing" : "grab")) : (probe ? "none" : "");
    });
    cv.addEventListener("pointerleave", () => { if (!drag) ptr = null; });
    cv.addEventListener("pointerdown", (e) => {
      const p = toCv(e), n = at(p.x, p.y);
      if (!n) return;
      downAt = n; downX = e.clientX; downY = e.clientY;
      if (e.pointerType === "mouse") { drag = n; drag.tx = p.x; drag.ty = p.y; try { cv.setPointerCapture(e.pointerId); } catch (_) {} if (RM) draw(); }
    });
    cv.addEventListener("pointerup", (e) => {
      if (downAt && Math.hypot(e.clientX - downX, e.clientY - downY) < 8) go(downAt.href);
      drag = null; downAt = null; if (e.pointerType !== "mouse") ptr = null;
    });

    return { cv, resize, frame, draw, redraw: draw };
  })();
  modules.push(graph);


  /* ================================================================
     Case 1: stage 1 detection, stage 2 activation map
  ================================================================ */
  const pvcViz = (() => {
    const cv = $("#pvcViz"), cx = cv.getContext("2d");
    let W = 1, H = 1, dpr = 1;
    const beats = [0.35, 1.2, 2.05, 3.78, 4.64].map((t) => ({ t, pvc: false })).concat([{ t: 2.48, pvc: true }]);
    const TOTAL = 5.3, PVC_T = 2.48, LOOP = 8;

    function resize() { ({ w: W, h: H, dpr } = fit(cv)); }
    function blob(cxp, cyp, R, ph) {
      cx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * TAU, r = R * (1 + 0.1 * Math.sin(3 * a + 0.6) + 0.06 * Math.cos(5 * a + ph));
        const x = cxp + Math.cos(a) * r * 1.15, y = cyp + Math.sin(a) * r * 0.85;
        i ? cx.lineTo(x, y) : cx.moveTo(x, y);
      }
      cx.closePath();
    }

    function draw(time) {
      const phase = RM ? 7 : (time % LOOP);
      const scanP = clamp(phase / 3.2, 0, 1), waveP = clamp((phase - 3.5) / 3.6, 0, 1);
      cx.clearRect(0, 0, W, H);
      cx.lineJoin = "round"; cx.lineCap = "round";
      const pad = 22 * dpr, sw = W - pad * 2, stripBase = H * 0.375, g = H * 0.125;
      const xT = (t) => pad + (t / TOTAL) * sw;

      // stage 1: the strip, with a detector sweeping across it
      cx.strokeStyle = COL.ink; cx.lineWidth = 2.2 * dpr; cx.beginPath();
      for (let x = pad; x <= pad + sw; x += dpr) { const t = ((x - pad) / sw) * TOTAL, y = stripBase - ecgAt(beats, t) * g; x === pad ? cx.moveTo(x, y) : cx.lineTo(x, y); }
      cx.stroke();
      const scanX = pad + scanP * sw;
      if (scanP < 1 && !RM) {
        const grad = cx.createLinearGradient(scanX - 70 * dpr, 0, scanX, 0);
        grad.addColorStop(0, rgba(COL.signal, 0)); grad.addColorStop(1, rgba(COL.signal, 0.2));
        cx.fillStyle = grad; cx.fillRect(scanX - 70 * dpr, 30 * dpr, 70 * dpr, H * 0.36);
        cx.strokeStyle = COL.signal; cx.lineWidth = 2 * dpr; cx.beginPath(); cx.moveTo(scanX, 30 * dpr); cx.lineTo(scanX, 30 * dpr + H * 0.36); cx.stroke();
      }
      const px = xT(PVC_T), fa = RM ? 1 : clamp((scanX - px) / (50 * dpr), 0, 1);
      if (fa > 0) {
        cx.globalAlpha = fa;
        cx.fillStyle = COL.soft; cx.fillRect(px - 0.2 * sw / TOTAL, 34 * dpr, 0.78 * sw / TOTAL, H * 0.34);
        cx.strokeStyle = COL.signal; cx.lineWidth = 2 * dpr; cx.beginPath(); cx.moveTo(px - 0.2 * sw / TOTAL, 34 * dpr); cx.lineTo(px + 0.58 * sw / TOTAL, 34 * dpr); cx.stroke();
        cx.fillStyle = COL.signal; cx.font = `700 ${15 * dpr}px Adventor, sans-serif`; cx.fillText("PVC", px - 0.2 * sw / TOTAL + 6 * dpr, 54 * dpr);
        cx.font = `${12 * dpr}px Readout, monospace`; cx.fillText("detected", px - 0.2 * sw / TOTAL + 6 * dpr, 70 * dpr);
        cx.globalAlpha = 1;
      }

      // hand-off arrow
      const ay = H * 0.5; cx.globalAlpha = RM ? 1 : clamp((phase - 3.2) / 0.4, 0, 1);
      cx.strokeStyle = COL.muted; cx.lineWidth = 1.5 * dpr; cx.setLineDash([5 * dpr, 4 * dpr]);
      cx.beginPath(); cx.moveTo(px + 0.1 * sw / TOTAL, H * 0.42); cx.lineTo(px + 0.1 * sw / TOTAL, ay + 6 * dpr); cx.stroke(); cx.setLineDash([]);
      cx.beginPath(); cx.moveTo(px + 0.1 * sw / TOTAL - 5 * dpr, ay); cx.lineTo(px + 0.1 * sw / TOTAL, ay + 8 * dpr); cx.lineTo(px + 0.1 * sw / TOTAL + 5 * dpr, ay); cx.stroke();
      cx.globalAlpha = 1;

      // stage 2: activation map, wavefronts from the origin
      const mcx = W * 0.5, mcy = H * 0.77, R = Math.min(W * 0.34, H * 0.2);
      blob(mcx, mcy, R, 0.4);
      cx.fillStyle = COL.card; cx.fill();
      cx.save(); blob(mcx, mcy, R, 0.4); cx.clip();
      const ox = mcx - R * 0.42, oy = mcy + R * 0.08, maxR = R * 2.3, sp = 13 * dpr;
      const front = waveP * maxR;
      for (let r = sp; r <= front; r += sp) {
        const t = r / maxR;
        cx.strokeStyle = mix(COL.signal, COL.pen, clamp(t * 1.15, 0, 1)); cx.lineWidth = 1.6 * dpr; cx.globalAlpha = 0.9 - 0.4 * t;
        cx.beginPath(); cx.ellipse(ox, oy, r * 1.08, r * 0.82, 0.25, 0, TAU); cx.stroke();
      }
      cx.globalAlpha = 1;
      if (waveP > 0 && waveP < 1) {
        cx.strokeStyle = COL.ink; cx.lineWidth = 2.6 * dpr; cx.beginPath(); cx.ellipse(ox, oy, front * 1.08, front * 0.82, 0.25, 0, TAU); cx.stroke();
      }
      cx.restore();
      blob(mcx, mcy, R, 0.4); cx.strokeStyle = COL.ink; cx.lineWidth = 2.2 * dpr; cx.stroke();
      if (waveP > 0 || RM) {
        cx.fillStyle = COL.pen; cx.beginPath(); cx.arc(ox, oy, 5.5 * dpr, 0, TAU); cx.fill();
        cx.strokeStyle = COL.pen; cx.lineWidth = 2 * dpr; cx.beginPath(); cx.arc(ox, oy, 11 * dpr, 0, TAU); cx.stroke();
        cx.fillStyle = COL.ink; cx.font = `${13 * dpr}px Readout, monospace`; cx.fillText("origin", ox - 20 * dpr, oy - 18 * dpr);
      }
      cx.fillStyle = COL.muted; cx.font = `${12 * dpr}px Readout, monospace`;
      cx.fillText("stage 2: activation map", pad, H - 14 * dpr);
      const bw = 90 * dpr, bx = W - pad - bw, by = H - 22 * dpr;
      const gr = cx.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, COL.signal); gr.addColorStop(1, COL.pen);
      cx.fillStyle = gr; cx.fillRect(bx, by, bw, 6 * dpr);
      cx.fillStyle = COL.muted; cx.textAlign = "right"; cx.fillText("early to late", bx - 8 * dpr, H - 14 * dpr); cx.textAlign = "left";
    }
    let tm = 0;
    return { cv, resize, frame: (now) => { tm = now; draw(now); }, redraw: () => draw(tm) };
  })();
  modules.push(pvcViz);

  /* ================================================================
     Case 2: heart-like mesh with three landmark regions
  ================================================================ */
  const mesh = (() => {
    const cv = $("#meshViz"), cx = cv.getContext("2d");
    let W = 1, H = 1, dpr = 1, yaw = 0.7, pitch = 0.32, idle = 0, dragging = false, lastX = 0, time = 0;
    const NLAT = 20, NLON = 32, verts = [], edges = [];
    for (let i = 0; i <= NLAT; i++) for (let j = 0; j < NLON; j++) {
      const th = (Math.PI * i) / NLAT, ph = (TAU * j) / NLON;
      const x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
      const r = 1 + 0.13 * Math.sin(3 * ph + 2 * th) * Math.sin(th) + 0.08 * Math.cos(2 * th + ph);
      verts.push({ p: [x * r * 1.18, y * r * 0.92, z * r], u: [x, y, z] });
    }
    for (let i = 0; i <= NLAT; i++) for (let j = 0; j < NLON; j++) {
      const a = i * NLON + j;
      edges.push([a, i * NLON + ((j + 1) % NLON)]);
      if (i < NLAT) edges.push([a, (i + 1) * NLON + j]);
    }
    const norm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
    const marks = [
      { name: "mitral isthmus", u: norm([-0.62, -0.5, 0.45]), c: "signal" },
      { name: "posterior wall", u: norm([0.2, 0.15, -1]), c: "pen" },
      { name: "interatrial septum", u: norm([0.85, 0.05, 0.1]), c: "ink" }
    ];
    verts.forEach((v) => { v.m = -1; marks.forEach((m, k) => { if (v.u[0] * m.u[0] + v.u[1] * m.u[1] + v.u[2] * m.u[2] > 0.935) v.m = k; }); });

    function resize() { ({ w: W, h: H, dpr } = fit(cv)); }
    function project(p) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy;
      const y2 = p[1] * cp - z1 * sp, z2 = p[1] * sp + z1 * cp;
      const s = (3.4 / (3.4 - z2)) * Math.min(W, H) * 0.31;
      return { x: W / 2 + x1 * s, y: H * 0.5 - y2 * s, z: z2 };
    }

    function draw() {
      cx.clearRect(0, 0, W, H);
      const P = verts.map((v) => project(v.p));
      const buckets = [[], [], []];
      edges.forEach(([a, b]) => { const z = (P[a].z + P[b].z) / 2; buckets[z > 0.35 ? 2 : z > -0.35 ? 1 : 0].push([a, b]); });
      const alphas = [0.16, 0.34, 0.72];
      cx.lineWidth = 1.1 * dpr; cx.lineCap = "round";
      buckets.forEach((bk, i) => {
        cx.strokeStyle = rgba(COL.ink, alphas[i]); cx.beginPath();
        bk.forEach(([a, b]) => { cx.moveTo(P[a].x, P[a].y); cx.lineTo(P[b].x, P[b].y); });
        cx.stroke();
      });
      // surface-normal rays from landmark vertices
      const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
      verts.forEach((v, i) => {
        if (v.m < 0) return;
        const col = COL[marks[v.m].c], p = P[i], front = p.z > -0.2;
        if (i % 2 === 0) {
          const len = 0.16 + 0.12 * pulse, q = project([v.p[0] + v.u[0] * len, v.p[1] + v.u[1] * len, v.p[2] + v.u[2] * len]);
          cx.strokeStyle = rgba(col, front ? 0.55 : 0.15); cx.lineWidth = 1.2 * dpr; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); cx.stroke();
        }
        cx.fillStyle = rgba(col, front ? 0.95 : 0.3); cx.beginPath(); cx.arc(p.x, p.y, (front ? 3.1 : 2) * dpr, 0, TAU); cx.fill();
      });
      // labels
      cx.font = `${13 * dpr}px Readout, monospace`;
      marks.forEach((m) => {
        const a = project(m.u.map((c, i) => c * [1.18, 0.92, 1][i] * 1.04)), front = a.z > -0.1, col = COL[m.c];
        let dx = a.x - W / 2, dy = a.y - H / 2; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const ex = a.x + dx * 46 * dpr, ey = a.y + dy * 34 * dpr, tw = cx.measureText(m.name).width;
        cx.globalAlpha = front ? 1 : 0.35;
        cx.strokeStyle = col; cx.lineWidth = 1.5 * dpr; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(ex, ey); cx.stroke();
        let tx = dx >= 0 ? ex + 6 * dpr : ex - 6 * dpr - tw; tx = clamp(tx, 8 * dpr, W - tw - 8 * dpr);
        cx.fillStyle = COL.paper; cx.fillRect(tx - 4 * dpr, ey - 13 * dpr, tw + 8 * dpr, 20 * dpr);
        cx.fillStyle = col; cx.fillText(m.name, tx, ey + 2 * dpr);
        cx.globalAlpha = 1;
      });
    }

    function frame(now, dt) {
      time = now;
      if (!dragging && !RM) { idle += dt; if (idle > 1.2) yaw += dt * 0.28; }
      draw();
    }
    cv.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; idle = 0; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", (e) => { if (!dragging) return; yaw += (e.clientX - lastX) * 0.011; lastX = e.clientX; idle = 0; if (RM) draw(); });
    const end = () => { dragging = false; idle = 0; };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    cv.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { yaw -= 0.15; idle = 0; e.preventDefault(); if (RM) draw(); }
      if (e.key === "ArrowRight") { yaw += 0.15; idle = 0; e.preventDefault(); if (RM) draw(); }
    });
    cv.style.cursor = "grab"; cv.style.touchAction = "pan-y";
    return { cv, resize, frame, redraw: draw };
  })();
  modules.push(mesh);

  /* ================================================================
     Case 3: unwarping a photographed ECG
  ================================================================ */
  const warp = (() => {
    const cv = $("#warpViz"), cx = cv.getContext("2d");
    const range = $("#warpRange"), out = $("#warpOut");
    let W = 1, H = 1, dpr = 1, auto = !RM, k = 1;
    const beats = [0.3, 1.1, 1.9, 2.7, 3.5, 4.3].map((t) => ({ t, pvc: false }));
    const U0 = -1, U1 = 1, V0 = -0.62, V1 = 0.62;

    function w(u, v, kk) {
      const curl = kk * 0.2 * Math.sin(u * 1.9 + 0.5);
      return [u + kk * 0.1 * Math.sin(v * 3 + 1) + kk * 0.13 * v * u, v * (1 + kk * 0.2 * u) + curl + kk * 0.07 * u];
    }
    function resize() { ({ w: W, h: H, dpr } = fit(cv)); }
    const S = () => Math.min(W * 0.4, H * 0.62 * 1.55);
    const scr = (p) => [W / 2 + p[0] * S(), H / 2 + p[1] * S() * 1.02];

    function line(pts) { cx.beginPath(); pts.forEach((p, i) => { const s = scr(p); i ? cx.lineTo(s[0], s[1]) : cx.moveTo(s[0], s[1]); }); cx.stroke(); }
    function straightness(kk) {
      let sum = 0, n = 0;
      const meas = (f) => { let arc = 0, prev = null, first = null, last = null; for (let i = 0; i <= 24; i++) { const p = f(i / 24); if (prev) arc += Math.hypot(p[0] - prev[0], p[1] - prev[1]); if (!first) first = p; last = p; prev = p; } sum += Math.hypot(last[0] - first[0], last[1] - first[1]) / arc; n++; };
      for (let v = V0; v <= V1 + 1e-6; v += 0.1) meas((s) => w(U0 + (U1 - U0) * s, v, kk));
      for (let u = U0; u <= U1 + 1e-6; u += 0.1) meas((s) => w(u, V0 + (V1 - V0) * s, kk));
      return sum / n;
    }

    function draw() {
      cx.clearRect(0, 0, W, H);
      cx.fillStyle = COL.dark ? "rgba(255,255,255,.05)" : "rgba(26,20,32,.07)"; cx.fillRect(0, 0, W, H);
      const kk = k;
      // sheet outline
      const outline = []; const N = 30;
      for (let i = 0; i <= N; i++) outline.push(w(U0 + (U1 - U0) * i / N, V0, kk));
      for (let i = 0; i <= N; i++) outline.push(w(U1, V0 + (V1 - V0) * i / N, kk));
      for (let i = 0; i <= N; i++) outline.push(w(U1 - (U1 - U0) * i / N, V1, kk));
      for (let i = 0; i <= N; i++) outline.push(w(U0, V1 - (V1 - V0) * i / N, kk));
      cx.save();
      cx.shadowColor = `rgba(0,0,0,${0.28 * kk})`; cx.shadowBlur = 22 * dpr * kk; cx.shadowOffsetY = 10 * dpr * kk;
      cx.beginPath(); outline.forEach((p, i) => { const s = scr(p); i ? cx.lineTo(s[0], s[1]) : cx.moveTo(s[0], s[1]); }); cx.closePath();
      cx.fillStyle = COL.card; cx.fill(); cx.restore();
      cx.save(); cx.beginPath(); outline.forEach((p, i) => { const s = scr(p); i ? cx.lineTo(s[0], s[1]) : cx.moveTo(s[0], s[1]); }); cx.closePath(); cx.clip();
      // grid on the sheet
      const seg = (f) => { const a = []; for (let i = 0; i <= 40; i++) a.push(f(i / 40)); return a; };
      let idx = 0;
      for (let v = V0; v <= V1 + 1e-6; v += 0.1, idx++) { cx.strokeStyle = rgba(COL.pen, idx % 5 === 0 ? 0.6 : 0.28); cx.lineWidth = (idx % 5 === 0 ? 1.6 : 1) * dpr; line(seg((s) => w(U0 + (U1 - U0) * s, v, kk))); }
      idx = 0;
      for (let u = U0; u <= U1 + 1e-6; u += 0.1, idx++) { cx.strokeStyle = rgba(COL.pen, idx % 5 === 0 ? 0.6 : 0.28); cx.lineWidth = (idx % 5 === 0 ? 1.6 : 1) * dpr; line(seg((s) => w(U0 + (U1 - U0) * 0 + u, V0 + (V1 - V0) * s, kk))); }
      // the ECG trace printed on it
      cx.strokeStyle = COL.ink; cx.lineWidth = 2.2 * dpr; cx.lineJoin = "round";
      const trace = []; for (let i = 0; i <= 260; i++) { const s = i / 260, u = -0.94 + 1.88 * s; trace.push(w(u, 0.12 - 0.3 * ecgAt(beats, s * 4.8), kk)); }
      line(trace);
      cx.restore();
      // the predicted unwarping grid
      if (kk > 0.04) {
        cx.fillStyle = rgba(COL.signal, clamp(kk * 1.2, 0, 1) * 0.95);
        for (let u = -0.8; u <= 0.81; u += 0.2) for (let v = -0.5; v <= 0.51; v += 0.25) { const s = scr(w(u, v, kk)); cx.beginPath(); cx.arc(s[0], s[1], 3.2 * dpr, 0, TAU); cx.fill(); }
      }
      cx.fillStyle = COL.muted; cx.font = `${12.5 * dpr}px Readout, monospace`;
      cx.fillText(kk > 0.5 ? "phone photo, with predicted grid" : "unwarped", 14 * dpr, H - 14 * dpr);
      out.textContent = "straightness " + straightness(kk).toFixed(3);
    }

    function setFromRange() { k = 1 - range.value / 100; draw(); }
    range.addEventListener("input", () => { auto = false; setFromRange(); });
    range.addEventListener("pointerdown", () => { auto = false; });
    function frame(now) {
      if (auto) { range.value = String(50 - 50 * Math.cos((TAU * now) / 7)); k = 1 - range.value / 100; }
      draw();
    }
    return { cv, resize, frame, redraw: () => { setFromRange(); } , staticDraw: setFromRange };
  })();
  modules.push(warp);

  /* ================================================================
     Interext 1: SABA — document extraction feeding a RAG chatbot
  ================================================================ */
  const sabaViz = (() => {
    const cv = $("#sabaViz"), cx = cv.getContext("2d");
    let W = 1, H = 1, dpr = 1, tm = 0; const LOOP = 9;
    const lines = [{ w: .72, x: false }, { w: .9, x: false }, { w: .5, x: true }, { w: .84, x: false }, { w: .62, x: true }, { w: .8, x: false }, { w: .46, x: false }];
    function resize() { ({ w: W, h: H, dpr } = fit(cv)); }
    function rr(x, y, w, h, r) { cx.beginPath(); cx.roundRect(x, y, w, h, r); }
    function draw(time) {
      refreshColors();
      const phase = RM ? 8.4 : (time % LOOP);
      cx.clearRect(0, 0, W, H);
      const pad = 20 * dpr;
      const dx = pad, dy = pad + 12 * dpr, dw = W * 0.44, dh = H - dy - pad;
      cx.fillStyle = COL.card; rr(dx, dy, dw, dh, 8 * dpr); cx.fill();
      cx.strokeStyle = COL.ink; cx.lineWidth = 1.5 * dpr; rr(dx, dy, dw, dh, 8 * dpr); cx.stroke();
      cx.fillStyle = COL.muted; cx.font = `${11 * dpr}px Readout, monospace`; cx.fillText("document", dx + 14 * dpr, dy + 20 * dpr);
      const lx = dx + 18 * dpr, lw = dw - 40 * dpr, top = dy + 38 * dpr, lh = (dh - 52 * dpr) / lines.length;
      const scanY = dy + clamp(phase / 2.6, 0, 1) * (dh - 16 * dpr);
      lines.forEach((ln, i) => {
        const yy = top + i * lh + lh / 2;
        const ex = ln.x && (RM || yy < scanY);
        if (ex) { cx.fillStyle = rgba(COL.signal, 0.13); rr(lx - 7 * dpr, yy - 11 * dpr, lw * ln.w + 14 * dpr, 20 * dpr, 5 * dpr); cx.fill(); cx.fillStyle = COL.signal; cx.fillRect(lx - 7 * dpr, yy - 11 * dpr, 3 * dpr, 20 * dpr); }
        cx.fillStyle = ex ? COL.signal : rgba(COL.ink, 0.4); rr(lx, yy - 3 * dpr, lw * ln.w, 5 * dpr, 2.5 * dpr); cx.fill();
      });
      if (!RM && phase < 2.6) { cx.strokeStyle = COL.signal; cx.lineWidth = 2 * dpr; cx.beginPath(); cx.moveTo(dx + 8 * dpr, scanY); cx.lineTo(dx + dw - 8 * dpr, scanY); cx.stroke(); }
      const chx = dx + dw + pad, chw = W - chx - pad;
      if (RM || phase > 3) {
        const bw = chw * 0.9, bx = chx + (chw - bw), by = dy + 8 * dpr, bh = 44 * dpr;
        cx.fillStyle = COL.ink; rr(bx, by, bw, bh, 12 * dpr); cx.fill();
        cx.fillStyle = COL.paper; cx.font = `${13 * dpr}px 'Inter UI', sans-serif`; cx.fillText("Which clause covers refunds?", bx + 14 * dpr, by + 27 * dpr);
      }
      if (RM || phase > 5.4) {
        const bw = chw * 0.96, bx = chx, by = dy + 76 * dpr, bh = 62 * dpr;
        cx.fillStyle = COL.card; rr(bx, by, bw, bh, 12 * dpr); cx.fill(); cx.strokeStyle = COL.signal; cx.lineWidth = 1.5 * dpr; rr(bx, by, bw, bh, 12 * dpr); cx.stroke();
        const full = "Clause 4.2 — 30-day refunds.";
        const n = RM ? full.length : Math.floor(clamp((phase - 5.4) / 1.6, 0, 1) * full.length);
        cx.fillStyle = COL.ink; cx.font = `${13 * dpr}px 'Inter UI', sans-serif`; cx.fillText(full.slice(0, n), bx + 14 * dpr, by + 26 * dpr);
        cx.fillStyle = COL.muted; cx.font = `${11 * dpr}px Readout, monospace`; cx.fillText("retrieved from the document", bx + 14 * dpr, by + 46 * dpr);
      }
    }
    return { cv, resize, frame: (now) => { tm = now; draw(now); }, redraw: () => draw(tm) };
  })();
  modules.push(sabaViz);

  /* ================================================================
     Interext 2: CatVision — images extracted from PDFs, image → metadata
  ================================================================ */
  const catViz = (() => {
    const cv = $("#catViz"), cx = cv.getContext("2d");
    let W = 1, H = 1, dpr = 1, tm = 0, acc = 0, hold = 0, query = 0;
    const KINDS = ["#2340E8", "#D6455D", "#E4A11B", "#2E9E6B", "#8A4FD6"];
    const pages = [{ imgs: [0, 2], scan: true }, { imgs: [1], scan: false }, { imgs: [3, 0], scan: false }, { imgs: [2, 4], scan: true }, { imgs: [1, 3], scan: false }, { imgs: [4], scan: true }];
    const META = {
      0: { file: "catalog_03.pdf", page: "2 / 18", size: "1024×768", type: "JPEG" },
      1: { file: "catalog_07.pdf", page: "5 / 24", size: "800×600", type: "PNG" },
      2: { file: "catalog_01.pdf", page: "9 / 12", size: "1600×1200", type: "JPEG" },
      3: { file: "catalog_11.pdf", page: "3 / 20", size: "640×480", type: "WEBP" },
      4: { file: "catalog_05.pdf", page: "14 / 30", size: "1280×720", type: "PNG" }
    };
    const thumbs = [];
    function resize() { ({ w: W, h: H, dpr } = fit(cv)); }
    function rr(x, y, w, h, r) { cx.beginPath(); cx.roundRect(x, y, w, h, r); }
    function icon(x, y, w, h, kind, hot) {
      cx.globalAlpha = hot ? 1 : 0.4;
      if (hot) { cx.strokeStyle = COL.signal; cx.lineWidth = 2.5 * dpr; rr(x - 4 * dpr, y - 4 * dpr, w + 8 * dpr, h + 8 * dpr, 7 * dpr); cx.stroke(); }
      cx.fillStyle = KINDS[kind % KINDS.length]; rr(x, y, w, h, 4 * dpr); cx.fill();
      cx.save(); rr(x, y, w, h, 4 * dpr); cx.clip();
      cx.fillStyle = "rgba(255,255,255,0.92)";
      cx.beginPath(); cx.arc(x + w * 0.28, y + h * 0.32, Math.min(w, h) * 0.13, 0, TAU); cx.fill();
      cx.beginPath(); cx.moveTo(x, y + h); cx.lineTo(x + w * 0.38, y + h * 0.52); cx.lineTo(x + w * 0.58, y + h * 0.74); cx.lineTo(x + w * 0.82, y + h * 0.46); cx.lineTo(x + w, y + h); cx.closePath(); cx.fill();
      cx.restore();
      cx.strokeStyle = rgba(COL.ink, 0.5); cx.lineWidth = 1 * dpr; rr(x, y, w, h, 4 * dpr); cx.stroke();
      cx.globalAlpha = 1;
    }
    function draw() {
      refreshColors();
      cx.clearRect(0, 0, W, H);
      const pad = 18 * dpr;
      const qw = W * 0.2, qh = qw * 0.8, qx = pad, qy = pad + 46 * dpr;
      cx.fillStyle = COL.muted; cx.font = `${11 * dpr}px Readout, monospace`; cx.fillText("query image", qx, qy - 10 * dpr);
      icon(qx, qy, qw, qh, query, true);
      const mx = qx, my = qy + qh + 16 * dpr, mw = qw + 52 * dpr, m = META[query];
      cx.fillStyle = COL.card; rr(mx, my, mw, 92 * dpr, 6 * dpr); cx.fill(); cx.strokeStyle = COL.ink; cx.lineWidth = 1.2 * dpr; rr(mx, my, mw, 92 * dpr, 6 * dpr); cx.stroke();
      cx.font = `${11 * dpr}px Readout, monospace`; let yy = my + 21 * dpr;
      [["file", m.file], ["page", m.page], ["size", m.size], ["type", m.type]].forEach(([k, v]) => {
        cx.textAlign = "left"; cx.fillStyle = COL.muted; cx.fillText(k, mx + 12 * dpr, yy);
        cx.textAlign = "right"; cx.fillStyle = COL.ink; cx.fillText(v, mx + mw - 12 * dpr, yy); cx.textAlign = "left"; yy += 18 * dpr;
      });
      thumbs.length = 0;
      const gx = qx + Math.max(qw, mw) + 44 * dpr, gy = pad + 14 * dpr, gw = W - gx - pad, cols = 3, rowsN = 2;
      const cwp = gw / cols, chp = (H - gy - pad) / rowsN;
      pages.forEach((pg, i) => {
        const col = i % cols, row = (i / cols) | 0, cxp = gx + col * cwp, cyp = gy + row * chp;
        const pw = cwp - 14 * dpr, ph = chp - 16 * dpr;
        cx.fillStyle = COL.card; rr(cxp, cyp, pw, ph, 5 * dpr); cx.fill();
        cx.strokeStyle = rgba(COL.ink, 0.5); cx.lineWidth = 1 * dpr; rr(cxp, cyp, pw, ph, 5 * dpr); cx.stroke();
        cx.fillStyle = rgba(COL.ink, 0.45); cx.font = `${9 * dpr}px Readout, monospace`; cx.fillText(pg.scan ? "scanned" : "digital", cxp + 8 * dpr, cyp + 15 * dpr);
        pg.imgs.forEach((kind, j) => {
          const tw = pw * 0.4, th = tw * 0.82, tx = cxp + 10 * dpr + j * (tw + 8 * dpr), ty = cyp + ph - th - 10 * dpr;
          icon(tx, ty, tw, th, kind, kind === query); thumbs.push({ x: tx, y: ty, w: tw, h: th, kind });
        });
      });
    }
    function frame(now) { const dt = Math.min(0.1, now - tm); tm = now; if (!RM) { if (hold > 0) hold -= dt; else { acc += dt; if (acc > 2.6) { acc = 0; query = (query + 1) % KINDS.length; } } } draw(); }
    cv.addEventListener("pointerdown", (e) => {
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
      for (const t of thumbs) if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) { query = t.kind; hold = 4; acc = 0; if (RM) draw(); break; }
    });
    return { cv, resize, frame, redraw: draw, staticDraw: () => draw() };
  })();
  modules.push(catViz);

  /* ================================================================
     Case 4: VineNet, drag to reveal the segmentation mask
  ================================================================ */
  (function vine() {
    const svg = $("#vine"), range = $("#vineRange"), out = $("#vineOut");
    const NS = "http://www.w3.org/2000/svg";
    const mk = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); (parent || svg).appendChild(n); return n; };
    const defs = mk("defs", {});
    const cp = mk("clipPath", { id: "vineClip" }, defs), clipRect = mk("rect", { x: 0, y: 0, width: 330, height: 310 }, cp);
    mk("line", { x1: 0, y1: 38, x2: 600, y2: 58, style: "stroke:var(--muted);stroke-width:3" });
    const input = mk("g", {}), maskG = mk("g", { "clip-path": "url(#vineClip)" });
    const bunches = [{ x: 112, y: 58, n: 6 }, { x: 312, y: 74, n: 7 }, { x: 506, y: 62, n: 6 }];
    const r = 14.5;
    // leaves, drawn in the input only
    [[50, 190, 58, 24, -30], [214, 150, 50, 22, 25], [420, 190, 60, 24, -20], [566, 200, 44, 20, 40], [60, 282, 56, 22, 12], [250, 285, 60, 22, -14], [470, 288, 52, 20, 18]].forEach(([x, y, rx, ry, a]) =>
      mk("ellipse", { cx: x, cy: y, rx, ry, transform: `rotate(${a} ${x} ${y})`, style: "fill:none;stroke:var(--muted);stroke-width:1.6;stroke-dasharray:5 4" }, input));
    bunches.forEach((b) => {
      mk("line", { x1: b.x, y1: 40 + (b.x / 600) * 22, x2: b.x, y2: b.y, style: "stroke:var(--ink);stroke-width:2" }, input);
      for (let i = 0; i < b.n; i++) {
        const cnt = b.n - i;
        for (let j = 0; j < cnt; j++) {
          const gx = b.x + (j - (cnt - 1) / 2) * r * 2.05, gy = b.y + 10 + i * r * 1.85;
          mk("circle", { cx: gx, cy: gy, r, style: "fill:var(--card);stroke:var(--ink);stroke-width:1.4" }, input);
          mk("path", { d: `M${gx - r * 0.55} ${gy - r * 0.15} A${r * 0.6} ${r * 0.6} 0 0 1 ${gx - r * 0.1} ${gy - r * 0.6}`, style: "fill:none;stroke:var(--muted);stroke-width:1.2;stroke-linecap:round" }, input);
          mk("circle", { cx: gx, cy: gy, r: r + 0.5, style: "fill:var(--signal);fill-opacity:.72;stroke:var(--signal);stroke-width:1" }, maskG);
        }
      }
    });
    const divider = mk("line", { x1: 330, y1: 0, x2: 330, y2: 310, style: "stroke:var(--ink);stroke-width:2" });
    const handle = mk("circle", { cx: 330, cy: 155, r: 11, style: "fill:var(--paper);stroke:var(--ink);stroke-width:2" });
    const set = () => { const x = range.value * 6; clipRect.setAttribute("width", x); divider.setAttribute("x1", x); divider.setAttribute("x2", x); handle.setAttribute("cx", x); out.textContent = "mask " + range.value + "%"; };
    range.addEventListener("input", set); set();
  })();

  /* ----------------------------------------------------------------
     Run loop: only animate what is on screen
  ---------------------------------------------------------------- */
  const visible = new Map();
  const targets = [[graph, $("#heroFig")], [pvcViz, pvcViz.cv.closest(".panel")], [mesh, mesh.cv.closest(".panel")], [warp, warp.cv.closest(".panel")], [sabaViz, sabaViz.cv.closest(".panel")], [catViz, catViz.cv.closest(".panel")]];
  targets.forEach(([m, elm]) => {
    visible.set(m, false);
    if (!elm) return;
    if ("IntersectionObserver" in window) new IntersectionObserver((es) => es.forEach((e) => visible.set(m, e.isIntersecting)), { rootMargin: "120px" }).observe(elm);
    else visible.set(m, true);
    if ("ResizeObserver" in window) new ResizeObserver(() => { m.resize(); if (RM) m.redraw && m.redraw(); }).observe(m.cv);
  });
  modules.forEach((m) => m.resize());

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const s = now / 1000;
    if (visible.get(graph)) graph.frame(dt);
    if (visible.get(pvcViz)) pvcViz.frame(s);
    if (visible.get(mesh)) mesh.frame(s, dt);
    if (visible.get(warp)) warp.frame(s);
    if (visible.get(sabaViz)) sabaViz.frame(s);
    if (visible.get(catViz)) catViz.frame(s);
    if (fx) fx.frame(dt);
    requestAnimationFrame(tick);
  }
  const fontsReady = (document.fonts && document.fonts.load)
    ? Promise.all([document.fonts.load("700 16px Adventor"), document.fonts.load("14px Readout"), document.fonts.load("16px 'Inter UI'")]).catch(() => {})
    : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(() => {
    graph.resize();                      // re-measure node pills now the display font is loaded
    if (RM) { graph.draw(); pvcViz.frame(7); mesh.frame(0, 0); warp.staticDraw(); sabaViz.frame(8.4); catViz.staticDraw(); }
    else requestAnimationFrame((t) => { last = t; tick(t); });
  });

  /* ----------------------------------------------------------------
     Header, nav, education timeline, contact
  ---------------------------------------------------------------- */
  const bar = $("#bar");
  const path = $("#path"), stops = $$(".stop");
  let ticking = false;
  function onScroll() {
    bar.classList.toggle("scrolled", window.scrollY > 12);
    if (!ticking) { ticking = true; requestAnimationFrame(() => {
      ticking = false;
      if (!path) return;
      const r = path.getBoundingClientRect(), mid = innerHeight * 0.62;
      path.style.setProperty("--p", clamp((mid - r.top) / r.height, 0, 1).toFixed(3));
      stops.forEach((s) => s.classList.toggle("on", s.getBoundingClientRect().top < mid));
    }); }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  const navLinks = $$(".nav a"), secs = navLinks.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) navLinks.forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + e.target.id)));
    }), { rootMargin: "-45% 0px -50% 0px" });
    secs.forEach((s) => io.observe(s));
    // back at the top, nothing is current
    const top = $("#top");
    if (top) new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) navLinks.forEach((a) => a.removeAttribute("aria-current")); }), { rootMargin: "-45% 0px -50% 0px" }).observe(top);
    // the Interext section belongs to Work in the nav
    const earlier = $("#earlier");
    if (earlier) new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) navLinks.forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("href") === "#work"))); }), { rootMargin: "-45% 0px -50% 0px" }).observe(earlier);
  }

  const copyBtn = $("#copyMail");
  copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(SITE.email); copyBtn.textContent = "Email address copied"; }
    catch (e) { copyBtn.textContent = SITE.email; }
    setTimeout(() => { copyBtn.textContent = "Copy email address"; }, 2200);
  });

  /* ================================================================
     Interactive layer: section reveals, magnetic targets,
     a probe cursor that trails an ECG blip, and a live BPM readout.
     All of it is opt-in: off under reduced motion and on touch devices.
  ================================================================ */
  const finePointer = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  let fx = null;

  // Section reveals — each block draws itself in as it scrolls into view.
  (() => {
    const blocks = $$(".sec-head, .case, .rows, .skills, .edu-grid, .contact");
    if (RM || !("IntersectionObserver" in window)) { blocks.forEach((b) => b.classList.add("reveal", "seen")); return; }
    blocks.forEach((b) => b.classList.add("reveal"));
    const show = (el) => { el.classList.add("seen"); ro.unobserve(el); };
    const ro = new IntersectionObserver((es) => es.forEach((e) => {
      // reveal on entry, and also any block already scrolled past (anchor jumps, restored scroll)
      if (e.isIntersecting || e.boundingClientRect.top < innerHeight * 0.9) show(e.target);
    }), { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    blocks.forEach((b) => ro.observe(b));
    // safety net: anything above the fold on load shows immediately
    requestAnimationFrame(() => blocks.forEach((b) => { if (b.getBoundingClientRect().top < innerHeight * 0.9) show(b); }));
  })();

  // Magnetic targets — buttons and nav links lean toward the cursor, then ease back.
  if (finePointer && !RM) {
    $$(".btn, .nav a, .icon-btn, .mark").forEach((el) => {
      el.classList.add("mag");
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const mx = (e.clientX - (r.left + r.width / 2)) / Math.max(r.width, 1);
        const my = (e.clientY - (r.top + r.height / 2)) / Math.max(r.height, 1);
        el.style.transform = `translate(${(mx * 12).toFixed(1)}px, ${(my * 9).toFixed(1)}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  // Probe cursor: a simple dot that eases after the mouse.
  if (finePointer && !RM) {
    const probe = $("#probe");
    document.body.classList.add("probe-on");
    probe.style.display = "block"; probe.style.opacity = "0";

    let px = innerWidth / 2, py = innerHeight / 2, rx = px, ry = py, shown = false;
    document.addEventListener("pointermove", (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      px = e.clientX; py = e.clientY;
      if (!shown) { shown = true; probe.style.opacity = "1"; }
      const over = e.target.closest && e.target.closest("a, button, [role=button], input, label, #heroGraph, .panel");
      probe.classList.toggle("big", !!over);
    }, { passive: true });
    document.addEventListener("pointerdown", () => probe.classList.add("press"));
    document.addEventListener("pointerup", () => probe.classList.remove("press"));
    document.addEventListener("mouseleave", () => { probe.style.opacity = "0"; });

    fx = { frame() {
      rx += (px - rx) * 0.3; ry += (py - ry) * 0.3;
      probe.style.transform = `translate(${rx}px, ${ry}px)`;
    } };
  }

  // Tilt cards toward the cursor, and a soft spotlight that follows it in the hero.
  if (finePointer && !RM) {
    const tilt = (el, max) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(700px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(-4px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    };
    $$(".skills > div, .wins li").forEach((el) => tilt(el, 7));

    const hero = $("#top");
    if (hero) {
      const glow = document.createElement("div");
      glow.className = "hero-glow"; glow.setAttribute("aria-hidden", "true");
      hero.appendChild(glow);
      hero.addEventListener("pointermove", (e) => {
        const r = hero.getBoundingClientRect();
        glow.style.left = (e.clientX - r.left) + "px"; glow.style.top = (e.clientY - r.top) + "px"; glow.style.opacity = "1";
      });
      hero.addEventListener("pointerleave", () => { glow.style.opacity = "0"; });
    }
  }
})();
