// ─────────────────────────────────────────────────────────────
// save.js — .save
// Reply to a status (or any media message) with .save and the bot
// sends it to the owner's inbox.
// ─────────────────────────────────────────────────────────────

const OWNERS = (process.env.OWNER_NUMBER || "94771168937")
  .split(",")
  .map((n) => n.replace(/\D/g, ""))
  .filter(Boolean);

const digits = (jid = "") => jid.split("@")[0].split(":")[0].replace(/\D/g, "");

function unwrap(message) {
  let m = message;
  while (m) {
    const inner =
      m.ephemeralMessage?.message ||
      m.viewOnceMessage?.message ||
      m.viewOnceMessageV2?.message ||
      m.viewOnceMessageV2Extension?.message ||
      m.documentWithCaptionMessage?.message;
    if (!inner) break;
    m = inner;
  }
  return m;
}

export default {
  command: ["save"],
  category: "media",
  desc: "Save status (reply to it with .save)",

  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    const isOwner = msg.key.fromMe || OWNERS.includes(digits(sender));
    if (!isOwner) return;

    const m = unwrap(msg.message) || {};
    const ctx =
      m.extendedTextMessage?.contextInfo ||
      m.imageMessage?.contextInfo ||
      m.videoMessage?.contextInfo ||
      {};

    if (!ctx.stanzaId || !ctx.quotedMessage) {
      return sock.sendMessage(jid, { text: "⚠️ Reply to the status or message you want to save with *.save*" }, { quoted: msg });
    }

    // Use the original message stored by the bot if available, otherwise the quoted copy
    const stored = globalThis.SHAN?.getStoredMessage?.(ctx.stanzaId);
    const message = unwrap(stored?.message || ctx.quotedMessage) || {};
    const key = stored?.key || {
      remoteJid: ctx.remoteJid || "status@broadcast",
      id: ctx.stanzaId,
      participant: ctx.participant,
    };

    const type = Object.keys(message).find((k) => /^(image|video|audio|document|sticker)Message$/.test(k));
    // sub-bot එකකින් නම් ඒ sub-bot එකේම inbox එකට (main owner ට යන්නේ නෑ)
    const ownerJid = (msg.__shanSub || OWNERS[0]) + "@s.whatsapp.net";

    try {
      if (!type) {
        const text = message.conversation || message.extendedTextMessage?.text;
        if (!text) {
          return sock.sendMessage(jid, { text: "❌ This message type can't be saved." }, { quoted: msg });
        }
        await sock.sendMessage(ownerJid, { text: `📥 *Status Saved*\n\n${text}` });
      } else {
        const buf = await sock.downloadMediaMessage({ key, message });
        const cap = message[type].caption || "";
        const caption = `📥 *Status Saved*${cap ? "\n\n" + cap : ""}`;
        if (type === "imageMessage") await sock.sendMessage(ownerJid, { image: buf, caption });
        else if (type === "videoMessage") await sock.sendMessage(ownerJid, { video: buf, caption });
        else if (type === "audioMessage") await sock.sendMessage(ownerJid, { audio: buf, mimetype: message[type].mimetype || "audio/mpeg", ptt: !!message[type].ptt });
        else if (type === "stickerMessage") await sock.sendMessage(ownerJid, { sticker: buf });
        else await sock.sendMessage(ownerJid, { document: buf, mimetype: message[type].mimetype, fileName: message[type].fileName || "file" });
      }
      await sock.sendMessage(jid, { react: { text: "✅", key: msg.key } }).catch(() => {});
    } catch (e) {
      await sock.sendMessage(jid, { text: `❌ Couldn't save it: ${e?.message || "unknown error"}` }, { quoted: msg });
    }
  },
};