import { load, buildMenu, applyCode, isMenuReply } from './settings.js';

const OWNERS = (process.env.OWNER_NUMBER || "94771168937")
  .split(",")
  .map((n) => n.replace(/\D/g, ""))
  .filter(Boolean);

function checkOwner(msg, sock) {
  const sender = msg.key.participant || msg.key.remoteJid;
  const digits = (jid = "") => jid.split("@")[0].split(":")[0].replace(/\D/g, "");
  return msg.key.fromMe || OWNERS.includes(digits(sender));
}

export default {
  command: ['settings', 'setting', 'set'],
  replyHandler: true,
  async execute(sock, msg) {
    if (!checkOwner(msg, sock)) {
      const errorText = 
        "╭━━━〔 ⚠️ *SHAAN MD - ACCESS DENIED* ⚠️ 〕━━━╮\n" +
        "┃                                                              ┃\n" +
        "┃  🚨 **UNAUTHORIZED ACCESS DETECTED!** 🚨   ┃\n" +
        "┃                                                              ┃\n" +
        "┃  Only the official owner of **SHAAN MD**      ┃\n" +
        "┃  has permission to control these settings!   ┃\n" +
        "┃                                                              ┃\n" +
        "┃  ⛔ Your unauthorized attempt has been       ┃\n" +
        "┃      strictly blocked by the system.         ┃\n" +
        "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯";
      
      await sock.sendMessage(msg.key.remoteJid, { text: errorText }, { quoted: msg });
      return;
    }

    await load();
    const from = msg.key.remoteJid;
    const botNumber = sock.user?.id?.split(':')[0] || '';
    await sock.sendMessage(from, { text: buildMenu('Owner', botNumber) }, { quoted: msg });
  },
  async handleReply(sock, msg, text) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const qText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
    if (!isMenuReply(qText)) return false;

    if (!checkOwner(msg, sock)) {
      const errorText = 
        "╭━━━〔 ⚠️ *SECURITY ALERT* ⚠️ 〕━━━╮\n" +
        "┃                                                         ┃\n" +
        "┃  🛑 **PERMISSION DENIED!** 🛑           ┃\n" +
        "┃                                                         ┃\n" +
        "┃  You do not have the rights to modify       ┃\n" +
        "┃  **SHAAN MD** bot configurations!       ┃\n" +
        "┃                                                         ┃\n" +
        "┃  ⚠️ Further attempts may result in permanent ┃\n" +
        "┃      restriction from the bot!           ┃\n" +
        "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━╯";

      await sock.sendMessage(msg.key.remoteJid, { text: errorText }, { quoted: msg });
      return true;
    }

    const result = await applyCode(text.trim());
    if (!result) return false;
    const from = msg.key.remoteJid;
    const botNumber = sock.user?.id?.split(':')[0] || '';
    await sock.sendMessage(from, { text: result }, { quoted: msg });
    await sock.sendMessage(from, { text: buildMenu('Owner', botNumber) });
    return true;
  }
}