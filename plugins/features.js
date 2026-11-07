// ─────────────────────────────────────────────────────────────
// SHAAN MD — features.js
// Anti Link / Anti Spam / Anti Bad Words / Anti Bot / Violation Action
// Welcome / Goodbye / Auto Sticker / Auto Crop / Auto Download
// AI Auto Reply / Language
// index.js එකේ තියෙන ෆෝල්ඩර් එකටම දාන්න (settings.js තියෙන තැනට)
// ─────────────────────────────────────────────────────────────
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

let L = console.log;
let DIR = ".";
let PLUGINS = new Map();

export function init({ dir, log, plugins }) {
  if (dir) DIR = dir;
  if (log) L = log;
  if (plugins) PLUGINS = plugins;
}

const digits = (jid = "") => String(jid).split("@")[0].split(":")[0].replace(/\D/g, "");
const noted = new Set();
const noteOnce = (k, msg) => { if (noted.has(k)) return; noted.add(k); L(msg); };

/* =========================
LANGUAGE
========================= */
const T = {
  en: {
    link: "🔗 Links are not allowed in this group!",
    spam: "🚷 Please don't spam!",
    bad: "🤬 Bad words are not allowed here!",
    bot: "🛑 Bots are not allowed in this group!",
    warn: (n) => `⚠️ Warning ${n}/3 — 3 warnings = removal`,
    kicked: "🚫 Removed from the group after 3 warnings.",
    welcome: (u, g, c) => `👋 Welcome ${u} to *${g}*!\n👥 Members: ${c}\n\n_Please read the group rules._`,
    goodbye: (u, g) => `😢 ${u} left *${g}*.\nGoodbye!`,
  },
  si: {
    link: "🔗 මේ group එකේ links දාන්න එපා!",
    spam: "🚷 Spam කරන්න එපා!",
    bad: "🤬 නරක වචන භාවිතා කරන්න එපා!",
    bot: "🛑 මේ group එකට bots ට ඉඩ නෑ!",
    warn: (n) => `⚠️ අනතුරු ඇඟවීම ${n}/3 — 3ක් වුණාම ඉවත් කරනවා`,
    kicked: "🚫 අනතුරු ඇඟවීම් 3කින් පස්සේ group එකෙන් ඉවත් කළා.",
    welcome: (u, g, c) => `👋 ${u}, *${g}* වෙත සාදරයෙන් පිළිගන්නවා!\n👥 සාමාජිකයන්: ${c}\n\n_Group rules කියවන්න._`,
    goodbye: (u, g) => `😢 ${u} *${g}* අතහැරලා ගියා.\nගිහින් එන්න!`,
  },
};
const tr = (settings) => (settings?.raw?.language === "si" ? T.si : T.en);

/* =========================
GROUP HELPERS
========================= */
const gmCache = new Map();
async function groupInfo(sock, jid) {
  const c = gmCache.get(jid);
  if (c && Date.now() - c.t < 60000) return c.m;
  const m = await sock.groupMetadata(jid);
  gmCache.set(jid, { t: Date.now(), m });
  return m;
}
function isAdminOf(meta, jid) {
  const d = digits(jid);
  if (!d) return false;
  return (meta?.participants || []).some(
    (p) => p.admin && [p.id, p.jid, p.phoneNumber, p.lid].filter(Boolean).some((x) => digits(x) === d)
  );
}

/* =========================
WARNINGS (MongoDB, fallback = memory)
========================= */
const Warn =
  mongoose.models.BotWarns ||
  mongoose.model("BotWarns", new mongoose.Schema({ _id: String, count: { type: Number, default: 0 } }));
const memWarns = new Map();
async function addWarn(id) {
  try {
    const w = await Warn.findByIdAndUpdate(id, { $inc: { count: 1 } }, { upsert: true, new: true });
    return w.count;
  } catch {
    const n = (memWarns.get(id) || 0) + 1;
    memWarns.set(id, n);
    return n;
  }
}
async function clearWarn(id) {
  memWarns.delete(id);
  try { await Warn.deleteOne({ _id: id }); } catch {}
}

