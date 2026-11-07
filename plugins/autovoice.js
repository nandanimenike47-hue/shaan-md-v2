// ─────────────────────────────────────────────────────────────
// 🎙️ autovoice.js — inbox එකට එන ඇතැම් messages වලට auto voice note එකක් යවනවා
//   • "mk", "mk bn", "mk sudu", "mokada karanne", "මොකද කරන්නේ" ...  → autovoice.ogg
//   • "gn", "good night", "gn bn", "gn sudu", "good night sudu", "ගුඩ් නයිට් බන්" ... → gnvoice.ogg
//   • "gm", "good morning", "gm bn", "gm sudu", "ගුඩ් මෝනින් බන්" ...   → gmvoice.ogg
//   .autovoice on | off            → සේරම on/off
//   .autovoice mk|gn|gm on | off   → එක voice එකක් විතරක් on/off
//   .autovoice unread on | off     → voice යැව්වාම chat එක ආයෙ "unread" කරනවද (default ON)
//   .autovoice status              (owner only; හැම bot එකකටම (main / sub-bot) වෙන වෙනම setting)
// Voice files plugins/ folder එකට දාන්න (.ogg / .opus / .mp3 / .m4a / .wav):
//   autovoice.ogg  ,  gnvoice.ogg  ,  gmvoice.ogg
// .env (optional): AUTOVOICE_COOLDOWN_MIN=0  (0 = හැම message එකකටම; 5 = එකම කෙනාට විනාඩි 5කට සැරයක්)
// ─────────────────────────────────────────────────────────────
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.join(DIR, "autovoice.json");
const digits = (j = "") => String(j).split("@")[0].split(":")[0].replace(/\D/g, "");
const TYPES = { opus: "audio/ogg; codecs=opus", ogg: "audio/ogg; codecs=opus", mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav" };

// state: { "main": { enabled, rules: {mk,gn,gm} }, "94771234567": {...} }  — main bot එකටයි හැම sub-bot එකකටයි වෙන වෙනම
let STORE = {};
try {
  const raw = JSON.parse(fs.readFileSync(STATE, "utf8"));
  STORE = typeof raw.enabled === "boolean" ? { main: { enabled: raw.enabled } } : raw; // පරණ format එකත් අල්ලගන්නවා
} catch {}
const saveState = () => { try { fs.writeFileSync(STATE, JSON.stringify(STORE, null, 1)); } catch {} };
const botKey = (sock) => sock?.__sub || "main";
function stateOf(sock) {
  const k = botKey(sock);
  const st = (STORE[k] ||= {});
  if (typeof st.enabled !== "boolean") st.enabled = true;
  st.rules ||= {};
  return st;
}
const ruleOn = (st, name) => st.rules[name] !== false;

// ── Rule 1: "mk" වගේ ඒවා ─────────────────────────────────────
const FIRST = "(?:mk|mkd|mkda|mkk|mokada|mokda|mokadda|mokakda|mokkada)";
const MORE = "(?:sudu|suduu|sudhu|karanne|karnne|krnne|karanawada|wenne|bn|bng|ban|machan|machang|mchn|bro|aiya|aiye|malli|nangi|ado|dn|oya|oyaa)";
const EN = new RegExp(`^${FIRST}(?:\\s+${MORE}){0,3}$`);
// සිංහල අකුරු keyboard එක අනුව විවිධ විදියට (ෙ+් / ේ) type වෙන නිසා NFC normalize කරලා match කරනවා
const SI_FIRST = "(?:මොකද්ද|මොකද|මොකෝ|මොනාද|මොකක්ද|මක්ද|මක්කද)";
const SI_MORE = "(?:කරන්නේ|කරන්නෙ|කරනේ|කරනෙ|වෙන්නේ|වෙන්නෙ|කරනවද|කරනවාද|බන්|බං|සුදු|මචං|මචන්|අයියේ|අයියෙ|මල්ලි|නංගි|අක්කේ|අක්කෙ)";
const SI = new RegExp(`^${SI_FIRST}(?:\\s+${SI_MORE}){0,3}$`.normalize("NFC"), "u");

// ── Rule 2: Good night ──────────────────────────────────────
const GN_FIRST = "(?:gn+|g n|(?:good|gud|gd) ?(?:night+|nite+)|goodnight|gnight|gnite)";
const GN_MORE = "(?:sudu|suduu|sudhu|bn|bng|ban|machan|machang|mchn|bro|aiya|aiye|malli|nangi|ado|dn|oya|oyaa|all|everyone)";
const GN_EN = new RegExp(`^${GN_FIRST}(?:\\s+${GN_MORE}){0,3}$`);
const GN_SI_FIRST = "(?:ගුඩ්\\s?නයි(?:ට්|ය්|ට|ත්)|ශුභ රාත්‍රියක්)";
const GN_SI = new RegExp(`^${GN_SI_FIRST}(?:\\s+${SI_MORE}){0,3}$`.normalize("NFC"), "u");

// ── Rule 3: Good morning ────────────────────────────────────
const GM_FIRST = "(?:gm+|g m|(?:good|gud|gd) ?(?:morning+|mornin+|mrng+|mrnin+)|goodmorning|gmorning|gmrng)";
const GM_EN = new RegExp(`^${GM_FIRST}(?:\\s+${GN_MORE}){0,3}$`);
const GM_SI_FIRST = "(?:ගුඩ්\\s?(?:මෝ|මො|මෝර්|මොර්)නි(?:න්|ං)|සුභ උදෑසනක්)";
const GM_SI = new RegExp(`^${GM_SI_FIRST}(?:\\s+${SI_MORE}){0,3}$`.normalize("NFC"), "u");

const RULES = [
  { name: "mk", prefix: "autovoice", test: (t) => EN.test(t) || SI.test(t) },
  { name: "gn", prefix: "gnvoice", test: (t) => GN_EN.test(t) || GN_SI.test(t) },
  { name: "gm", prefix: "gmvoice", test: (t) => GM_EN.test(t) || GM_SI.test(t) },
];

function clean(text = "") {
  return String(text)
    .normalize("NFC")
    .toLowerCase()
    .replace(/[?!.,~*_]+/g, " ")
    .replace(/(.)\1{2,}/g, "$1$1") // mkkkk -> mkk
    .replace(/\s+/g, " ")
    .trim();
}

function findRule(text) {
  const t = clean(text);
  if (!t || t.length > 40) return null;
  return RULES.find((r) => r.test(t)) || null;
}

function getVoice(prefix) {
  for (const [ext, mimetype] of Object.entries(TYPES)) {
    const f = path.join(DIR, `${prefix}.${ext}`);
    if (fs.existsSync(f)) { try { return { buf: fs.readFileSync(f), mimetype }; } catch {} }
  }
  return null;
}

const lastSent = new Map(); // chat|rule -> time
const cooldownMs = () => (Number(process.env.AUTOVOICE_COOLDOWN_MIN) || 0) * 60 * 1000;

// index.js එකේ handleMessage එකෙන් call වෙනවා — true දුන්නොත් voice එක ගියා
globalThis.SHAN_AUTOVOICE = async (sock, msg, text, jid) => {
  const st = stateOf(sock);
  if (text && text.length <= 40) console.log(`[autovoice] msg from ${jid}${msg.key.fromMe ? " (fromMe)" : ""}: ${JSON.stringify(text)} | bot=${botKey(sock)} enabled=${st.enabled}`);
  if (!st.enabled || !text || msg.key.fromMe) return false;
  if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") return false; // inbox විතරයි
  const rule = findRule(text);
  if (!rule) { console.log("[autovoice] not a trigger"); return false; }
  if (!ruleOn(st, rule.name)) { console.log(`[autovoice] ${rule.name} voice is OFF`); return false; }
  const key = `${botKey(sock)}|${jid}|${rule.name}`;
  const now = Date.now();
  if (cooldownMs() > 0 && now - (lastSent.get(key) || 0) < cooldownMs()) return false;
  const voice = getVoice(rule.prefix);
  if (!voice) { console.log(`[autovoice] trigger matched (${rule.name}) but plugins/${rule.prefix}.ogg (or .mp3/.opus/.m4a/.wav) not found`); return false; }
  console.log(`[autovoice] sending ${rule.name} voice to`, jid);
  lastSent.set(key, now);
  if (lastSent.size > 500) lastSent.delete(lastSent.keys().next().value);
  try {
    await sock.sendPresenceUpdate("recording", jid).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    await sock.sendMessage(jid, { audio: voice.buf, mimetype: voice.mimetype, ptt: true });
    await sock.sendPresenceUpdate("paused", jid).catch(() => {});
  } catch (e) { console.log("[autovoice] send failed:", e?.message || e); }
  // reply එකක් යැව්වාම WhatsApp chat එක "seen" කරනවා — ඒක ආයෙ unread විදියට දානවා (.autovoice unread off කළොත් නෑ)
  if (st.keepUnread !== false) {
    try { await sock.chatModify({ markRead: false, lastMessages: [{ key: msg.key, messageTimestamp: msg.messageTimestamp }] }, jid); }
    catch (e) { console.log("[autovoice] keep-unread failed:", e?.message || e); }
  }
  return true;
};

export default {
  command: "autovoice",

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const reply = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });
    const sender = msg.key.participant || jid;
    const isOwner = msg.key.fromMe || (globalThis.SHAN?.owners || []).includes(digits(sender));
    if (!isOwner) return reply("🔒 Owner only command.");

    const st = stateOf(sock);
    const words = args.map((x) => x.toLowerCase());
    const onoff = words.find((w) => w === "on" || w === "off");
    const ruleName = words.find((w) => RULES.some((r) => r.name === w));
    const known = words.every((w) => w === "on" || w === "off" || w === "status" || w === "unread" || RULES.some((r) => r.name === w));
    if (!known) return reply("Usage:\n.autovoice on | off\n.autovoice mk|gn|gm on | off\n.autovoice unread on | off\n.autovoice status");

    if (onoff) {
      if (words.includes("unread")) st.keepUnread = onoff === "on";
      else if (ruleName) st.rules[ruleName] = onoff === "on";
      else st.enabled = onoff === "on";
      saveState();
    }

    const icon = (v) => (v ? "🟢 𝗢𝗡" : "🔴 𝗢𝗙𝗙");
    const lines = RULES.map((r) => `┃ ${getVoice(r.prefix) ? "✅" : "❌"} ${r.name.toUpperCase()} (${r.prefix}.ogg) : ${icon(ruleOn(st, r.name))}`);
    return reply(
      [
        "╭━━━〔 🎙️ *𝗔𝗨𝗧𝗢 𝗩𝗢𝗜𝗖𝗘* 〕━━━╮",
        `┃ 🤖 𝗕𝗼𝘁 : ${botKey(sock) === "main" ? "Main" : "+" + botKey(sock)}`,
        `┃ 🔘 𝗔𝗹𝗹 : ${icon(st.enabled)}`,
        `┃ 📩 𝗞𝗲𝗲𝗽 𝘂𝗻𝗿𝗲𝗮𝗱 : ${icon(st.keepUnread !== false)}`,
        ...lines,
        "╰━━━━━━━━━━━━━━━━━━╯",
        "💡 .autovoice off  |  .autovoice gn off",
        "⚡ *SHAAN MD V1*",
      ].join("\n")
    );
  },
};
