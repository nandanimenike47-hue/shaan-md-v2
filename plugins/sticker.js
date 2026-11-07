// plugins/sticker.js — .sticker (.s)  image/video → sticker   |   .toimg  sticker → image
// ffmpeg-static ඕන (package.json එකේ දැනටමත් තියෙනවා)
import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { getQuoted, reply } from "./_helpers.js";

const BOT = "SHAAN MD V1";
const rid = () => Math.random().toString(36).slice(2, 9);

async function ffmpeg(args) {
  const ff = (await import("ffmpeg-static").catch(() => null))?.default;
  if (!ff) throw new Error("ffmpeg-static install වෙලා නෑ (npm i ffmpeg-static)");
  await new Promise((res, rej) => execFile(ff, args, { timeout: 90000 }, (e, _o, se) => (e ? rej(new Error(String(se || e.message).split("\n").filter(Boolean).pop())) : res())));
}

async function convert(buf, { video }) {
  const id = rid(), inp = path.join(os.tmpdir(), `st_${id}.in`), out = path.join(os.tmpdir(), `st_${id}.webp`);
  fs.writeFileSync(inp, buf);
  const vf = "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba";
  const args = video
    ? ["-y", "-i", inp, "-t", "8", "-vf", `fps=15,${vf}`, "-c:v", "libwebp", "-q:v", "50", "-loop", "0", "-preset", "default", "-an", "-vsync", "0", out]
    : ["-y", "-i", inp, "-vf", vf, "-c:v", "libwebp", "-q:v", "75", "-an", out];
  try { await ffmpeg(args); return fs.readFileSync(out); }
  finally { fs.rmSync(inp, { force: true }); fs.rmSync(out, { force: true }); }
}

async function toPng(buf) {
  const id = rid(), inp = path.join(os.tmpdir(), `st_${id}.webp`), out = path.join(os.tmpdir(), `st_${id}.png`);
  fs.writeFileSync(inp, buf);
  try { await ffmpeg(["-y", "-i", inp, out]); return fs.readFileSync(out); }
  finally { fs.rmSync(inp, { force: true }); fs.rmSync(out, { force: true }); }
}

// message එකේම media එකක් තියෙනවද (caption එකේ .sticker), නැත්නම් reply කරපු message එකද
function findMedia(msg) {
  const own = msg.message;
  const kinds = ["imageMessage", "videoMessage", "stickerMessage"];
  for (const k of kinds) if (own?.[k]) return { kind: k, message: own, key: msg.key };
  const q = getQuoted(msg);
  if (q?.message) for (const k of kinds) if (q.message[k]) {
    return { kind: k, message: q.message, key: { remoteJid: msg.key.remoteJid, id: q.id, participant: q.participant, fromMe: false } };
  }
  return null;
}

export default {
  command: ["sticker", "s", "toimg"],
  alias: ["stiker"],
  category: "tools",
  desc: "Image/video → sticker, sticker → image",
  async execute(sock, msg, args, name) {
    const m = findMedia(msg);
    if (!m) return reply(sock, msg, name === "toimg"
      ? "↩️ Sticker එකකට reply කරලා *.toimg* ගහන්න."
      : "↩️ Image / video (තත්පර 8ට අඩු) එකකට reply කරලා *.sticker* ගහන්න,\nනැත්නම් image එකක caption එකේ *.sticker* දාන්න.");
    try {
      await sock.sendMessage(msg.key.remoteJid, { react: { text: "⏳", key: msg.key } }).catch(() => {});
      const buffer = await sock.downloadMediaMessage({ key: m.key, message: m.message });
      if (name === "toimg") {
        if (m.kind !== "stickerMessage") return reply(sock, msg, "❌ Sticker එකකට විතරයි reply කරන්න.");
        if (m.message.stickerMessage.isAnimated) return reply(sock, msg, "⚠️ Animated sticker → image වලට දැනට support නෑ.");
        const png = await toPng(buffer);
        await sock.sendMessage(msg.key.remoteJid, { image: png, caption: `> ⚡ ${BOT}` }, { quoted: msg });
      } else {
        if (m.kind === "stickerMessage") return reply(sock, msg, "ℹ️ ඒක දැනටමත් sticker එකක්.");
        if (m.kind === "videoMessage" && (m.message.videoMessage.seconds || 0) > 10) return reply(sock, msg, "⚠️ Video එක තත්පර 10ට වඩා අඩු විය යුතුයි.");
        const webp = await convert(buffer, { video: m.kind === "videoMessage" });
        await sock.sendMessage(msg.key.remoteJid, { sticker: webp }, { quoted: msg });
      }
      await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
    } catch (e) {
      await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return reply(sock, msg, `❌ Failed: ${e?.message || e}`);
    }
  },
};
