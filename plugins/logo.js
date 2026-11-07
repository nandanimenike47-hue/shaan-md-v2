// plugins/logo.js — 33 logo styles
//   .logo <text>            → style list (dropdown) එකක් එනවා
//   .logo neon SHAAN MD     → කෙලින්ම   |   .logo random SHAAN   |   .logolist → styles ඔක්කොම
// package.json: "@napi-rs/canvas": "^0.1.65"
import fs from "fs";
import os from "os";
import path from "path";
import { sendList } from "./_buttons.js";
import { reply } from "./_helpers.js";

const BOT = "SHAAN MD V1";

/* ───────────── STYLE DEFINITIONS ───────────── */
const SEC = { fire: "🔥 Fire & Heat", neon: "💡 Neon Glow", metal: "👑 Metal & Luxury", color: "🌈 Colorful", nature: "❄️ Elements", tech: "⚡ Glitch & Tech", d3: "🧊 3D Block" };
const fill = (sec, label, bg, stops, glow, stroke = "#000000", deco = "") => ({ sec, label, mode: "fill", bg, stops, glow, stroke, deco });
const neon = (sec, label, bg, glow, core = "#ffffff", deco = "") => ({ sec, label, mode: "neon", bg, glow, core, deco });
const d3 = (sec, label, bg, stops, side, stroke = "#000000", deco = "") => ({ sec, label, mode: "3d", bg, stops, side, stroke, deco });
const glitch = (sec, label, bg, a, b, deco = "scan") => ({ sec, label, mode: "glitch", bg, a, b, deco });

