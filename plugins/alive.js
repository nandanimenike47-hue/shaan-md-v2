import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sendButtons } from "./_buttons.js";
import { BOT_NAME, OWNER_NAME, FOOTER, fmtUptime, infoBox } from "./style.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
// plugins folder එකේ logo.png / logo.jpg දාන්න (නැත්නම් Variables වල LOGO_URL දාන්න)
const findLogo = () =>
  ["logo.png", "logo.jpg", "logo.jpeg"].map((n) => path.join(dir, n)).find((p) => fs.existsSync(p));

export default {
  command: ["alive"],
  desc: "Bot status",
  category: "MAIN",
  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    const s = globalThis.SHAN?.settings || {};
    const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    const text =
      infoBox([
        ["🟢 Status", "ONLINE"],
        ["👑 Owner", OWNER_NAME],
        ["🤖 Bot", BOT_NAME],
        ["⏱️ Uptime", fmtUptime(process.uptime())],
        ["💾 RAM", `${mem} MB`],
        ["🔣 Prefix", s.prefix || "."],
        ["🌐 Mode", s.public === false || s.ownerOnly ? "Private" : "Public"],
      ]) +
      `\n\n_Type *${s.prefix || "."}menu* to see all commands_\n\n${FOOTER}`;

    const logo = findLogo();
    const pf = s.prefix || ".";
    const image = logo ? fs.readFileSync(logo) : (process.env.LOGO_URL ? { url: process.env.LOGO_URL } : null);
    if (await sendButtons(sock, jid, msg, {
      image, caption: text, footer: BOT_NAME,
      buttons: [{ text: "📜 Menu", id: `${pf}menu` }, { text: "🏓 Ping", id: `${pf}ping` }],
    })) return;
    try {
      if (logo) return await sock.sendMessage(jid, { image: fs.readFileSync(logo), caption: text }, { quoted: msg });
      if (process.env.LOGO_URL) return await sock.sendMessage(jid, { image: { url: process.env.LOGO_URL }, caption: text }, { quoted: msg });
    } catch {}
    await sock.sendMessage(jid, { text }, { quoted: msg });
  },
};
