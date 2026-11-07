export default {
  command: ["jid", "id"],
  desc: "Get chat / user JID",
  category: "TOOLS",
  async execute(sock, msg) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const target = ctx?.participant || msg.key.participant || msg.key.remoteJid;
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: `💬 *Chat:* ${msg.key.remoteJid}\n👤 *User:* ${target}` },
      { quoted: msg }
    );
  },
};