const STYLES = {
  // 🔥 Fire & Heat
  fire:    fill("fire", "🔥 Fire", ["#2b0000", "#0a0000"], [[0, "#fff59d"], [0.45, "#ffb300"], [1, "#e53935"]], "#ff2a00", "#7f0000"),
  lava:    fill("fire", "🌋 Lava", ["#2a0a00", "#080200"], [[0, "#ffe082"], [0.4, "#ff6f00"], [0.7, "#bf360c"], [1, "#4e1500"]], "#ff6d00", "#260800"),
  blood:   fill("fire", "🩸 Blood", ["#1c0000", "#050000"], [[0, "#ff5252"], [0.5, "#b71c1c"], [1, "#4a0000"]], "#d50000", "#120000"),
  thunder: fill("fire", "⚡ Thunder", ["#0a0a1c", "#020208"], [[0, "#ffffff"], [0.4, "#fff176"], [1, "#fbc02d"]], "#ffee58", "#3a3000", "stars"),
  // 💡 Neon Glow
  neon:       neon("neon", "💙 Neon Blue", ["#0a0f2e", "#02030a"], "#00e5ff", "#e0ffff"),
  neonpink:   neon("neon", "💗 Neon Pink", ["#2a0620", "#07010a"], "#ff2d95", "#ffe0f0"),
  neongreen:  neon("neon", "💚 Neon Green", ["#04210f", "#010804"], "#39ff14", "#eaffe0"),
  neonpurple: neon("neon", "💜 Neon Purple", ["#1a0630", "#05010c"], "#b052ff", "#f2e0ff"),
  neonred:    neon("neon", "❤️ Neon Red", ["#2a0505", "#080101"], "#ff1744", "#ffe0e0"),
  neonorange: neon("neon", "🧡 Neon Orange", ["#2a1204", "#080301"], "#ff9100", "#fff0e0"),
  // 👑 Metal & Luxury
  gold:      fill("metal", "👑 Gold", ["#2a1d05", "#070502"], [[0, "#fff6c2"], [0.3, "#f9d423"], [0.55, "#b8860b"], [0.75, "#ffe27a"], [1, "#8a6a00"]], "#ffcf40", "#3b2a00"),
  silver:    fill("metal", "🥈 Silver", ["#1c1f24", "#050607"], [[0, "#ffffff"], [0.4, "#cfd8dc"], [0.6, "#78909c"], [1, "#eceff1"]], "#b0bec5", "#263238"),
  chrome:    fill("metal", "🪞 Chrome", ["#0b1a2b", "#020509"], [[0, "#ffffff"], [0.35, "#90caf9"], [0.5, "#1e3a5f"], [0.65, "#e3f2fd"], [1, "#5c7a99"]], "#64b5f6", "#0d1b2a"),
  bronze:    fill("metal", "🥉 Bronze", ["#24140a", "#060302"], [[0, "#ffd9a8"], [0.5, "#cd7f32"], [1, "#6b3e12"]], "#d98b3a", "#2b1604"),
  rosegold:  fill("metal", "🌹 Rose Gold", ["#2a1418", "#080304"], [[0, "#ffe8e0"], [0.45, "#f4b6a6"], [0.75, "#b76e79"], [1, "#e8a598"]], "#f4a6b0", "#3d1a20"),
  diamond:   fill("metal", "💎 Diamond", ["#06222b", "#010809"], [[0, "#ffffff"], [0.4, "#b2ebf2"], [0.7, "#4dd0e1"], [1, "#e0f7fa"]], "#80deea", "#00363f", "stars"),
  // 🌈 Colorful
  rainbow: fill("color", "🌈 Rainbow", ["#12121c", "#030306"], [[0, "#ff1744"], [0.2, "#ff9100"], [0.4, "#ffea00"], [0.6, "#00e676"], [0.8, "#2979ff"], [1, "#d500f9"]], "#ffffff", "#111111"),
  sunset:  fill("color", "🌇 Sunset", ["#2b0f2f", "#0a0310"], [[0, "#ffee58"], [0.4, "#ff7043"], [0.75, "#e91e63"], [1, "#7b1fa2"]], "#ff7043", "#2a0a2e"),
  ocean:   fill("color", "🌊 Ocean", ["#021b33", "#01060d"], [[0, "#b3e5fc"], [0.4, "#29b6f6"], [0.75, "#0277bd"], [1, "#01306b"]], "#29b6f6", "#001a33"),
  galaxy:  fill("color", "🌌 Galaxy", ["#14062b", "#030008"], [[0, "#f8bbd0"], [0.4, "#ba68c8"], [0.75, "#5e35b1"], [1, "#1a237e"]], "#9c6bff", "#0b0224", "stars"),
  candy:   fill("color", "🍬 Candy", ["#2a1030", "#0a0410"], [[0, "#ffffff"], [0.4, "#ff80ab"], [0.7, "#f50057"], [1, "#ff4081"]], "#ff80ab", "#4a0a2a"),
  aurora:  fill("color", "🌠 Aurora", ["#041a1c", "#010607"], [[0, "#b9f6ca"], [0.4, "#1de9b6"], [0.7, "#00b0ff"], [1, "#7c4dff"]], "#1de9b6", "#00201f", "stars"),
  // ❄️ Elements
  ice:     fill("nature", "❄️ Ice", ["#071c2e", "#02080f"], [[0, "#ffffff"], [0.4, "#e1f5fe"], [0.75, "#81d4fa"], [1, "#4fc3f7"]], "#b3e5fc", "#0a3a5c", "stars"),
  toxic:   fill("nature", "☣️ Toxic", ["#0b1f05", "#020601"], [[0, "#f4ff81"], [0.45, "#76ff03"], [1, "#2e7d32"]], "#76ff03", "#0a2a02"),
  emerald: fill("nature", "🍀 Emerald", ["#04241a", "#010a07"], [[0, "#ccffe6"], [0.45, "#00e676"], [1, "#00695c"]], "#1de9b6", "#00261c"),
  shadow:  fill("nature", "🌑 Shadow", ["#16161a", "#030304"], [[0, "#9e9e9e"], [0.5, "#424242"], [1, "#121212"]], "#ffffff", "#000000"),
  // ⚡ Glitch & Tech
  glitch:     glitch("tech", "⚡ Glitch", ["#1a0a1f", "#050208"], "#ff0044", "#00e5ff"),
  glitchpink: glitch("tech", "🎮 Glitch Pink", ["#1d0a2e", "#04010a"], "#ff00cc", "#ffee00"),
  matrix:     neon("tech", "🟩 Matrix", ["#021a06", "#000500"], "#00ff41", "#d6ffe0", "matrix"),
  // 🧊 3D Block
  "3dblue":   d3("d3", "🧊 3D Blue", ["#0a1230", "#02040c"], [[0, "#bbdefb"], [1, "#2196f3"]], "#0d3b8a"),
  "3dred":    d3("d3", "🧱 3D Red", ["#2a0808", "#080202"], [[0, "#ffcdd2"], [1, "#f44336"]], "#7f0000"),
  "3dgold":   d3("d3", "🏆 3D Gold", ["#241a06", "#060401"], [[0, "#fff6c2"], [1, "#f9a825"]], "#7a5200"),
  "3dgreen":  d3("d3", "🟢 3D Green", ["#06220e", "#010803"], [[0, "#c8e6c9"], [1, "#4caf50"]], "#0d4d1a"),
  "3dpurple": d3("d3", "🟣 3D Purple", ["#1c0a30", "#04010a"], [[0, "#e1bee7"], [1, "#9c27b0"]], "#4a0a6a"),
};
const KEYS = Object.keys(STYLES);

