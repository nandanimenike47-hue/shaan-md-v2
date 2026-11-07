// ─────────────────────────────────────────────────────────────
// SHAAN MD V1 BOT — index.js  (Pterodactyl / Node 20+)
// FIXED VERSION v3 - LID fix, sub-bot (pair.js) hooks, alias support, settings cache
// ─────────────────────────────────────────────────────────────

import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  downloadMediaMessage,
  Browsers,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";
import path from "path";
import readline from "readline";
import { AsyncLocalStorage } from "async_hooks";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* =========================
CONFIG
========================= */
const SESSION_DIR = path.join(__dirname, "session");
const PLUGIN_DIR = fs.existsSync(path.join(__dirname, "plugins"))
  ? path.join(__dirname, "plugins")
  : __dirname;
const OWNERS = (process.env.OWNER_NUMBER || "94771168937")
  .split(",")
  .map((n) => n.replace(/\D/g, ""))
  .filter(Boolean);
const log = (...a) => console.log("[SHAAN MD V1]", ...a);
// Baileys logger — "Timed Out (init queries)" / "error in handling message" වගේ අනවශ්‍ය JSON dump ටික console එකට එන එක නවත්තනවා
// (මේවා bot එක කැඩෙන errors නෙවෙයි — WhatsApp server එකට query එකක් timeout වුණාම Baileys ම retry කරනවා)
let _lastHandleErr = 0;
const logger = pino({
  level: process.env.LOG_LEVEL || "error",
  hooks: {
    logMethod(args, method) {
      try {
        const obj = typeof args[0] === "object" ? args[0] : {};
        const msg = String(typeof args[0] === "string" ? args[0] : args[1] || "");
        const errText = String(obj?.err?.message || obj?.error?.message || obj?.err || "");
        if (/init queries/i.test(msg) || (/timed out/i.test(errText) && !/handling message/i.test(msg))) return; // drop
        if (/failed to decrypt message/i.test(msg)) { return; } // පරණ message වල MessageCounterError / Bad MAC — harmless
        if (/error in handling message/i.test(msg)) {
          if (Date.now() - _lastHandleErr > 30000) { _lastHandleErr = Date.now(); log("⚠️ message handle error (ignored):", errText || "decrypt/session issue"); }
          return; // byte-array dump එක console එකට යවන්නේ නෑ
        }
      } catch {}
      return method.apply(this, args);
    },
  },
});

// MongoDB Connect
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI).then(() => log("✅ MongoDB Connected")).catch(e => log("❌ Mongo Error:", e.message));
} else {
  log("⚠️ MONGO_URI not found in .env");
}

const NOISY = /^(Closing|Removing old closed|Opening|Migrating|Decrypted message with closed|Session already|Failed to decrypt message with any known session|Session error:|Bad MAC|No matching sessions found)/i;
// SHOW_SESSION_LOGS=1 දැම්මොත් Signal session logs (Closing/Opening/Decrypted...) හංගන්නේ නෑ — Bad MAC debug කරන්න
if (process.env.SHOW_SESSION_LOGS !== "1") {
  for (const k of ["log", "info", "warn", "error"]) {
    const orig = console[k].bind(console);
    console[k] = (...args) => {
      if (typeof args[0] === "string" && NOISY.test(args[0])) return;
      orig(...args);
    };
  }
}

const DEBUG_MESSAGES = process.env.DEBUG_MESSAGES !== "0";
const LID_FIX = process.env.LID_FIX !== "0"; // default ON (LID -> real number). Off කරන්න LID_FIX=0

process.on("unhandledRejection", (e) => log("unhandledRejection:", e?.message || e));
process.on("uncaughtException", (e) => log("uncaughtException:", e?.message || e));

/* =========================
SETTINGS (FIXED REALTIME UPDATE)
========================= */
// 🤖 හැම bot එකකටම (main + sub-bots) වෙන වෙනම settings.
//    botCtx = දැන් run වෙන්නේ කොයි bot එකේද කියලා (main = "", sub-bot = number). settings.js එකත් මේක කියවනවා.
const botCtx = new AsyncLocalStorage();
globalThis.SHAN_BOT_CTX = botCtx;
const SETTINGS_DEFAULT = {
  public: true, ownerOnly: false, prefix: ".",
  autoSeen: false, autoReact: false, autoTyping: false, typingMode: "COMPOSING",
  reactMode: "FIXED", reactEmoji: "❤️", randomEmojis: ["❤️", "🔥", "😂", "😍", "👍", "🙏"],
  statusSeen: false, antiCall: false, blockCallers: false,
  callMessage: "📵 Calls are not allowed", reconnect: true, alwaysOnline: false,
};
const settingsByBot = new Map();
const botKeyNow = () => botCtx.getStore()?.bot || "";
const settingsOf = (k = botKeyNow()) => {
  if (!settingsByBot.has(k)) settingsByBot.set(k, { ...SETTINGS_DEFAULT });
  return settingsByBot.get(k);
};
// `settings.xxx` කියලා ලියන හැම තැනම ඉබේම දැන් ඉන්න bot එකේ settings වලට යනවා
const settings = new Proxy({}, {
  get: (_, p) => settingsOf()[p],
  set: (_, p, v) => { settingsOf()[p] = v; return true; },
  has: (_, p) => p in settingsOf(),
  ownKeys: () => Reflect.ownKeys(settingsOf()),
  getOwnPropertyDescriptor: (_, p) => { const d = Object.getOwnPropertyDescriptor(settingsOf(), p); return d ? { ...d, configurable: true } : undefined; },
});