/* =========================
VIOLATION ACTION  (warn / delete / kick)
========================= */
async function punish(sock, msg, { jid, sender, settings, botAdmin }, reason) {
  const mode = settings.raw?.violation || "warn";
  const t = tr(settings);
  const tag = "@" + digits(sender);
  const mentions = [sender];
  if (botAdmin) await sock.sendMessage(jid, { delete: msg.key }).catch(() => {});
  else noteOnce("notadmin:" + jid, `ℹ️ Bot admin නෙවෙයි (${jid}) — message delete / kick කරන්න බෑ, warn විතරයි යවනවා.`);

  if (mode === "kick" && botAdmin) {
    await sock.sendMessage(jid, { text: `${tag} ${reason}`, mentions }).catch(() => {});
    await sock.groupParticipantsUpdate(jid, [sender], "remove").catch(() => {});
    return;
  }
  if (mode === "delete") {
    await sock.sendMessage(jid, { text: `${tag} ${reason}`, mentions }).catch(() => {});
    return;
  }
  const id = jid + ":" + digits(sender);
  const count = await addWarn(id);
  if (count >= 3) {
    await sock.sendMessage(jid, { text: `${tag} ${t.kicked}`, mentions }).catch(() => {});
    if (botAdmin) await sock.groupParticipantsUpdate(jid, [sender], "remove").catch(() => {});
    await clearWarn(id);
  } else {
    await sock.sendMessage(jid, { text: `${tag} ${reason}\n${t.warn(count)}`, mentions }).catch(() => {});
  }
}

/* =========================
DETECTORS
========================= */
const LINK_RE = /(https?:\/\/\S+|www\.\S+|chat\.whatsapp\.com\/\S+|\b(?:wa|t)\.me\/\S+|\b[a-z0-9-]{2,}\.(?:com|net|org|lk|io|xyz|info|link|gg)\b\/?\S*)/i;

const spamMap = new Map();
function isSpam(jid, sender) {
  const k = jid + ":" + sender;
  const now = Date.now();
  const arr = (spamMap.get(k) || []).filter((x) => now - x < 8000);
  arr.push(now);
  spamMap.set(k, arr);
  if (spamMap.size > 5000) spamMap.clear();
  if (arr.length >= 6) { spamMap.delete(k); return true; }
  return false;
}

// Baileys පාවිච්චි කරන bots වල message ID pattern
const looksLikeBot = (id = "") => (id.startsWith("BAE5") && id.length === 16) || (id.startsWith("3EB0") && id.length === 40);

const DEFAULT_BAD = [
  "fuck", "shit", "bitch", "asshole", "bastard", "pussy", "whore", "slut", "cunt",
  "huththa", "hutto", "pakaya", "ponnaya", "wesi",
  "පකයා", "පොන්නයා", "වේසි", "හුත්තා", "හුත්ති",
];
let badList = null, badLoaded = 0;
function badWords() {
  if (badList && Date.now() - badLoaded < 300000) return badList;
  let extra = [];
  try {
    const f = path.join(DIR, "badwords.txt");
    if (fs.existsSync(f)) extra = fs.readFileSync(f, "utf8").split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  } catch {}
  badList = [...new Set([...DEFAULT_BAD, ...extra])].map((w) => (/^[a-z0-9]+$/.test(w) ? new RegExp(`\\b${w}\\b`) : w));
  badLoaded = Date.now();
  return badList;
}
function hasBadWord(text) {
  const low = text.toLowerCase();
  return badWords().some((w) => (w instanceof RegExp ? w.test(low) : low.includes(w)));
}

