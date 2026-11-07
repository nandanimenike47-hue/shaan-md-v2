// ─────────────────────────────────────────────────────────────
// dp.js — .dp  .savedp
//   .dp                 -> inbox: ඒ කෙනාගේ DP | group: group එකේ DP
//   .dp @mention        -> mention කරපු කෙනාගේ DP
//   (reply) .dp         -> reply කරපු කෙනාගේ DP
//   .dp 94771234567     -> number එකේ DP
//   .dp me              -> bot number එකේ DP
//   .savedp [...]       -> උඩ විදියටම, ඒත් DP එක owner ගේ inbox එකට save කරනවා (owner only)
// ─────────────────────────────────────────────────────────────
import { isOwner, ctxInfo, digits } from "./_helpers.js";

const OWNERS = (process.env.OWNER_NUMBER || "94771168937")
  .split(",").map((n) => n.replace(/\D/g, "")).filter(Boolean);

function resolveTarget(sock, msg, args) {
  const jid = msg.key.remoteJid;
  const c = ctxInfo(msg);
  const first = (args[0] || "").toLowerCase();

  if (first === "me" || first === "bot") return { jid: sock.user.id.split(":")[0] + "@s.whatsapp.net", label: "Bot" };
  if (c.mentionedJid?.length) return { jid: c.mentionedJid[0], label: "+" + digits(c.mentionedJid[0]) };
  if (c.quotedMessage && c.participant) return { jid: c.participant, label: "+" + digits(c.participant) };
  for (const a of args) {
    const d = a.replace(/\D/g, "");
    if (d.length >= 8 && d.length <= 15) return { jid: d + "@s.whatsapp.net", label: "+" + d };
  }
  if (jid.endsWith("@g.us")) return { jid, label: "Group" };
  return { jid, label: "+" + digits(jid) };
}

async function getPicUrl(sock, jid) {
  for (const type of ["image", "preview"]) {
    try {
      const url = await sock.profilePictureUrl(jid, type, 15000);
      if (url) return url;
    } catch {}
  }
  return null;
}

async function fetchImage(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("image download HTTP " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

export default {
  command: ["dp", "getdp", "pp", "savedp", "dps"],
  category: "media",
  desc: "Get profile picture (.dp @user / reply / number)",

  async execute(sock, msg, args, name) {
    const jid = msg.key.remoteJid;
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });
    const saving = name === "savedp" || name === "dps";

    if (saving && !isOwner(msg)) return reply("🔒 Owner only.");

    const t = resolveTarget(sock, msg, args);
    await sock.sendMessage(jid, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      const url = await getPicUrl(sock, t.jid);
      if (!url) {
        await sock.sendMessage(jid, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return reply(`❌ ${t.label} ට profile picture එකක් නෑ, නැත්නම් privacy settings නිසා hide කරලා.`);
      }
      const buf = await fetchImage(url);
      const caption = `🖼️ *Profile Picture*\n👤 ${t.label}\n\n> SHAAN MD V1`;

      if (saving) {
        const owner = (msg.__shanSub || OWNERS[0]) + "@s.whatsapp.net";
        await sock.sendMessage(owner, { image: buf, caption: `📥 *DP Saved*\n👤 ${t.label}` });
        if (owner !== jid) await reply("✅ DP එක owner ගේ inbox එකට save කළා.");
      } else {
        await sock.sendMessage(jid, { image: buf, caption }, { quoted: msg });
      }
      await sock.sendMessage(jid, { react: { text: "✅", key: msg.key } }).catch(() => {});
    } catch (e) {
      await sock.sendMessage(jid, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return reply(`❌ DP එක ගන්න බැරි වුණා: ${e?.message || e}`);
    }
  },
};
