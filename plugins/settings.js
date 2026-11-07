// ============================================================
//  SHAAN MD V1 - Settings menu plugin (MongoDB + mongoose)
//  FIXED FOR REALTIME REFRESH - by Shaan
// ============================================================
import mongoose from 'mongoose';

const BOT_NAME = 'SHAAN MD V1';
const MARKER = '*SHAAN SETTINGS MENU*';

// ---------- 1. Defaults ----------
const DEFAULTS = {
  worktype: 'owner',
  prefix: '.',
  language: 'en',
  autoseen: false, autoreact: false, autotyping: false, autoreply: false,
  alwaysonline: false, callreject: false, antidelete: false,
  antiviewonce: false, antiedit: false, antilink: false, antispam: false,
  antibadwords: false, antibot: false,
  violation: 'warn',
  autoviewstatus: false, autoreactstatus: false, statusemoji: 'random',
  welcome: false, goodbye: false,
  autosticker: false, autodownload: false, autocrop: false,
  autoreconnect: true, debug: false,
};

// ---------- 2. Mongo model ----------
const Settings =
  mongoose.models.BotSettings ||
  mongoose.model(
    'BotSettings',
    new mongoose.Schema({ _id: String, data: Object }, { minimize: false })
  );

// 🤖 හැම bot එකකටම (main + sub-bots) වෙන වෙනම settings.
//    index.js එක message/event එකක් handle කරද්දී AsyncLocalStorage එකෙන් "මේ bot එක කවුද" කියලා දෙනවා
//    (globalThis.SHAN_BOT_CTX). Main bot = 'global' document, sub-bot = 'sub:<number>' document.
const botKey = () => {
  const b = globalThis.SHAN_BOT_CTX?.getStore?.()?.bot;
  return b ? `sub:${b}` : 'global';
};
const caches = new Map();

async function load() {
  const key = botKey();
  try {
    const doc = await Settings.findById(key);
    if (doc) {
      caches.set(key, { ...DEFAULTS, ...doc.data });
    } else if (key !== 'global') {
      // sub-bot එකක් පළවෙනි වතාවට — දැනට main bot එකේ තියෙන settings වලින් පටන් ගන්නවා (ඊට පස්සේ වෙන වෙනම)
      const g = await Settings.findById('global');
      caches.set(key, { ...DEFAULTS, ...(g ? g.data : {}) });
      await save();
    } else {
      caches.set(key, { ...DEFAULTS });
      await save();
    }
    const cur = caches.get(key);
    if (cur.statusemoji === '❤️' && !cur._statusRandom) { // පරණ default එක -> random (එක පාරයි)
      cur.statusemoji = 'random';
      cur._statusRandom = true;
      await save();
    }
    return cur;
  } catch (e) {
    console.log('[SETTINGS] load error:', e.message);
    if (!caches.has(key)) caches.set(key, { ...DEFAULTS });
    return caches.get(key);
  }
}

// 📌 මේ bot එකේ latest cached settings (load() එකෙන් database එකෙන් refresh වෙනවා)
const get = () => {
  const key = botKey();
  if (!caches.has(key)) caches.set(key, { ...DEFAULTS });
  return caches.get(key);
};

async function save() {
  const key = botKey();
  try {
    await Settings.updateOne({ _id: key }, { data: caches.get(key) }, { upsert: true });
  } catch (e) {
    console.log('[SETTINGS] save error:', e.message);
  }
}

// ---------- 3. Menu definition ----------
const TOGGLES = [
  ['2.1', 'autoseen', 'Auto Seen', '👁️', 'core'],
  ['2.2', 'autoreact', 'Auto React', '🤖', 'core'],
  ['2.3', 'autotyping', 'Auto Typing', '⌨️', 'core'],
  ['2.4', 'autoreply', 'AI Auto Reply', '🧠', 'core'],
  ['5.3', 'alwaysonline', 'Always Online', '📶', 'security'],
  ['7.1', 'callreject', 'Call Reject', '📞', 'security'],
  ['7.2', 'antidelete', 'Anti Delete', '🗑️', 'security'],
  ['7.3', 'antiviewonce', 'Anti View Once', '👁️', 'security'],
  ['7.4', 'antiedit', 'Anti Edit', '📝', 'security'],
  ['3.3', 'antilink', 'Anti Link', '🔗', 'security'],
  ['3.4', 'antispam', 'Anti Spam', '🚷', 'security'],
  ['7.5', 'antibadwords', 'Anti Bad Words', '🤬', 'security'],
  ['7.6', 'antibot', 'Anti Bot', '🛑', 'security'],
  ['6.1', 'autoviewstatus', 'Auto View Status', '👁️', 'status'],
  ['6.2', 'autoreactstatus', 'Auto React Status', '❤️', 'status'],
  ['3.1', 'welcome', 'Welcome Message', '👋', 'group'],
  ['3.2', 'goodbye', 'Goodbye Message', '😢', 'group'],
  ['4.1', 'autosticker', 'Auto Sticker', '🎭', 'media'],
  ['4.2', 'autodownload', 'Auto Download', '⬇️', 'media'],
  ['4.3', 'autocrop', 'Auto Crop', '✂️', 'media'],
  ['5.1', 'autoreconnect', 'Auto Reconnect', '🔁', 'media'],
  ['5.2', 'debug', 'Debug Mode', '🐞', 'media'],
];

const WORK = { '1.1': 'public', '1.2': 'private', '1.3': 'owner' };
const VIOLATIONS = ['warn', 'delete', 'kick'];
const state = (v) => (v ? '🟢 ON' : '🔴 OFF');