let settingsLib = null;
let currentSock = null;
let onlineTimer = null;

// Always Online on/off -> bot eka dan online/offline karanawa (restart nathuwa)
async function syncPresence() {
  clearInterval(onlineTimer); onlineTimer = null;
  try {
    const sock = currentSock;
    if (!sock?.user) return;
    if (settings.alwaysOnline) {
      await sock.sendPresenceUpdate("available");
      onlineTimer = setInterval(() => sock.sendPresenceUpdate("available").catch(() => {}), 30000);
    } else {
      await sock.sendPresenceUpdate("unavailable");
    }
  } catch {}
}

const lastRefreshBy = new Map();
const refreshingBy = new Map();
const REFRESH_TTL = 2000; // ms — හැම message එකටම Mongo hit වෙන එක අඩු කරනවා
async function refreshSettings(force = false) {
  const key = botKeyNow();
  if (!force && Date.now() - (lastRefreshBy.get(key) || 0) < REFRESH_TTL) return settingsOf(key);
  if (refreshingBy.has(key)) { await refreshingBy.get(key); return settingsOf(key); }
  const job = (async () => {
    try {
      if (settingsLib && typeof settingsLib.load === "function") {
        const prevOnline = settingsOf(key).alwaysOnline;
        await settingsLib.load();
        const s = settingsLib.get ? settingsLib.get() : {};
        // keys normalize (autoSeen / auto_seen / AUTOSEEN -> autoseen) — camelCase DB keys වුණත් වැඩ කරනවා
        const L = Object.fromEntries(Object.entries(s || {}).map(([k, v]) => [k.toLowerCase().replace(/[_\s-]/g, ""), v]));
        const wtype = L.worktype;
        settingsByBot.set(key, {
          ...settingsOf(key),
          prefix: L.prefix || settings.prefix,
          autoSeen: L.autoseen ?? settings.autoSeen,
          autoReact: L.autoreact ?? settings.autoReact,
          autoTyping: L.autotyping ?? settings.autoTyping,
          statusSeen: L.autoviewstatus ?? settings.statusSeen,
          alwaysOnline: L.alwaysonline ?? settings.alwaysOnline,
          antiCall: L.callreject ?? settings.antiCall,
          ownerOnly: wtype === "owner",
          public: wtype === "public",
          reactEmoji: L.reactemoji || settings.reactEmoji,
          statusReact: L.autoreactstatus ?? settings.statusReact,
          statusEmoji: L.statusemoji || settings.statusEmoji || "❤️",
          antiDelete: L.antidelete ?? settings.antiDelete,
          antiViewOnce: L.antiviewonce ?? L.antivv ?? settings.antiViewOnce,
          antiEdit: L.antiedit ?? settings.antiEdit,
          reconnect: L.autoreconnect ?? settings.reconnect,
          debug: L.debug ?? settings.debug,
          workType: wtype || settings.workType,
          language: L.language || settings.language,
          raw: s,
        });
        lastRefreshBy.set(key, Date.now());
        if (!key && prevOnline !== settingsOf(key).alwaysOnline) syncPresence();
      }
    } catch (e) {
      log("⚠️ Settings refresh error:", e.message);
    }
  })();
  refreshingBy.set(key, job);
  try { await job; } finally { refreshingBy.delete(key); }
  return settingsOf(key);
}

try {
  const m = await import(pathToFileURL(path.join(PLUGIN_DIR, "settings.js")).href);
  settingsLib = m;
  if (m.load) {
    await refreshSettings(true);
    log("✅ settings.js loaded from MongoDB");
  } else if (m.settings) {
    settingsByBot.set("", { ...settingsOf(""), ...m.settings });
  }
} catch (e) {
  log("⚠️ settings.js load failed, default settings use කරනවා:", e.message);
}

