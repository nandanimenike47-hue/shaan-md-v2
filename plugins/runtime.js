import { BOT_NAME, fmtUptime } from "./style.js";

export default {
  command: ["runtime", "uptime"],
  desc: "Bot uptime",
  category: "MAIN",
  async execute(sock, msg) {
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: `╭━━〔 *${BOT_NAME}* 〕━━╮\n┃ ⏱️ Uptime : *${fmtUptime(process.uptime())}*\n╰━━━━━━━━━━━━━━━━╯` },
      { quoted: msg }
    );
  },
};