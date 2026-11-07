import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { BOT_NAME, OWNER_NAME, FOOTER } from "./style.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const findPhoto = () =>
  ["owner.jpg", "owner.jpeg", "owner.png"].map((n) => path.join(dir, n)).find((p) => fs.existsSync(p));

export default {
  command: ["owner"],
  desc: "Owner contact",
  category: "MAIN",
  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    const num = (process.env.OWNER_NUMBER || "94771168937").split(",")[0].replace(/\D/g, "");

    // 1) Owner photo + details
    const photo = findPhoto();
    if (photo) {
      const caption =
        `╭━━━〔 👑 *OWNER* 👑 〕━━━╮\n` +
        `┃ 👤 Name : ${OWNER_NAME}\n` +
        `┃ 🤖 Bot : ${BOT_NAME}\n` +
        `┃ 📞 Number : +${num}\n` +
        `╰━━━━━━━━━━━━━━━━━━╯\n\n${FOOTER}`;
      await sock.sendMessage(jid, { image: fs.readFileSync(photo), caption }, { quoted: msg }).catch(() => {});
    }

    // 2) Contact card
    const vcard =
      "BEGIN:VCARD\nVERSION:3.0\n" +
      `FN:${OWNER_NAME}\n` +
      `TEL;type=CELL;type=VOICE;waid=${num}:+${num}\nEND:VCARD`;
    await sock.sendMessage(
      jid,
      { contacts: { displayName: OWNER_NAME, contacts: [{ vcard }] } },
      { quoted: msg }
    );
  },
};