globalThis.SHAN = { 
  get settings() { return settings; }, 
  getSettings: () => refreshSettings(true), 
  settingsLib,
  getStoredMessage: (id) => msgStore.get(id),
  get plugins() { return plugins; },
  owners: OWNERS,
};

/* =========================
MESSAGE STORE
========================= */
const botSent = new Set(); // bot ම යවපු messages (loop වළක්වන්න)
const msgStore = new Map();
const MAX_STORE = 5000;
function storeMessage(m) {
  if (!m?.key?.id || !m.message) return;
  msgStore.set(m.key.id, { key: m.key, message: m.message });
  if (msgStore.size > MAX_STORE) msgStore.delete(msgStore.keys().next().value);
}
const retryCache = {
  _m: new Map(),
  get(k) { return this._m.get(k); },
  set(k, v) { this._m.set(k, v); if (this._m.size > 5000) this._m.delete(this._m.keys().next().value); },
  del(k) { this._m.delete(k); },
  flushAll() { this._m.clear(); },
};

/* =========================
PLUGIN LOADER (FIXED - settings.js skip)
========================= */
const plugins = new Map();
const replyPlugins = [];

// features.js (anti-link, welcome, auto sticker, AI reply ... )
let F = null;
try {
  F = await import(pathToFileURL(path.join(PLUGIN_DIR, "features.js")).href);
  F.init({ dir: PLUGIN_DIR, log, plugins });
  log("✅ features.js loaded");
} catch (e) {
  log("⚠️ features.js load failed:", e.message);
}

const SELF_FILE = path.basename(fileURLToPath(import.meta.url));
async function loadPlugins() {
  // SELF_FILE skip කරනවා — නැත්නම් index එකම plugin එකක් විදියට import වෙලා දෙවෙනි bot එකක් start වෙනවා (Bad MAC / Waiting for this message)
  const files = fs.readdirSync(PLUGIN_DIR).filter((f) => f.endsWith(".js") && f !== "index.js" && f !== SELF_FILE && f !== "settings.js" && f !== "features.js");
  for (const file of files) {
    try {
      const mod = await import(pathToFileURL(path.join(PLUGIN_DIR, file)).href + `?v=${Date.now()}`);
      const p = mod.default;
      if (!p || typeof p.execute !== "function") continue;
      const names = [...new Set([].concat(p.command || [], p.commands || [], p.alias || [], p.aliases || []).map((c) => String(c).toLowerCase()))];
      if (!names.length) continue;
      names.forEach((n) => plugins.set(n, p));
      if (p.replyHandler && typeof p.handleReply === "function") replyPlugins.push(p);
    } catch (e) {
      log(`❌ ${file} load වුණේ නෑ:`, e.message);
    }
  }
  log(`✅ Plugins loaded: ${new Set(plugins.values()).size} files, ${plugins.size} commands`);
}

/* =========================
HELPERS
========================= */
function unwrap(message) {
  let m = message;
  while (m) {
    const inner = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message || m.viewOnceMessageV2Extension?.message || m.documentWithCaptionMessage?.message || m.editedMessage?.message?.protocolMessage?.editedMessage;
    if (!inner) break; m = inner;
  }
  return m;
}
function getText(m = {}) {
  let text = m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || m.buttonsResponseMessage?.selectedButtonId || m.listResponseMessage?.singleSelectReply?.selectedRowId || m.templateButtonReplyMessage?.selectedId || "";
  if (!text && m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
    try { text = JSON.parse(m.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson).id || ""; } catch {}
  }
  return String(text || "");
}
const digits = (jid = "") => jid.split("@")[0].split(":")[0].replace(/\D/g, "");


