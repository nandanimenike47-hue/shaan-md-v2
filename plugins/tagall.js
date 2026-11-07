import { groupCtx } from "./_helpers.js";

export default {
  command: ["tagall"],
  desc: "Mention everyone (admins only)",
  category: "GROUP",
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    if (!jid.endsWith("@g.us"))
      return sock.sendMessage(jid, { text: "❌ This command can only be used in groups." }, { quoted: msg });

    // groupCtx = LID / phone number දෙකම හරියට match කරනවා (owner / fromMe ත් admin විදියට ගන්නවා)
    const g = await groupCtx(sock, msg);
    if (!g?.senderAdmin)
      return sock.sendMessage(jid, { text: "🔒 Only admins can use this command." }, { quoted: msg });

    const meta = g.meta;
    const note = args.join(" ") || "📢 Attention everyone!";
    const text = `${note}\n\n` + meta.participants.map((p) => `@${p.id.split("@")[0]}`).join("\n");
    await sock.sendMessage(jid, { text, mentions: meta.participants.map((p) => p.id) }, { quoted: msg });
  },
};