/* ───────────── font ───────────── */
const FONT_URL = "https://github.com/google/fonts/raw/main/ofl/bungee/Bungee-Regular.ttf";
let fontReady = null;
async function ensureFont(GlobalFonts) {
  if (fontReady !== null) return fontReady;
  try {
    const file = path.join(os.tmpdir(), "shaan_logo_Bungee.ttf");
    if (!fs.existsSync(file) || fs.statSync(file).size < 10000) {
      const r = await fetch(FONT_URL, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error("font HTTP " + r.status);
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    }
    GlobalFonts.registerFromPath(file, "LogoFont");
    fontReady = "LogoFont";
  } catch (e) {
    console.log("⚠️ logo font fail:", e?.message || e);
    fontReady = "sans-serif";
  }
  return fontReady;
}

function layout(ctx, text, family, maxW) {
  let lines = [text];
  if (text.length > 12 && text.includes(" ")) {
    const mid = text.length / 2;
    let best = -1;
    for (let i = 0; i < text.length; i++) if (text[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    lines = [text.slice(0, best), text.slice(best + 1)];
  }
  let size = 190;
  for (; size > 40; size -= 4) {
    ctx.font = `${size}px ${family}`;
    if (Math.max(...lines.map((l) => ctx.measureText(l).width)) <= maxW) break;
  }
  return { lines, size };
}

/* ───────────── renderer ───────────── */
async function makeLogo(text, key) {
  const S = STYLES[key];
  const canvasMod = await import("@napi-rs/canvas").catch(() => null);
  if (!canvasMod) throw new Error("@napi-rs/canvas install වෙලා නෑ (package.json එකට එකතු කරලා restart කරන්න)");
  const { createCanvas, GlobalFonts } = canvasMod;
  const family = await ensureFont(GlobalFonts);
  const W = 1280, H = 640;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  const T = text.toUpperCase();

  // background
  const g = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, S.bg[0]); g.addColorStop(1, S.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.07; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.globalAlpha = 1;
  if (S.deco === "stars") {
    for (let i = 0; i < 90; i++) {
      ctx.globalAlpha = 0.2 + Math.random() * 0.7; ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2.2 + 0.4, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (S.deco === "matrix") {
    ctx.font = "22px monospace"; ctx.fillStyle = "#00ff41"; ctx.textAlign = "left";
    const chars = "01アイウエオカキクケコサシスセソ";
    for (let x = 0; x < W; x += 26) for (let y = 0, n = Math.floor(Math.random() * 14); n > 0; n--, y += 26) {
      ctx.globalAlpha = 0.08 + Math.random() * 0.35; ctx.fillText(chars[Math.floor(Math.random() * chars.length)], x, Math.random() * H);
    }
    ctx.globalAlpha = 1;
  }

  // text
  const { lines, size } = layout(ctx, T, family, W - 160);
  ctx.font = `${size}px ${family}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const lh = size * 1.1, y0 = H / 2 - ((lines.length - 1) * lh) / 2 - 10;
  const each = (fn) => lines.forEach((l, i) => fn(l, W / 2, y0 + i * lh));
  const grad = (stops) => { const gr = ctx.createLinearGradient(0, y0 - size / 2, 0, y0 + (lines.length - 0.5) * lh); stops.forEach(([p, col]) => gr.addColorStop(p, col)); return gr; };

  if (S.mode === "fill") {
    ctx.shadowColor = S.glow; ctx.shadowBlur = 55; ctx.fillStyle = S.glow; each((l, x, y) => ctx.fillText(l, x, y));
    ctx.shadowBlur = 20; ctx.fillStyle = grad(S.stops); each((l, x, y) => ctx.fillText(l, x, y));
    ctx.shadowBlur = 0; ctx.lineWidth = 3; ctx.strokeStyle = S.stroke; each((l, x, y) => ctx.strokeText(l, x, y));
  } else if (S.mode === "neon") {
    ctx.shadowColor = S.glow; ctx.strokeStyle = S.glow; ctx.lineWidth = 8;
    for (const b of [70, 40, 18]) { ctx.shadowBlur = b; each((l, x, y) => ctx.strokeText(l, x, y)); }
    ctx.shadowBlur = 10; ctx.fillStyle = S.core; each((l, x, y) => ctx.fillText(l, x, y));
  } else if (S.mode === "3d") {
    ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14; ctx.fillStyle = S.side; each((l, x, y) => ctx.fillText(l, x + 22, y + 22));
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    for (let i = 20; i >= 1; i--) { ctx.fillStyle = S.side; each((l, x, y) => ctx.fillText(l, x + i, y + i)); }
    ctx.fillStyle = grad(S.stops); each((l, x, y) => ctx.fillText(l, x, y));
    ctx.lineWidth = 3; ctx.strokeStyle = S.stroke; each((l, x, y) => ctx.strokeText(l, x, y));
  } else { // glitch
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = S.a; each((l, x, y) => ctx.fillText(l, x - 9, y - 3));
    ctx.fillStyle = S.b; each((l, x, y) => ctx.fillText(l, x + 9, y + 3));
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 12; ctx.fillStyle = "#ffffff"; each((l, x, y) => ctx.fillText(l, x, y));
  }
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  if (S.deco === "scan" || S.mode === "glitch") { ctx.fillStyle = "rgba(0,0,0,.35)"; for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2); }

  // footer
  ctx.globalAlpha = 0.75; ctx.font = `28px ${family}`; ctx.fillStyle = "#ffffff"; ctx.textAlign = "center";
  ctx.fillText(`— ${BOT} —`, W / 2, H - 42); ctx.globalAlpha = 1;
  return c.toBuffer("image/png");
}

/* ───────────── plugin ───────────── */
const CACHE = new Map();
const rid = () => Math.random().toString(36).slice(2, 8);
const sweep = () => { const n = Date.now(); for (const [k, v] of CACHE) if (n - v.t > 15 * 60 * 1000) CACHE.delete(k); };

async function send(sock, msg, text, key) {
  if (key === "random") key = KEYS[Math.floor(Math.random() * KEYS.length)];
  const jid = msg.key.remoteJid;
  await sock.sendMessage(jid, { react: { text: "🎨", key: msg.key } }).catch(() => {});
  const png = await makeLogo(text, key);
  await sock.sendMessage(jid, { image: png, caption: `🎨 *${STYLES[key].label}* logo\n_.logo ${key} <text>_\n\n> ⚡ ${BOT}` }, { quoted: msg });
  await sock.sendMessage(jid, { react: { text: "✅", key: msg.key } }).catch(() => {});
}

function listText(pf) {
  let t = `🎨 *LOGO STYLES* (${KEYS.length})\n`;
  for (const [sk, title] of Object.entries(SEC)) {
    t += `\n*${title}*\n` + KEYS.filter((k) => STYLES[k].sec === sk).map((k) => `• ${pf}logo ${k} <text>`).join("\n") + "\n";
  }
  return t + `\n• ${pf}logo random <text>`;
}

export default {
  command: ["logo", "logomk", "logolist"],
  alias: ["logomaker"],
  category: "tools",
  desc: `Logo maker (${KEYS.length} styles)`,
  async execute(sock, msg, args, name) {
    sweep();
    const pf = globalThis.SHAN?.settings?.prefix || ".";
    try {
      if (name === "logolist") return reply(sock, msg, listText(pf));
      if (name === "logomk") {
        const e = CACHE.get(String(args[0] || ""));
        const style = String(args[1] || "");
        if (!e || !(STYLES[style] || style === "random")) return reply(sock, msg, "⌛ මේ card එක expire වෙලා. ආයෙ .logo <text> ගහන්න.");
        return await send(sock, msg, e.text, style);
      }
      const first = (args[0] || "").toLowerCase();
      if ((STYLES[first] || first === "random") && args.length > 1) {
        args.shift();
        return await send(sock, msg, args.join(" ").slice(0, 28), first);
      }
      const text = args.join(" ").trim().slice(0, 28);
      if (!text) return reply(sock, msg, `🎨 *Logo Maker* — styles ${KEYS.length}\n\n${pf}logo SHAAN MD\n${pf}logo neon SHAAN\n${pf}logo random SHAAN\n${pf}logolist  (styles ඔක්කොම)\n\n_English අකුරු විතරයි, උපරිම 28_`);

      const id = rid();
      CACHE.set(id, { text, t: Date.now() });
      const sections = Object.entries(SEC).map(([sk, title]) => ({
        title,
        rows: KEYS.filter((k) => STYLES[k].sec === sk).map((k) => ({ title: STYLES[k].label, description: `${pf}logo ${k} <text>`, id: `${pf}logomk ${id} ${k}` })),
      }));
      const ok = await sendList(sock, msg.key.remoteJid, msg, {
        caption: `╭━━━━━━━━━━━━━━━━━━━━━╮\n┃  🎨  *LOGO MAKER*\n╰━━━━━━━━━━━━━━━━━━━━━╯\n\n✏️ Text : *${text}*\n🖼️ Styles : *${KEYS.length}*\n\n👇 *Select Style* ඔබලා එකක් තෝරන්න`,
        footer: BOT, buttonText: "🎨 Select Style", sections,
        extra: [{ text: "🎲 Random", id: `${pf}logomk ${id} random` }],
      });
      if (!ok) return reply(sock, msg, `⚠️ List එක යවන්න බැරි වුණා.\n\n${listText(pf)}`);
    } catch (e) {
      return reply(sock, msg, `❌ Logo failed: ${e?.message || e}`);
    }
  },
};