/* =========================
MODERATION  (groups only) — true = message handled
========================= */
export async function moderate(sock, msg, ctx) {
  const { jid, text, settings } = ctx;
  const R = settings.raw || {};
  if (!(R.antilink || R.antispam || R.antibadwords || R.antibot)) return false;
  const sender = msg.key.participant;
  if (!sender || msg.key.fromMe) return false;

  let meta;
  try { meta = await groupInfo(sock, jid); } catch { return false; }
  if (isAdminOf(meta, sender)) return false; // admins ට නීති බලපාන්නේ නෑ

  const t = tr(settings);
  const botAdmin = isAdminOf(meta, sock.user?.id) || isAdminOf(meta, sock.user?.lid);
  const c = { jid, sender, settings, botAdmin };

  if (R.antibot && looksLikeBot(msg.key.id)) { await punish(sock, msg, c, t.bot); return true; }
  if (R.antilink && text && LINK_RE.test(text)) { await punish(sock, msg, c, t.link); return true; }
  if (R.antibadwords && text && hasBadWord(text)) { await punish(sock, msg, c, t.bad); return true; }
  if (R.antispam && isSpam(jid, sender)) { await punish(sock, msg, c, t.spam); return true; }
  return false;
}

/* =========================
WELCOME / GOODBYE
========================= */
export async function onGroupUpdate(sock, ev, getSettings) {
  const settings = await getSettings();
  const R = settings.raw || {};
  const isAdd = ev.action === "add";
  const isRemove = ev.action === "remove";
  if (!((isAdd && R.welcome) || (isRemove && R.goodbye))) return;

  gmCache.delete(ev.id);
  const meta = await sock.groupMetadata(ev.id).catch(() => null);
  const t = tr(settings);
  const group = meta?.subject || "the group";
  for (const p of ev.participants || []) {
    const id = typeof p === "string" ? p : p.id;
    const num = digits(typeof p === "string" ? p : p.phoneNumber || p.id);
    const tag = "@" + num;
    const caption = isAdd ? t.welcome(tag, group, meta?.participants?.length ?? "?") : t.goodbye(tag, group);
    const pic = await sock.profilePictureUrl(id, "image").catch(() => null);
    const content = pic ? { image: { url: pic }, caption, mentions: [id] } : { text: caption, mentions: [id] };
    await sock.sendMessage(ev.id, content).catch(() => {});
  }
}

/* =========================
AUTO STICKER / AUTO CROP
========================= */
async function autoSticker(sock, msg, ctx) {
  const m = ctx.m || {};
  const kind = m.imageMessage ? "image" : m.videoMessage ? "video" : null;
  if (!kind) return false;
  if (kind === "video" && (m.videoMessage.seconds || 0) > 10) return false;
  let lib;
  try { lib = await import("wa-sticker-formatter"); }
  catch { noteOnce("wsf", "⚠️ Auto Sticker ඕන නම්: npm i wa-sticker-formatter  (video වලට ffmpeg ඕන)"); return false; }
  const { Sticker, StickerTypes } = lib;
  const buf = await sock.downloadMediaMessage(msg);
  const st = new Sticker(buf, {
    pack: "SHAAN MD V1",
    author: "Bot",
    type: ctx.settings.raw?.autocrop ? StickerTypes.CROPPED : StickerTypes.FULL, // Auto Crop = 1:1 square
    quality: 60,
  });
  await sock.sendMessage(ctx.jid, { sticker: await st.toBuffer() }, { quoted: msg });
  return true;
}

