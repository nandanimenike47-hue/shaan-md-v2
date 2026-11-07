// plugins/channel.js — WhatsApp Channel එකට songs / media යවන්න (owner only)
//   .chset <channel link>            → default channel එක save කරනවා
//   .chsong <song name>              → song එක හොයලා channel එකට යවනවා
//   .chsong <channel link> <name>    → වෙන channel එකකට
//   .chsend  (audio/image/video එකකට reply)  → channel එකට forward කරනවා
// සටහන: bot ගේ number එක ඒ channel එකේ owner/admin වෙන්න ඕන.
import fs from "fs";
import path from "path";
import axios from "axios";
import { reply, isOwner, getQuoted } from "./_helpers.js";
import { fetchSongBuffer } from "./song.js";

const BOT = "SHAAN MD V1";
const FILE = path.join(process.cwd(), "channel.json");
const loadCfg = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; } };
const saveCfg = (o) => fs.writeFileSync(FILE, JSON.stringify(o));

// link / invite code / jid → "...@newsletter"
async function resolveChannel(sock, input) {
  const t = String(input || "").trim();
  if (/@newsletter$/.test(t)) return t;
  const m = t.match(/whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i);
  if (!m) return null;
  const meta = await sock.newsletterMetadata("invite", m[1]);
  return meta?.id || null;
}

export default {
  command: ["chset", "chsong", "chsend"],
  category: "owner",
  desc: "WhatsApp Channel එකට songs / media යවනවා (owner)",
  async execute(sock, msg, args, name) {
    if (!isOwner(msg)) return reply(sock, msg, "🔒 Owner ට විතරයි.");
    const pf = globalThis.SHAN?.settings?.prefix || ".";
    const react = (e) => sock.sendMessage(msg.key.remoteJid, { react: { text: e, key: msg.key } }).catch(() => {});
    try {
      /* ── default channel set කරන්න ── */
      if (name === "chset") {
        if (!args[0]) return reply(sock, msg, `📢 *Usage:* ${pf}chset https://whatsapp.com/channel/XXXX`);
        const id = await resolveChannel(sock, args[0]);
        if (!id) return reply(sock, msg, "❌ Channel link එක වැරදියි.");
        saveCfg({ ...loadCfg(), channel: id });
        return reply(sock, msg, `✅ Default channel එක save කළා.\n🆔 ${id}\n\nදැන් *${pf}chsong <සින්දුවේ නම>* ගහන්න.`);
      }

      // channel එක තෝරාගන්න (args[0] link එකක් නම් ඒක, නැත්නම් saved එක)
      let target = null;
      if (args[0] && (/whatsapp\.com\/channel\//i.test(args[0]) || /@newsletter$/.test(args[0]))) {
        target = await resolveChannel(sock, args.shift());
      } else target = loadCfg().channel;
      if (!target) return reply(sock, msg, `📢 Channel එකක් set කරලා නෑ.\n${pf}chset <channel link> ගහන්න.`);

      /* ── song එකක් channel එකට ── */
      if (name === "chsong") {
        const q = args.join(" ").trim();
        if (!q) return reply(sock, msg, `🎵 *Usage:* ${pf}chsong <සින්දුවේ නම>\nඋදා: ${pf}chsong lelena`);
        await react("🔎");
        const song = await fetchSongBuffer(q);
        if (!song) return reply(sock, msg, "❌ සින්දුව හොයාගන්න / download කරන්න බැරි වුණා.");
        await react("⬆️");
        // 1) card එක (thumbnail + නම)
        if (song.thumb) {
          try {
            const img = (await axios.get(song.thumb, { responseType: "arraybuffer", timeout: 20000 })).data;
            await sock.sendMessage(target, { image: Buffer.from(img), caption: `🎧 *${song.title}*\n👤 ${song.artist || ""}\n⏱️ ${song.duration || ""}\n\n> ⚡ ${BOT}` });
          } catch (e) { console.log("channel thumb fail:", e?.message || e); }
        }
        // 2) audio එක
        await sock.sendMessage(target, { audio: song.buffer, mimetype: "audio/mpeg" });
        await react("✅");
        return reply(sock, msg, `✅ *${song.title}* channel එකට යැව්වා 📢`);
      }

      /* ── reply කරපු media channel එකට ── */
      const q = getQuoted(msg);
      const qm = q?.message;
      const kind = ["audioMessage", "imageMessage", "videoMessage"].find((k) => qm?.[k]);
      if (!kind) return reply(sock, msg, `↩️ Audio / image / video එකකට reply කරලා *${pf}chsend* ගහන්න.`);
      await react("⬆️");
      const buf = await sock.downloadMediaMessage({ key: { remoteJid: msg.key.remoteJid, id: q.id, participant: q.participant, fromMe: false }, message: qm });
      const cap = qm[kind].caption || "";
      if (kind === "audioMessage") await sock.sendMessage(target, { audio: buf, mimetype: "audio/mpeg" });
      else if (kind === "imageMessage") await sock.sendMessage(target, { image: buf, caption: cap });
      else await sock.sendMessage(target, { video: buf, caption: cap });
      await react("✅");
      return reply(sock, msg, "✅ Channel එකට යැව්වා 📢");
    } catch (e) {
      await react("❌");
      return reply(sock, msg, `❌ Failed: ${e?.message || e}\n\n• Bot number එක channel එකේ admin/owner ද?\n• Channel link එක හරිද?`);
    }
  },
};
