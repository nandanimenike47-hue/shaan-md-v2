// plugins/menu.js — SHAAN MD V1 • stylish button menu (.menu / .listmenu / .allmenu)
import fs from "fs";
import path from "path";
import { sendButtons } from "./_buttons.js";
import { BOT_NAME, OWNER_NAME, CAT_ICONS, greeting, fmtUptime } from "./style.js";

// 𝗕𝗼𝗹𝗱 sans font (A-Z a-z 0-9)
const bold = (t) => [...String(t)].map((c) => {
  const x = c.codePointAt(0);
  if (x >= 65 && x <= 90) return String.fromCodePoint(0x1d5d4 + x - 65);
  if (x >= 97 && x <= 122) return String.fromCodePoint(0x1d5ee + x - 97);
  if (x >= 48 && x <= 57) return String.fromCodePoint(0x1d7ec + x - 48);
  return c;
}).join("");
// ꜱᴍᴀʟʟ ᴄᴀᴘꜱ
const SC = { a:"ᴀ",b:"ʙ",c:"ᴄ",d:"ᴅ",e:"ᴇ",f:"ꜰ",g:"ɢ",h:"ʜ",i:"ɪ",j:"ᴊ",k:"ᴋ",l:"ʟ",m:"ᴍ",n:"ɴ",o:"ᴏ",p:"ᴘ",q:"ǫ",r:"ʀ",s:"ꜱ",t:"ᴛ",u:"ᴜ",v:"ᴠ",w:"ᴡ",x:"x",y:"ʏ",z:"ᴢ" };
const small = (t) => [...String(t).toLowerCase()].map((c) => SC[c] || c).join("");

const NAME = bold(BOT_NAME);

// Image: bot folder එකේ menu.jpg / menu.png (නැත්නම් .env MENU_IMAGE=link)
function loadMenuImage() {
  const env = process.env.MENU_IMAGE;
  if (env && /^https?:\/\//i.test(env)) return { url: env };
  for (const f of [env, "menu.jpg", "menu.jpeg", "menu.png"].filter(Boolean))
    for (const dir of [process.cwd(), path.join(process.cwd(), "plugins")]) {
      const p = path.join(dir, f);
      if (fs.existsSync(p)) return fs.readFileSync(p);
    }
  return null;
}

// plugins වලින් category එකින් එකට command list එක හදනවා
function getCategories() {
  const map = globalThis.SHAN?.plugins;
  const cats = {};
  if (!map) return cats;
  const seen = new Set();
  for (const p of map.values()) {
    if (seen.has(p)) continue;
    seen.add(p);
    const names = [].concat(p.command || p.commands || []).map(String);
    if (!names.length) continue;
    const cat = String(p.category || p.type || "OTHER").toUpperCase();
    (cats[cat] ||= []).push(...names);
  }
  for (const k of Object.keys(cats)) cats[k] = [...new Set(cats[k])].sort();
  return cats;
}

const head = (icon, title) =>
  `╭━━━━━━━━━━━━━━━━━━━━━╮\n┃  ${icon}  ${bold(title)}\n╰━━━━━━━━━━━━━━━━━━━━━╯`;
const foot = `\n> ⚡ ${small("powered by")} ${NAME}`;

export default {
  command: ["menu", "listmenu", "allmenu"],
  category: "MAIN",
  async execute(sock, msg, args, name) {
    const jid = msg.key.remoteJid;
    const S = globalThis.SHAN?.settings || {};
    const prefix = S.prefix || ".";
    const cats = getCategories();
    const total = new Set(Object.values(cats).flat()).size;

    // ───── .listmenu : category එකින් එකට ─────
    if (name === "listmenu") {
      let t = head("📂", "LIST MENU") + "\n";
      for (const [cat, list] of Object.entries(cats)) {
        t += `\n╭─❮ ${CAT_ICONS[cat] || "📦"} *${bold(cat)}* ❯\n`;
        t += list.map((n) => `│ ◈ ${prefix}${n}`).join("\n");
        t += `\n╰──────────────────`;
      }
      return sock.sendMessage(jid, { text: t + "\n" + foot }, { quoted: msg });
    }

    // ───── .allmenu : හැම command එකක්ම ─────
    if (name === "allmenu") {
      const all = [...new Set(Object.values(cats).flat())].sort();
      const t = head("📚", "ALL MENU") + `\n\n╭─❮ 🔢 *${bold("TOTAL")}* : ${all.length} ❯\n` +
        all.map((n) => `│ ✦ ${prefix}${n}`).join("\n") + `\n╰──────────────────\n` + foot;
      return sock.sendMessage(jid, { text: t }, { quoted: msg });
    }

    // ───── .menu : image + info + buttons ─────
    const mode = S.workType || (S.ownerOnly ? "owner" : "public");
    const mem = Math.round(process.memoryUsage().rss / 1048576);
    const caption =
`╭━━━━━━━━━━━━━━━━━━━━━╮
┃   ✦ ${NAME} ✦
┃   ${small("whatsapp multi device bot")}
╰━━━━━━━━━━━━━━━━━━━━━╯

${greeting()}, *${msg.pushName || "friend"}* 👋

╭─❮ 📊 *${bold("BOT INFO")}* ❯
│ 🤖 ${small("bot")}     : ${BOT_NAME}
│ 👑 ${small("owner")}   : ${OWNER_NAME}
│ 🔣 ${small("prefix")}  : ${prefix}
│ 🌐 ${small("mode")}    : ${mode}
│ 📦 ${small("cmds")}    : ${total}
│ ⏱️ ${small("uptime")}  : ${fmtUptime(process.uptime())}
│ 💾 ${small("ram")}     : ${mem} MB
╰──────────────────

👇 *${small("choose a button below")}*`;

    const image = loadMenuImage();
    const ok = await sendButtons(sock, jid, msg, {
      image, caption, footer: `© ${BOT_NAME}`,
      buttons: [
        { text: "☰ List Menu", id: `${prefix}listmenu` },
        { text: "📚 All Menu", id: `${prefix}allmenu` },
      ],
    });
    if (ok) return;
    const fb = `${caption}\n\n▸ ${prefix}listmenu\n▸ ${prefix}allmenu`;
    try { if (image) await sock.sendMessage(jid, { image, caption: fb }, { quoted: msg }); else throw new Error("no image"); }
    catch { await sock.sendMessage(jid, { text: fb }, { quoted: msg }); }
  },
};