/* =========================
ANTI DELETE / ANTI VIEW ONCE / ANTI EDIT
========================= */
// sub-bot නම් owner = ඒ sub-bot එකේම number එක (main owner ට යන්නේ නෑ)
const ownerJid = (sock) => (sock?.__sub ? sock.__sub : OWNERS[0]) + "@s.whatsapp.net";
const handledIds = new Set();
function once(id) {
  if (!id || handledIds.has(id)) return false;
  handledIds.add(id);
  if (handledIds.size > 3000) handledIds.delete(handledIds.values().next().value);
  return true;
}
// LID (@lid) නම් real phone number එක (participantAlt / remoteJidAlt) තියෙනවා නම් ඒක ගන්නවා
function realJid(jid = "", alt = "") {
  if (jid.endsWith("@lid") && alt && !alt.endsWith("@lid")) return alt;
  return jid;
}
function whoWhere(key = {}) {
  const jid = key.remoteJid || "";
  const isGroup = jid.endsWith("@g.us");
  const who = isGroup
    ? realJid(key.participant || "", key.participantAlt || key.participantPn || "")
    : realJid(jid, key.remoteJidAlt || "");
  const sender = digits(who);
  const lidNote = who.endsWith("@lid") ? " _(LID)_" : "";
  return `👤 +${sender}${lidNote}\n💬 ${isGroup ? "Group: " + jid.split("@")[0] : "Private chat"}`;
}
async function resendContent(sock, to, rawMsg, header) {
  const m = unwrap(rawMsg.message);
  const type = m && Object.keys(m).find((k) => /^(image|video|audio|sticker|document)Message$/.test(k));
  if (!type) {
    const t = getText(m || {});
    await sock.sendMessage(to, { text: `${header}\n\n${t || "_(text නෙවෙයි / support නැති type එකක්)_"}` });
    return;
  }
  const buf = await sock.downloadMediaMessage({ key: rawMsg.key, message: m });
  const cap = m[type].caption || "";
  if (type === "imageMessage") await sock.sendMessage(to, { image: buf, caption: `${header}${cap ? "\n\n" + cap : ""}` });
  else if (type === "videoMessage") await sock.sendMessage(to, { video: buf, caption: `${header}${cap ? "\n\n" + cap : ""}` });
  else {
    await sock.sendMessage(to, { text: header });
    if (type === "audioMessage") await sock.sendMessage(to, { audio: buf, mimetype: m[type].mimetype || "audio/mpeg", ptt: !!m[type].ptt });
    else if (type === "stickerMessage") await sock.sendMessage(to, { sticker: buf });
    else await sock.sendMessage(to, { document: buf, mimetype: m[type].mimetype, fileName: m[type].fileName || "file" });
  }
}
async function onDeleted(sock, deletedId) {
  const orig = msgStore.get(deletedId);
  if (!orig || orig.key.fromMe || !once("del:" + deletedId + ":" + (sock.__sub || "main"))) return;
  await refreshSettings();
  if (!settings.antiDelete) return;
  const chat = orig.key.remoteJid || "";
  const isInbox = chat.endsWith("@s.whatsapp.net") || chat.endsWith("@lid");
  if (isInbox) {
    // inbox chat එකේ delete කරොත් ඒ chat එකටම ආයේ යවනවා
    await resendContent(sock, chat, orig, `🗑️ *ANTI DELETE*\n👤 +${digits(realJid(chat, orig.key.remoteJidAlt || ""))} මේ message එක delete කළා`);
  } else {
    // group / status delete -> owner ට
    await resendContent(sock, ownerJid(sock), orig, `🗑️ *ANTI DELETE*\n${whoWhere(orig.key)}`);
  }
}
function isViewOnce(raw = {}) {
  const w = raw.ephemeralMessage?.message || raw;
  if (w.viewOnceMessage || w.viewOnceMessageV2 || w.viewOnceMessageV2Extension) return true;
  const inner = unwrap(raw) || {};
  return !!(inner.imageMessage?.viewOnce || inner.videoMessage?.viewOnce || inner.audioMessage?.viewOnce);
}
async function antiHandlers(sock, m) {
  if (!m?.message || m.key?.remoteJid === "status@broadcast") return;
  const raw = m.message;
  const snap = { key: m.key, message: raw };
  const pm = raw.protocolMessage || raw.editedMessage?.message?.protocolMessage || raw.ephemeralMessage?.message?.protocolMessage;
  // 🗑️ Delete
  if (pm && (pm.type === 0 || pm.type === "REVOKE") && pm.key?.id) return onDeleted(sock, pm.key.id);
  // ✏️ Edit
  if (pm && (pm.type === 14 || pm.type === "MESSAGE_EDIT") && pm.editedMessage) {
    if (m.key.fromMe || !once("edit:" + m.key.id + ":" + (sock.__sub || "main"))) return;
    await refreshSettings();
    if (!settings.antiEdit) return;
    const old = msgStore.get(pm.key?.id);
    const oldText = old ? getText(unwrap(old.message) || {}) : "";
    const newText = getText(unwrap(pm.editedMessage) || {});
    await sock.sendMessage(ownerJid(sock), { text: `✏️ *ANTI EDIT*\n${whoWhere(m.key)}\n\n❌ *Old:* ${oldText || "_(unknown)_"}\n✅ *New:* ${newText || "_(unknown)_"}` });
    return;
  }
  // 👁️ View once
  if (!m.key.fromMe && isViewOnce(raw)) {
    if (!once("vv:" + m.key.id + ":" + (sock.__sub || "main"))) return;
    await refreshSettings();
    if (!settings.antiViewOnce) return;
    await resendContent(sock, ownerJid(sock), snap, `👁️ *ANTI VIEW ONCE*\n${whoWhere(m.key)}`);
  }
}