function buildMenu(userName = 'Owner', botNumber = '') {
  const s = get();
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const total = TOGGLES.length;
  const active = TOGGLES.filter(([, k]) => s[k] === true).length;
  const filled = Math.round((active / total) * 10);
  const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);

  const row = (code, emoji, title, val) => `┃ \`${code}\`  ${emoji} ${title}  ➜  ${val}\n`;
  const onoff = (v) => (v ? '🟢 *ON*' : '🔴 OFF');
  const toggles = (g) =>
    TOGGLES.filter((t) => t[4] === g)
      .map(([code, key, title, emoji]) => row(code, emoji, title, onoff(s[key])))
      .join('');
  const section = (title, body) =>
    `\n╭━━━━〔 ${title} 〕━━━━╮\n${body}╰━━━━━━━━━━━━━━━━━━━━╯\n`;
  const radio = (on) => (on ? '🔘' : '⚪');
  const vio = { warn: '⚠️ WARN', delete: '🗑️ DELETE', kick: '🚫 KICK' }[s.violation] || s.violation;

  let m = '';
  m += `╭━━━━━━━━━━━━━━━━━━━━╮\n`;
  m += `┃      👑 *S H A A N  M D  V 1* 👑\n`;
  m += `┃       ⚙️ _Settings Panel_\n`;
  m += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
  m += `👤 *${userName}*   📱 ${botNumber}\n`;
  m += `📅 ${date}\n`;
  m += `📊 *${active}/${total}* active  ${bar}\n`;

  m += section('⚙️ CORE CONFIG',
    `┃ 🛡️ *Work Type*\n` +
    `┃    \`1.1\` ${radio(s.worktype === 'public')} Public\n` +
    `┃    \`1.2\` ${radio(s.worktype === 'private')} Private\n` +
    `┃    \`1.3\` ${radio(s.worktype === 'owner')} Owner Only\n` +
    `┃ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n` +
    row('1.4', '📌', 'Prefix', `[ ${s.prefix} ]`) +
    row('1.5', '🌐', 'Language', s.language === 'en' ? '🇬🇧 English' : '🇱🇰 සිංහල') +
    toggles('core'));

  m += section('🛡️ PRIVACY & SECURITY',
    toggles('security') +
    `┃ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n` +
    row('7.7', '⚖️', 'Violation', vio) +
    (s.violation === 'warn' ? `┃        _3 warns = kick_\n` : ''));

  m += section('📱 STATUS',
    toggles('status') +
    row('6.4', '✨', 'React Emoji', String(s.statusemoji || 'random').toLowerCase() === 'random' ? '🎲 Random' : s.statusemoji));

  m += section('👥 GROUP', toggles('group'));
  m += section('🎨 MEDIA & SYSTEM', toggles('media'));

  m += `\n💡 *HOW TO USE*\n`;
  m += `Reply to this message with a code\n`;
  m += `› \`7.2\`  ➜ Anti Delete on/off\n`;
  m += `› \`1.4 !\`  ➜ Prefix change\n`;
  m += `› \`6.4 😍\`  ➜ Status emoji (fixed)\n`;
  m += `› \`6.4\`  ➜ Status emoji 🎲 random\n`;
  m += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  m += `💝 *${BOT_NAME}*\n`;
  m += `━━━━━━━━━━━━━━━━━━━━\n\n${MARKER}`;
  return m;
}

async function applyCode(input) {
  const parts = String(input).trim().split(/\s+/);
  const code = parts[0];
  const arg = parts.slice(1).join(' ').trim();
  // 📌 වෙනස්කම් කිරීමට පෙර ඩේටාබේස් එකෙන් ලේටස්ට් ඩේටා ලෝඩ් කරගනී
  await load();
  const s = get();
  let label;
  if (WORK[code]) {
    s.worktype = WORK[code];
    label = `Work Type ➜ ${s.worktype.toUpperCase()}`;
  } else if (code === '1.5') {
    s.language = s.language === 'en' ? 'si' : 'en';
    label = `Language ➜ ${s.language === 'en' ? 'English' : 'Sinhala'}`;
  } else if (code === '1.4') {
    if (!arg || arg.length > 3) return '⚠️ Prefix එක ඒකත් එක්කම දාන්න.\nExample: *1.4 !*';
    s.prefix = arg;
    label = `Prefix ➜ [ ${arg} ]`;
  } else if (code === '6.4') {
    if (!arg || arg.toLowerCase() === 'random') {
      s.statusemoji = 'random';
      label = 'React Emoji ➜ 🎲 Random';
    } else {
      s.statusemoji = arg;
      label = `React Emoji ➜ ${arg}`;
    }
  } else if (code === '7.7') {
    s.violation = VIOLATIONS[(VIOLATIONS.indexOf(s.violation) + 1) % VIOLATIONS.length];
    label = `Violation Action ➜ ${s.violation.toUpperCase()}`;
  } else {
    const t = TOGGLES.find((x) => x[0] === code);
    if (!t) return null;
    s[t[1]] = !s[t[1]];
    label = `${t[2]} ➜ ${state(s[t[1]])}`;
  }
  await save();
  return `✅ *${BOT_NAME}*\n${label}`;
}

const isMenuReply = (quotedText) => !!quotedText && quotedText.includes(MARKER);

export const settings = DEFAULTS;
export { load, get, save, buildMenu, applyCode, isMenuReply, MARKER };
export default { load, get, save, buildMenu, applyCode, isMenuReply, MARKER };