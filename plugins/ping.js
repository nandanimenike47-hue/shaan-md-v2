// ─────────────────────────────────────────────────────────────
// 🏓 ping.js — .ping  (logo + ලස්සන status card)
// plugins/logo.jpg තියෙනවා නම් ඒකත් එක්ක යනවා, නැත්නම් text විතරක්
// ─────────────────────────────────────────────────────────────
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BOT = "SHAAN MD V1";

const uptimeText = (s) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  return `${d ? d + "d " : ""}${h}h ${m}m ${x}s`;
};

function rate(ms) {
  if (ms < 200) return { dot: "🟢", label: "𝗘𝘅𝗰𝗲𝗹𝗹𝗲𝗻𝘁" };
  if (ms < 500) return { dot: "🟡", label: "𝗚𝗼𝗼𝗱" };
  if (ms < 1000) return { dot: "🟠", label: "𝗔𝘃𝗲𝗿𝗮𝗴𝗲" };
  return { dot: "🔴", label: "𝗦𝗹𝗼𝘄" };
}

const bar = (ms) => {
  const filled = Math.max(1, Math.min(10, 10 - Math.floor(ms / 120)));
  return "▰".repeat(filled) + "▱".repeat(10 - filled);
};

export default {
  command: "ping",

  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    const sentAt = Number(msg.messageTimestamp?.low ?? msg.messageTimestamp) * 1000;
    const delay = Math.max(0, Date.now() - (sentAt || Date.now()));

    sock.sendMessage(jid, { react: { text: "🏓", key: msg.key } }).catch(() => {});

    // network round-trip එකක් මනිනවා
    const t0 = Date.now();
    try { await sock.onWhatsApp(jid); } catch {}
    const speed = Date.now() - t0;

    const { dot, label } = rate(speed);
    const ram = process.memoryUsage().rss / 1024 / 1024;
    const time = new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit" });
    const date = new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Colombo", day: "2-digit", month: "short", year: "numeric" });

    const caption = [
      "╭━━━━━〔 🏓 *𝗣𝗢𝗡𝗚!* 〕━━━━━╮",
      "┃",
      `┃ ⚡ *𝗦𝗽𝗲𝗲𝗱*   ➜  ${speed} ms`,
      `┃ ${dot} *𝗦𝘁𝗮𝘁𝘂𝘀*  ➜  ${label}`,
      `┃ 📶 *𝗦𝗶𝗴𝗻𝗮𝗹*  ➜  ${bar(speed)}`,
      `┃ 📡 *𝗗𝗲𝗹𝗮𝘆*   ➜  ${delay} ms`,
      "┃",
      `┃ ⏱️ *𝗨𝗽𝘁𝗶𝗺𝗲* ➜  ${uptimeText(process.uptime())}`,
      `┃ 💾 *𝗥𝗔𝗠*     ➜  ${ram.toFixed(0)} MB / ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
      `┃ 🕐 *𝗧𝗶𝗺𝗲*    ➜  ${time}  •  ${date}`,
      `┃ 🤖 *𝗕𝗼𝘁*     ➜  ${BOT}`,
      "┃",
      "╰━━━━━━━━━━━━━━━━━━━━━━╯",
      "",
      `⚡ _𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗯𝘆 ${BOT}_`,
    ].join("\n");

    const logo = path.join(DIR, "logo.jpg");
    if (fs.existsSync(logo)) {
      return sock.sendMessage(jid, { image: fs.readFileSync(logo), caption }, { quoted: msg });
    }
    return sock.sendMessage(jid, { text: caption }, { quoted: msg });
  },
};