/* =========================
MESSAGE HANDLER
========================= */
// 🎲 Status auto react — statusEmoji "random" (නැත්නම් හිස්) නම් හැම status එකකටම වෙනස් emoji එකක්
const STATUS_EMOJIS = ["❤️", "🔥", "😂", "😍", "👍", "🙏", "😎", "🥰", "💯", "✨", "🤩", "💙", "😮", "🎉", "💚", "🤝"];
const pickStatusEmoji = () => {
  const e = settings.statusEmoji;
  return !e || String(e).toLowerCase() === "random" ? STATUS_EMOJIS[Math.floor(Math.random() * STATUS_EMOJIS.length)] : e;
};

async function handleMessage(sock, msg) {
  if (!msg?.message) return;
  if (msg.key.fromMe && botSent.has(msg.key.id)) return;

  // 📌 ඩේටාබේස් එකෙන් අලුත්ම සෙටින්ග්ස් මෙහිදී Automatically Refresh කරගනී
  await refreshSettings();

  const jid = msg.key.remoteJid;
  if (jid === "status@broadcast") {
    if (msg.key.fromMe) return;
    if (settings.statusSeen) await sock.readMessages([msg.key]).catch(() => {});
    const stPart = msg.key.participant || msg.participant;
    if (stPart && !msg.key.participant) msg.key.participant = stPart;
    log("[status]", stPart || "NO_PARTICIPANT", "| seen:", !!settings.statusSeen, "| react:", !!settings.statusReact);
    if (settings.statusReact && stPart) {
      // 1.5-4s delay (rate-limit / ban risk අඩු කරන්න) + errors console එකේ පෙන්නනවා
      setTimeout(async () => {
        try {
          const me = sock.user.id.split(":")[0] + "@s.whatsapp.net";
          const emoji = pickStatusEmoji();
          await sock.sendMessage("status@broadcast", { react: { text: emoji, key: msg.key } }, { statusJidList: [stPart, me] });
          log("[status] reacted", emoji, "→", stPart);
        } catch (e) { log("status react error:", e?.message || e); }
      }, 1500 + Math.random() * 2500);
    }
    return;
  }
  msg.message = unwrap(msg.message);
  if (!msg.message || msg.message.protocolMessage || msg.message.senderKeyDistributionMessage) return;
  const text = getText(msg.message).trim();
  const prefix = settings.prefix || ".";
  const sender = msg.key.participant || jid;
  const isOwner = msg.key.fromMe || OWNERS.includes(digits(sender));
  const fctx = { jid, text, sender, isOwner, prefix, settings, m: msg.message };
  // 🛡️ Anti Link / Spam / Bad Words / Bot — Work Type එක මොකක් වුණත් group වල වැඩ කරනවා
  if (F && jid.endsWith("@g.us") && !msg.key.fromMe && !isOwner) {
    try { if (await F.moderate(sock, msg, fctx)) return; } catch (e) { log("moderate error:", e?.message || e); }
  }
  // Work Type: public = හැමෝටම | private = inbox හැමෝටම, group වල owner විතරයි | owner = owner විතරයි
  const wt = settings.workType || (settings.ownerOnly ? "owner" : "public");
  if (!isOwner && (wt === "owner" || (wt === "private" && jid.endsWith("@g.us")))) return;
  // Auto Seen / Auto React — Work Type gate එකෙන් පස්සේ (owner mode එකේ අනිත් අයට react/seen වෙන්නේ නෑ)
  if (settings.autoSeen && !msg.key.fromMe) await sock.readMessages([msg.key]).catch(() => {});
  if (settings.autoReact && !msg.key.fromMe) {
    const emoji = settings.reactMode === "RANDOM" ? settings.randomEmojis[Math.floor(Math.random() * settings.randomEmojis.length)] : settings.reactEmoji;
    sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }).catch(() => {});
  }
  if (settings.autoTyping && !msg.key.fromMe) {
    sock.sendPresenceUpdate(settings.typingMode === "RECORDING" ? "recording" : "composing", jid).catch(() => {});
    setTimeout(() => sock.sendPresenceUpdate("paused", jid).catch(() => {}), 3000);
  }
  if (text.startsWith(prefix)) {
    const args = text.slice(prefix.length).trim().split(/\s+/);
    const name = (args.shift() || "").toLowerCase();
    const plugin = plugins.get(name);
    if (!plugin) return;
    if (plugin.premium && !isOwner) return sock.sendMessage(jid, { text: "🔒 This command is for premium users only." }, { quoted: msg });
    try { await plugin.execute(sock, msg, args, name); }
    catch (e) { log(`❌ .${name} error:`, e?.message || e); await sock.sendMessage(jid, { text: `❌ Error: ${e?.message || "Something went wrong"}` }, { quoted: msg }).catch(() => {}); }
    return;
  }
  const quotedId = msg.message.extendedTextMessage?.contextInfo?.stanzaId;
  if (quotedId && text) {
    for (const p of replyPlugins) {
      try { if (await p.handleReply(sock, msg, text)) { await refreshSettings(true); return; } } catch (e) { log("❌ handleReply error:", e?.message || e); }
    }
  }
  // 🎙️ "mk bn" / "mokada karanne" වගේ message වලට auto voice note (plugins/autovoice.js)
  try { if (await globalThis.SHAN_AUTOVOICE?.(sock, msg, text, jid)) return; } catch (e) { log("autovoice error:", e?.message || e); }
  // 🤖 Auto Sticker / Auto Download / AI Auto Reply
  if (F) { try { await F.passive(sock, msg, fctx); } catch (e) { log("passive error:", e?.message || e); } }
}

