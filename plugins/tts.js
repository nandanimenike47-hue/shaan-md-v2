// plugins/tts.js — .tts <text>  (Sinhala/English voice note) • .tts en Hello world / .tts si ආයුබෝවන්
import { reply, getQuoted } from "./_helpers.js";

const LANGS = { si: "si", en: "en", ta: "ta", hi: "hi", ja: "ja", ar: "ar" };

export default {
  command: ["tts", "say"],
  category: "tools",
  desc: "Text to speech voice note",
  async execute(sock, msg, args) {
    let lang = "si";
    if (args[0] && LANGS[args[0].toLowerCase()]) lang = LANGS[args.shift().toLowerCase()];
    let text = args.join(" ").trim();
    if (!text) { const q = getQuoted(msg)?.message; text = (q?.conversation || q?.extendedTextMessage?.text || "").trim(); }
    if (!text) return reply(sock, msg, "🎤 *Usage:*\n.tts ආයුබෝවන්\n.tts en Hello world\n\nභාෂා: si, en, ta, hi, ja, ar");
    text = text.slice(0, 190);
    try {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(text)}`;
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 500) throw new Error("audio හම්බුනේ නෑ");
      await sock.sendMessage(msg.key.remoteJid, { audio: buf, mimetype: "audio/mpeg", ptt: false }, { quoted: msg });
    } catch (e) {
      return reply(sock, msg, `❌ TTS failed: ${e?.message || e}`);
    }
  },
};
