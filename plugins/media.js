import { reply, getQuoted, isOwner, groupCtx, samePerson } from "./_helpers.js";

export default {
  command: ["vv", "del", "delete"],
  async execute(sock, msg, args, name) {
    const jid = msg.key.remoteJid;
    const q = getQuoted(msg);
    if (!q) return reply(sock, msg, `↩️ Reply to a message with .${name}`);

    if (name === "vv") {
      if (!isOwner(msg)) return reply(sock, msg, "🔒 Owner only.");
      const m = q.message;
      const type = ["imageMessage", "videoMessage", "audioMessage"].find((t) => m[t]);
      if (!type) return reply(sock, msg, "❌ Reply to an image, video or voice message.");
      const buffer = await sock.downloadMediaMessage({
        key: { remoteJid: jid, id: q.id, participant: q.participant, fromMe: false },
        message: m,
      });
      const caption = m[type].caption || "";
      if (type === "imageMessage") return sock.sendMessage(jid, { image: buffer, caption }, { quoted: msg });
      if (type === "videoMessage") return sock.sendMessage(jid, { video: buffer, caption }, { quoted: msg });
      return sock.sendMessage(jid, { audio: buffer, mimetype: "audio/mp4", ptt: !!m.audioMessage.ptt }, { quoted: msg });
    }

    // del / delete
    const g = jid.endsWith("@g.us") ? await groupCtx(sock, msg) : null;
    const mine = !q.participant
      ? false
      : samePerson({ id: q.participant }, sock.user?.id) || samePerson({ id: q.participant }, sock.user?.lid);
    if (g) {
      if (!g.senderAdmin) return reply(sock, msg, "🔒 Group admins only.");
      if (!mine && !g.botAdmin) return reply(sock, msg, "⚠️ Make the bot an admin to delete others' messages.");
    }
    await sock.sendMessage(jid, {
      delete: { remoteJid: jid, fromMe: mine || !g, id: q.id, participant: q.participant },
    });
  },
};