/* =========================
PAIRING NUMBER
========================= */
let pairNumber = (process.env.PAIR_NUMBER || process.env.BOT_NUMBER || "").replace(/\D/g, "");
async function getPairNumber() {
  if (pairNumber.length >= 8) return pairNumber;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  while (true) {
    const ans = await new Promise((res) => rl.question("📱 WhatsApp number එක country code එක්ක ගහන්න (e.g. 94771234567): ", res));
    const n = String(ans).replace(/\D/g, "");
    if (n.length >= 8 && n.length <= 15) { rl.close(); pairNumber = n; return n; }
    log("❌ Invalid number, ආයෙ try කරන්න.");
  }
}

/* =========================
WELCOME MESSAGE
========================= */
function buildWelcome(sock) {
  const time = new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo", dateStyle: "medium", timeStyle: "short" });
  const mode = settings.ownerOnly || settings.public === false ? "Private" : "Public";
  return ["╭━━━━━〔 🤖 *SHAAN MD V1* 〕━━━━━╮","┃ ✅ *Bot connected successfully!*","╰━━━━━━━━━━━━━━━━━━━━━━━╯","","╭─❮ 📊 *STATUS* ❯","│ 🟢 Status : *ONLINE*",`│ 📱 Number : +${sock.botNumber}`,`│ 🔣 Prefix : ${settings.prefix || "."}`,`│ 🌐 Mode : ${mode}`,`│ 📦 Plugins : ${new Set(plugins.values()).size} files • ${plugins.size} commands`,`│ 🕒 Time : ${time}`,"╰──────────────────────","",`💡 Type *${settings.prefix || "."}menu* to see all commands.`,"","⚡ _Powered by SHAAN MD V1_"].join("\n");
}
async function sendWelcome(sock) {
  if (process.env.WELCOME === "0") return;
  const caption = buildWelcome(sock);
  const botJid = sock.user.id.split(":")[0] + "@s.whatsapp.net";
  const targets = [...new Set([botJid, ...OWNERS.map((n) => n + "@s.whatsapp.net")])];
  const logoPath = path.join(PLUGIN_DIR, "logo.jpg");
  const logo = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;
  for (const jid of targets) {
    try { await sock.sendMessage(jid, logo ? { image: logo, caption } : { text: caption }); } catch (e) { log("Welcome message failed:", e?.message || e); }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

/* =========================
HOOKS  (pair.js sub-bots / plugins මේවා පාවිච්චි කරනවා)
========================= */
const ADMINS = (process.env.ADMIN_NUMBERS || "").split(",").map((n) => n.replace(/\D/g, "")).filter(Boolean);
globalThis.SHAN_GET_MESSAGE = (key) => msgStore.get(key?.id)?.message || undefined;
globalThis.SHAN_GET_SETTINGS = () => refreshSettings();
globalThis.SHAN_APPLY_PRESENCE = (s) => botCtx.run({ bot: s?.__sub || "" }, async () => {
  try { await refreshSettings(); await s.sendPresenceUpdate(settings.alwaysOnline ? "available" : "unavailable"); } catch {}
});
globalThis.SHAN_GET_SENDER = (msg) => msg?.key?.participant || msg?.key?.remoteJid || "";
globalThis.SHAN_IS_OWNER_MSG = (msg) => !!msg?.key?.fromMe || OWNERS.includes(digits(msg?.key?.participant || msg?.key?.remoteJid || ""));
globalThis.SHAN_IS_ADMIN = async (sender) => ADMINS.includes(digits(sender)) || OWNERS.includes(digits(sender));
globalThis.SHAN_SEND_WELCOME = (s, number) => botCtx.run({ bot: s?.__sub || "" }, async () => {
  await refreshSettings().catch(() => {});
  const caption = buildWelcome(s);
  const jid = number + "@s.whatsapp.net";
  const logoPath = path.join(PLUGIN_DIR, "logo.jpg");
  const logo = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;
  await s.sendMessage(jid, logo ? { image: logo, caption } : { text: caption });
});

/* =========================
SOCKET WIRING  (main bot + sub-bots දෙකටම පොදුයි)
========================= */
function wrapSocket(sock, subNumber = "") {
  sock.__sub = subNumber || "";
  Object.defineProperty(sock, "botNumber", { get: () => digits(sock.user?.id || ""), configurable: true });
  sock.downloadMediaMessage = (m) => downloadMediaMessage(m, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
  const origSend = sock.sendMessage.bind(sock);
  sock.sendMessage = async (...args) => {
    const sent = await origSend(...args);
    storeMessage(sent);
    if (sent?.key?.id) { botSent.add(sent.key.id); if (botSent.size > 3000) botSent.delete(botSent.values().next().value); }
    return sent;
  };
}

// 🎙️ Call reject කරාම text එක වෙනුවට යවන voice note එක — plugins/ folder එකට callvoice.mp3 (.ogg/.opus/.m4a/.wav) දාන්න
// ෆයිල් එක නැත්නම් කලින් වගේම callMessage text එක යනවා
const CALL_VOICE_TYPES = { opus: "audio/ogg; codecs=opus", ogg: "audio/ogg; codecs=opus", mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav" };
function getCallVoice() {
  for (const [ext, mimetype] of Object.entries(CALL_VOICE_TYPES)) {
    const f = path.join(PLUGIN_DIR, `callvoice.${ext}`);
    if (fs.existsSync(f)) { try { return { buf: fs.readFileSync(f), mimetype }; } catch {} }
  }
  return null;
}

function attachSocket(sock, { subNumber = "" } = {}) {
  wrapSocket(sock, subNumber);
  // මේ socket එකේ හැම event handler එකක්ම "මේ bot එකේ context" එකෙන් run වෙනවා (settings වෙන් වෙන්න)
  try {
    const _on = sock.ev.on.bind(sock.ev);
    const wrappedOn = (evName, fn) => _on(evName, (...a) => botCtx.run({ bot: subNumber || "" }, () => fn(...a)));
    try { sock.ev.on = wrappedOn; } catch { Object.defineProperty(sock.ev, "on", { value: wrappedOn, configurable: true, writable: true }); }
  } catch (e) { log("⚠️ per-bot settings context hook failed:", e?.message || e); }
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    for (const m of messages) {
      if (settings.debug && m.key?.remoteJid !== "status@broadcast") log("📩", subNumber ? `[sub ${subNumber}]` : "", type, m.key?.remoteJid, m.key?.fromMe ? "(fromMe)" : "", m.key?.remoteJidAlt ? `alt=${m.key.remoteJidAlt}` : "");
      // 🔎 debug: අනිත් අයගෙන් එන හැම message එකක්ම console එකේ පෙන්නනවා (bot එකට message එක ලැබෙනවද බලන්න)
      if (!m.key?.fromMe && m.key?.remoteJid !== "status@broadcast") log("[recv]", type, m.key?.remoteJid, m.message ? Object.keys(m.message)[0] : "NO_CONTENT(decrypt failed?)");
      if (LID_FIX) {
        if (m.key?.remoteJid?.endsWith("@lid") && m.key.remoteJidAlt) m.key.remoteJid = m.key.remoteJidAlt;
        if (m.key?.participant?.endsWith("@lid") && m.key.participantAlt) m.key.participant = m.key.participantAlt;
      }
      if (subNumber) m.__shanSub = subNumber;
    }
    for (const m of messages) antiHandlers(sock, m).catch((e) => log("anti error:", e?.message || e));
    for (const m of messages) storeMessage(m);
    if (type !== "notify") return;
    for (const msg of messages) handleMessage(sock, msg).catch((e) => log("handleMessage error:", e?.message || e));
  });
  sock.ev.on("group-participants.update", (ev) => {
    if (F) F.onGroupUpdate(sock, ev, refreshSettings).catch((e) => log("group event error:", e?.message || e));
  });
  sock.ev.on("messages.update", (updates) => {
    for (const u of updates) {
      if (u.update?.messageStubType === 1 && u.key?.id) onDeleted(sock, u.key.id).catch((e) => log("anti delete error:", e?.message || e));
    }
  });
  sock.ev.on("call", async (calls) => {
    await refreshSettings();
    for (const c of calls) {
      if (c.status !== "offer") continue;
      // .delcall / .setcall (plugins/callblock.js) — කාගේ හරි කෙනෙක්ගේ calls විතරක් reject කරන්න
      let who = c.callerPn || c.from || "";
      if (who.endsWith("@lid")) {
        try { who = (await sock.signalRepository?.lidMapping?.getPNForLID?.(who)) || who; } catch {}
      }
      const blockedUser = [who, c.from, c.callerPn].some((x) => x && globalThis.SHAN_IS_CALL_BLOCKED?.(x));
      if (!settings.antiCall && !blockedUser) continue;
      await sock.rejectCall(c.id, c.from).catch(() => {});
      const voice = getCallVoice();
      if (voice) await sock.sendMessage(c.from, { audio: voice.buf, mimetype: voice.mimetype, ptt: true }).catch(() => {});
      else await sock.sendMessage(c.from, { text: settings.callMessage }).catch(() => {});
      if (settings.blockCallers) await sock.updateBlockStatus(c.from, "block").catch(() => {});
    }
  });
}
globalThis.SHAN_ATTACH_SOCKET = attachSocket;

/* =========================
START BOT
========================= */
let starting = false;
let reconnectTimer = null;
function scheduleRestart(ms = 3000) { clearTimeout(reconnectTimer); reconnectTimer = setTimeout(() => startBot().catch((e) => log("restart error:", e?.message || e)), ms); }
async function startBot() {
  if (starting) return; starting = true;
  try {
    if (currentSock) { try { currentSock.ev.removeAllListeners(); currentSock.end(undefined); } catch {} currentSock = null; }
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({}));
    const sock = makeWASocket({ version, auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) }, logger, printQRInTerminal: false, browser: Browsers.ubuntu("Chrome"), markOnlineOnConnect: !!settings.alwaysOnline, syncFullHistory: false, generateHighQualityLinkPreview: false, connectTimeoutMs: 60000, defaultQueryTimeoutMs: 60000, keepAliveIntervalMs: 30000, retryRequestDelayMs: 500, msgRetryCounterCache: retryCache, getMessage: async (key) => msgStore.get(key.id)?.message || undefined });
    currentSock = sock;
    attachSocket(sock);
    let closed = false;
    sock.ev.on("creds.update", saveCreds);
    if (!sock.authState.creds.registered) {
      (async () => {
        const number = await getPairNumber();
        for (let i = 1; i <= 3 && !closed && !sock.authState.creds.registered; i++) {
          try { await new Promise((r) => setTimeout(r, 3000)); const code = await sock.requestPairingCode(number); const pretty = code?.match(/.{1,4}/g)?.join("-") || code; console.log("\n╭━━━━━━━━━━━━━━━━━━━━━━━━━━╮"); console.log(`┃  🔑 PAIRING CODE : ${pretty}`); console.log("╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯"); console.log("WhatsApp → Settings → Linked Devices → Link a Device → Link with phone number\n"); return; }
          catch (e) { log(`Pairing code attempt ${i} failed:`, e?.message || e); }
        }
      })();
    }
    sock.ev.on("connection.update", async ({ connection, lastDisconnect, receivedPendingNotifications }) => {
      if (receivedPendingNotifications) syncPresence();
      if (connection === "open") {
        log(`🟢 Connected as +${sock.botNumber}`);
        await refreshSettings(true);
        await syncPresence();
        // WhatsApp connect වුණාම online කරන නිසා, settings එකට ගැලපෙන්න ආයේ ආයේ apply කරනවා
        setTimeout(() => syncPresence(), 3000);
        setTimeout(() => syncPresence(), 10000);
        if (!globalThis.__welcomed) { globalThis.__welcomed = true; sendWelcome(sock).catch(() => {}); }
      }
      if (connection === "close") {
        closed = true; clearInterval(onlineTimer);
        const code = lastDisconnect?.error?.output?.statusCode;
        log(`🔴 Connection closed (code ${code})`);
        if (code === DisconnectReason.loggedOut) { log("Logged out — session clear කරලා අලුත් pairing code එකක් ඉල්ලනවා..."); fs.rmSync(SESSION_DIR, { recursive: true, force: true }); return scheduleRestart(3000); }
        if (code === DisconnectReason.connectionReplaced) { log("⚠️ Connection replaced — වෙන තැනක (PC/වෙන panel) එකම session එක run වෙනවා. එකක් නවත්තන්න!"); return; }
        if (settings.reconnect !== false) scheduleRestart(3000);
      }
    });
  } finally { starting = false; }
}

/* =========================
BOOT
========================= */
log("Starting SHAAN MD V1...");
await loadPlugins();
await startBot();
