// ─────────────────────────────────────────────────────────────
// 🎞️ moviedl.js — .moviedl <නම>  (Internet Archive — public domain / free films)
// 1) .moviedl <නම>  -> result list එකක් එනවා
// 2) ඒ list message එකට reply කරලා number එක දාන්න -> download වෙලා document එකක් විදියට එනවා
// .env (optional): MOVIE_MAX_MB=300   (panel RAM/disk එකට ගැලපෙන්න)
// ─────────────────────────────────────────────────────────────
import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const pending = new Map(); // list message id -> { jid, items, at }
const TTL = 10 * 60 * 1000;
const maxBytes = () => (Number(process.env.MOVIE_MAX_MB) || 300) * 1024 * 1024;
const mb = (b) => (b / 1024 / 1024).toFixed(0) + " MB";

function cleanup() {
  const now = Date.now();
  for (const [k, v] of pending) if (now - v.at > TTL) pending.delete(k);
}

async function search(q) {
  const query = `title:(${q}) AND mediatype:movies AND (collection:feature_films OR collection:moviesandfilms)`;
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&fl[]=year&rows=8&sort[]=downloads+desc&output=json`;
  const r = await fetch(url);
  const j = await r.json();
  return (j?.response?.docs || []).map((d) => ({ id: d.identifier, title: d.title, year: d.year || "" }));
}

async function pickFile(id) {
  const r = await fetch(`https://archive.org/metadata/${id}`);
  const j = await r.json();
  const files = (j?.files || [])
    .filter((f) => /\.mp4$/i.test(f.name) && Number(f.size) > 0)
    .map((f) => ({ name: f.name, size: Number(f.size) }))
    .sort((a, b) => b.size - a.size);
  const ok = files.find((f) => f.size <= maxBytes()); // limit එක ඇතුළේ ඇති ලොකුම quality එක
  return { file: ok, smallest: files[files.length - 1] };
}

async function download(sock, msg, item) {
  const jid = msg.key.remoteJid;
  const say = (text) => sock.sendMessage(jid, { text }, { quoted: msg });
  const { file, smallest } = await pickFile(item.id);
  if (!file) {
    const hint = smallest ? `(කුඩාම file එක ${mb(smallest.size)}, limit ${mb(maxBytes())})` : "(mp4 file එකක් නෑ)";
    return say(`⚠️ *${item.title}* WhatsApp එකට යවන්න බෑ ${hint}\n🔗 https://archive.org/details/${item.id}`);
  }
  await say(`⏬ *${item.title}* download වෙනවා... (${mb(file.size)})\nඉවසන්න ටිකක් ⏳`);

  const tmp = path.join(os.tmpdir(), `movie_${Date.now()}.mp4`);
  try {
    const res = await fetch(`https://archive.org/download/${item.id}/${encodeURIComponent(file.name)}`);
    if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`);
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp)); // RAM එකට load කරන්නේ නෑ, disk එකට stream
    await sock.sendMessage(
      jid,
      {
        document: { url: tmp },
        mimetype: "video/mp4",
        fileName: `${item.title}.mp4`.replace(/[\\/:*?"<>|]/g, ""),
        caption: `🎞️ *${item.title}* ${item.year}\n\n⚡ _SHAAN MD V1_`,
      },
      { quoted: msg }
    );
  } finally {
    fs.rm(tmp, { force: true }, () => {});
  }
}

export default {
  command: "moviedl",
  alias: ["mdl", "freemovie"],
  replyHandler: true,

  async execute(sock, msg, args) {
    cleanup();
    const jid = msg.key.remoteJid;
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });
    const q = args.join(" ").trim();
    if (!q) return reply("🎞️ *Usage:* .moviedl <නම>\nඋදා: .moviedl Nosferatu\n\n_Public domain / free films විතරයි (archive.org)_");

    const items = await search(q);
    if (!items.length) return reply(`❌ "${q}" සඳහා free movie එකක් හම්බුනේ නෑ.`);

    const list = items.map((x, i) => `*${i + 1}.* ${x.title} ${x.year ? `(${x.year})` : ""}`).join("\n");
    const sent = await sock.sendMessage(
      jid,
      { text: `🎞️ *MOVIE RESULTS*\n\n${list}\n\n↩️ ඕන එකේ number එක මේ message එකට *reply* කරන්න.` },
      { quoted: msg }
    );
    if (sent?.key?.id) pending.set(sent.key.id, { items, at: Date.now() });
  },

  // index.js එකේ replyPlugins loop එකෙන් call වෙනවා
  async handleReply(sock, msg, text) {
    const quotedId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
    const entry = pending.get(quotedId);
    if (!entry) return false;
    const n = parseInt(text.trim(), 10);
    if (!n || n < 1 || n > entry.items.length) {
      await sock.sendMessage(msg.key.remoteJid, { text: `❌ 1 - ${entry.items.length} අතර number එකක් දාන්න.` }, { quoted: msg });
      return true;
    }
    pending.delete(quotedId);
    try {
      await download(sock, msg, entry.items[n - 1]);
    } catch (e) {
      await sock.sendMessage(msg.key.remoteJid, { text: `❌ Download error: ${e?.message || e}` }, { quoted: msg });
    }
    return true;
  },
};