/* =========================
AUTO DOWNLOAD (links)
========================= */
const URL_RE = /https?:\/\/[^\s]+/i;
const SITES = [
  [/tiktok\.com/i, ["tiktok", "tt", "ttdl"]],
  [/facebook\.com|fb\.watch/i, ["facebook", "fb", "fbdl"]],
  [/instagram\.com/i, ["instagram", "ig", "igdl"]],
  [/youtube\.com|youtu\.be/i, ["ytmp4", "ytv", "video"]],
];
async function autoDownload(sock, msg, ctx) {
  const url = ctx.text.match(URL_RE)?.[0];
  if (!url) return false;
  const site = SITES.find(([re]) => re.test(url));
  if (!site) return false;
  // 1) ඔයාගේ plugin එකක් තියෙනවා නම් ඒකම පාවිච්චි කරනවා
  for (const name of site[1]) {
    const p = PLUGINS.get(name);
    if (p) { await p.execute(sock, msg, [url], name); return true; }
  }
  // 2) TikTok විතරක් built-in
  if (/tiktok\.com/i.test(url)) {
    const r = await fetch("https://www.tikwm.com/api/?url=" + encodeURIComponent(url));
    const j = await r.json();
    const v = j?.data?.hdplay || j?.data?.play;
    if (v) { await sock.sendMessage(ctx.jid, { video: { url: v }, caption: j.data.title || "" }, { quoted: msg }); return true; }
  }
  noteOnce("dl:" + site[0], "ℹ️ Auto Download: මේ site එකට downloader plugin එකක් (fb/ig/ytmp4 command) නෑ.");
  return false;
}

/* =========================
AI AUTO REPLY (private chats)
========================= */
const aiHist = new Map();
const aiLast = new Map();
const SYSTEM = "You are SHAAN MD V1, a friendly WhatsApp assistant. Reply briefly and naturally in the same language the user writes in (Sinhala, Singlish or English).";

async function askAI(history) {
  if (process.env.ANTHROPIC_API_KEY) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.AI_MODEL || "claude-haiku-5-5", max_tokens: 400, system: SYSTEM, messages: history }),
    });
    const j = await r.json();
    return (j.content || []).map((c) => c.text || "").join("").trim();
  }
  const key = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return null;
  const r = await fetch(process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + key },
    body: JSON.stringify({ model: process.env.AI_MODEL || "gpt-4o-mini", max_tokens: 400, messages: [{ role: "system", content: SYSTEM }, ...history] }),
  });
  const j = await r.json();
  return (j.choices?.[0]?.message?.content || "").trim();
}

async function aiReply(sock, msg, ctx) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.AI_API_KEY && !process.env.OPENAI_API_KEY) {
    noteOnce("aikey", "⚠️ AI Auto Reply ON, ඒත් API key නෑ. .env එකට ANTHROPIC_API_KEY (හෝ AI_API_KEY) දාන්න.");
    return;
  }
  if (Date.now() - (aiLast.get(ctx.jid) || 0) < 3000) return;
  aiLast.set(ctx.jid, Date.now());
  let h = aiHist.get(ctx.jid) || [];
  h.push({ role: "user", content: ctx.text.slice(0, 1500) });
  h = h.slice(-8);
  while (h.length && h[0].role !== "user") h.shift();
  let out = null;
  try { out = await askAI(h); } catch (e) { L("AI error:", e?.message || e); }
  if (!out) { h.pop(); aiHist.set(ctx.jid, h); return; }
  h.push({ role: "assistant", content: out });
  aiHist.set(ctx.jid, h);
  if (aiHist.size > 500) aiHist.delete(aiHist.keys().next().value);
  await sock.sendMessage(ctx.jid, { text: out }, { quoted: msg });
}

/* =========================
PASSIVE FEATURES (command නෙවෙයි message වලට)
========================= */
export async function passive(sock, msg, ctx) {
  const R = ctx.settings.raw || {};
  const isGroup = ctx.jid.endsWith("@g.us");
  const ownerSide = ctx.isOwner || msg.key.fromMe;
  const dmOrOwner = !isGroup || ownerSide;
  try {
    if (R.autosticker && dmOrOwner && (await autoSticker(sock, msg, ctx))) return;
    if (R.autodownload && dmOrOwner && ctx.text && (await autoDownload(sock, msg, ctx))) return;
    if (R.autoreply && !isGroup && !ownerSide && ctx.text) await aiReply(sock, msg, ctx);
  } catch (e) {
    L("passive feature error:", e?.message || e);
  }
}