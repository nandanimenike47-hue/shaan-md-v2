import { sendButtons } from "./_buttons.js";
import os from "os";
// ─────────────────────────────────────────────────────────────
// downloader.js — .song  .fb  .tiktok  .insta
// Put this file in the plugins/ folder. No extra npm packages needed (uses Node 20 fetch).
// If an API dies, add a new one to the API_* lists below.
// ─────────────────────────────────────────────────────────────

const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
const MAX_MB = 60; // WhatsApp struggles with very large files

/* ── API lists (tried from the top; if one fails, the next is used) ── */
// .env එකේ SONG_API=https://example.com/ytmp3?url={url}  දැම්මොත් ඒක මුලින්ම try කරනවා (කොමා දාලා කීපයක් දාන්න පුළුවන්)
const ENV_SONG_APIS = (process.env.SONG_API || "")
  .split(",").map((x) => x.trim()).filter(Boolean)
  .map((tpl) => (u) => tpl.replace("{url}", encodeURIComponent(u)));
const API_YT = [
  ...ENV_SONG_APIS,
  (u) => `https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(u)}`,
  (u) => `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(u)}`,
  (u) => `https://apis.davidcyriltech.my.id/youtube/mp3?url=${encodeURIComponent(u)}`,
  (u) => `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(u)}`,
  (u) => `https://api.agatz.xyz/api/ytmp3?url=${encodeURIComponent(u)}`,
  (u) => `https://api.nekorinn.my.id/downloader/ytmp3?url=${encodeURIComponent(u)}`,
  (u) => `https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(u)}`,
  (u) => `https://api.giftedtech.co.ke/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(u)}`,
  (u) => `https://api.nexoracle.com/downloader/yt-audio2?apikey=free_key@maher_apis&url=${encodeURIComponent(u)}`,
  (u) => `https://api.vreden.web.id/api/v1/download/youtube/audio?url=${encodeURIComponent(u)}&quality=128`,
  (u) => `https://api.siputzx.my.id/api/dl/youtube/mp3?url=${encodeURIComponent(u)}`,
  (u) => `https://api.ryzumi.vip/api/downloader/ytmp3?url=${encodeURIComponent(u)}`,
  (u) => `https://api.elrayyxml.web.id/api/downloader/ytmp3?url=${encodeURIComponent(u)}`,
  (u) => `https://api.deline.web.id/downloader/ytmp3?url=${encodeURIComponent(u)}`,
  (u) => `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(u)}`,
];
const API_FB = [
  (u) => `https://api.vreden.my.id/api/fbdl?url=${encodeURIComponent(u)}`,
  (u) => `https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(u)}`,
  (u) => `https://apis.davidcyriltech.my.id/facebook?url=${encodeURIComponent(u)}`,
];
const API_IG = [
  (u) => `https://api.vreden.my.id/api/igdl?url=${encodeURIComponent(u)}`,
  (u) => `https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(u)}`,
  (u) => `https://apis.davidcyriltech.my.id/instagram?url=${encodeURIComponent(u)}`,
];
const API_TT = [
  (u) => `https://www.tikwm.com/api/?url=${encodeURIComponent(u)}&hd=1`,
  (u) => `https://api.vreden.my.id/api/tiktok?url=${encodeURIComponent(u)}`,
  (u) => `https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(u)}`,
];

/* ── Helpers ── */
async function getJSON(url) {
  const r = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json,*/*" },
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

function collectUrls(o, out = [], key = "") {
  if (typeof o === "string") {
    if (/^https?:\/\//i.test(o)) out.push({ key: key.toLowerCase(), url: o });
  } else if (Array.isArray(o)) {
    o.forEach((v) => collectUrls(v, out, key));
  } else if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) collectUrls(v, out, k);
  }
  return out;
}

// JSON එකේ තියෙන හොඳම media links ටික (score අනුව) ලැයිස්තුවක් විදියට දෙනවා
function pickCandidates(json, kind, inputUrl) {
  const bad = /thumb|cover|avatar|preview|poster|icon|logo|author|profile|image|banner/;
  const good =
    kind === "audio"
      ? /mp3|audio|dl|download|url|link/
      : /hdplay|hd|nowm|video|play|dl|download|url|link/;
  const seen = new Set();
  return collectUrls(json)
    .filter((x) => {
      if (x.url === inputUrl || seen.has(x.url)) return false;
      seen.add(x.url);
      if (bad.test(x.key)) return false;
      // YouTube watch page / ytimg thumbnails මීඩියා නෙවෙයි
      if (/(^https?:\/\/)(www\.|m\.|music\.)?(youtube\.com|youtu\.be|i\.ytimg\.com|ytimg\.com)\//i.test(x.url)) return false;
      return true;
    })
    .map((x) => {
      let s = 0;
      if (good.test(x.key)) s += 2;
      if (/hd/.test(x.key)) s += 1;
      if (/wmplay|watermark/.test(x.key)) s -= 3;
      if (kind === "audio" && /\.(mp3|m4a|opus|webm|aac)(\?|$)/i.test(x.url)) s += 3;
      if (/\.(mp4|mp3|m4a|jpg|jpeg|png|webp)(\?|$)/i.test(x.url)) s += 2;
      if (kind === "audio" && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(x.url)) s -= 6;
      return { ...x, s };
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.url);
}
const pickMedia = (json, kind, inputUrl) => pickCandidates(json, kind, inputUrl)[0] || null;

function pickTitle(json) {
  const d = json?.data || json?.result || json || {};
  return String(d.title || d.desc || d.caption || json?.title || "").slice(0, 200);
}

async function resolve(apis, link, kind) {
  let lastErr;
  for (const make of apis) {
    try {
      const json = await getJSON(make(link));
      const url = pickMedia(json, kind, link);
      if (url) return { url, title: pickTitle(json) };
      lastErr = new Error("media link not found");
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("all APIs failed");
}

async function downloadBuffer(url, { audio = false } = {}) {
  const r = await fetch(url, {
    headers: { "user-agent": UA, accept: "*/*" },
    signal: AbortSignal.timeout(120000),
    redirect: "follow",
  });
  if (!r.ok) throw new Error("download HTTP " + r.status);
  const type = (r.headers.get("content-type") || "").toLowerCase();
  if (/text\/html|application\/json|text\/plain/.test(type)) throw new Error("link is not a media file");
  const len = Number(r.headers.get("content-length") || 0);
  if (len > MAX_MB * 1024 * 1024) throw new Error(`File is too large (>${MAX_MB}MB)`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_MB * 1024 * 1024) throw new Error(`File is too large (>${MAX_MB}MB)`);
  if (audio && buf.length < 20 * 1024) throw new Error("downloaded file is too small / broken");
  return { buf, type };
}

async function sendMedia(sock, jid, msg, url, caption) {
  const { buf, type } = await downloadBuffer(url);
  if (type.startsWith("image/") || /\.(jpe?g|png|webp)(\?|$)/i.test(url)) {
    return sock.sendMessage(jid, { image: buf, caption }, { quoted: msg });
  }
  return sock.sendMessage(jid, { video: buf, caption, mimetype: "video/mp4" }, { quoted: msg });
}

/* ── YouTube search (no extra package) ── */
function findNode(o, key) {
  if (!o || typeof o !== "object") return null;
  if (o[key]) return o[key];
  for (const v of Object.values(o)) {
    const f = findNode(v, key);
    if (f) return f;
  }
  return null;
}

async function ytSearch(q) {
  // 1) YouTube page (consent cookie එකත් එක්ක — datacenter IP වලදී consent page එකක් එන එක වළක්වනවා)
  try {
    const r = await fetch(
      "https://www.youtube.com/results?search_query=" + encodeURIComponent(q) + "&sp=EgIQAQ%253D%253D",
      { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9", cookie: "CONSENT=YES+1; SOCS=CAI" }, signal: AbortSignal.timeout(20000) }
    );
    const html = await r.text();
    const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
    if (m) {
      const v = findNode(JSON.parse(m[1]), "videoRenderer");
      if (v?.videoId) {
        return {
          id: v.videoId,
          title: v.title?.runs?.[0]?.text || q,
          channel: v.ownerText?.runs?.[0]?.text || "",
          duration: v.lengthText?.simpleText || "",
          thumb: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        };
      }
    }
  } catch {}
  // 2) optional "yt-search" package (npm i yt-search)
  try {
    const mod = await import("yt-search").catch(() => null);
    const yts = mod?.default || mod;
    if (yts) {
      const res = await yts(q);
      const v = res?.videos?.[0];
      if (v?.videoId) return { id: v.videoId, title: v.title, channel: v.author?.name || "", duration: v.timestamp || "", thumb: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg` };
    }
  } catch {}
  // 3) search APIs
  const searchApis = [
    `https://api.vreden.my.id/api/yts?query=${encodeURIComponent(q)}`,
    `https://api.siputzx.my.id/api/s/youtube?query=${encodeURIComponent(q)}`,
    `https://apis.davidcyriltech.my.id/youtube/search?query=${encodeURIComponent(q)}`,
  ];
  for (const u of searchApis) {
    try {
      const json = await getJSON(u);
      const txt = JSON.stringify(json);
      const id = (txt.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/) || [])[1] || (txt.match(/"videoId":"([\w-]{11})"/) || [])[1];
      if (id) {
        const list = json?.data || json?.result || json?.results || [];
        const first = Array.isArray(list) ? list[0] : null;
        return { id, title: first?.title || q, channel: first?.author?.name || first?.channel || "", duration: first?.timestamp || first?.duration || "", thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
      }
    } catch {}
  }
  throw new Error("Song not found (YouTube search failed)");
}

// Local fallback: @distube/ytdl-core install කරලා තියෙනවා නම් API නැතුව කෙලින්ම download කරනවා
async function ytdlLocal(ytUrl) {
  const mod = await import("@distube/ytdl-core").catch(() => null);
  const ytdl = mod?.default || mod;
  if (!ytdl) throw new Error("ytdl-core not installed");
  const info = await ytdl.getInfo(ytUrl);
  const fmt = ytdl.chooseFormat(info.formats, { quality: "highestaudio", filter: "audioonly" });
  const chunks = [];
  let size = 0;
  await new Promise((res, rej) => {
    const st = ytdl.downloadFromInfo(info, { format: fmt, highWaterMark: 1 << 25 });
    const t = setTimeout(() => { st.destroy(); rej(new Error("ytdl timeout")); }, 120000);
    st.on("data", (c) => { size += c.length; if (size > MAX_MB * 1024 * 1024) { st.destroy(); rej(new Error(`File is too large (>${MAX_MB}MB)`)); } else chunks.push(c); });
    st.on("end", () => { clearTimeout(t); res(); });
    st.on("error", (e) => { clearTimeout(t); rej(e); });
  });
  return { buf: Buffer.concat(chunks), mime: fmt?.mimeType?.split(";")[0] || "audio/mp4", title: info.videoDetails?.title || "" };
}

// ── Fallback A: oceansaver (async job: start -> poll progress -> download_url) ──
async function oceanSaver(ytUrl) {
  const start = await getJSON(`https://p.oceansaver.in/ajax/download.php?format=mp3&url=${encodeURIComponent(ytUrl)}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`);
  const id = start?.id;
  if (!id) throw new Error("no job id");
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const pr = await getJSON(`https://p.oceansaver.in/ajax/progress.php?id=${id}`);
    if (pr?.download_url) {
      const { buf, type } = await downloadBuffer(pr.download_url, { audio: true });
      return { buf, title: start?.title || "", mime: /mp4|m4a|aac/.test(type) ? "audio/mp4" : "audio/mpeg" };
    }
  }
  throw new Error("timeout");
}

// ── Fallback B: yt-dlp binary (පළමු වතාවට GitHub එකෙන් ./bin ට download වෙනවා) ──
import fs from "fs";
import { createDecipheriv } from "crypto";
import path from "path";
import { execFile } from "child_process";
const BIN_DIR = path.join(process.cwd(), "bin");
const YTDLP = path.join(BIN_DIR, "yt-dlp");
async function ensureYtdlp() {
  if (fs.existsSync(YTDLP) && fs.statSync(YTDLP).size > 1e6) return;
  fs.mkdirSync(BIN_DIR, { recursive: true });
  const r = await fetch("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux", { signal: AbortSignal.timeout(120000), redirect: "follow" });
  if (!r.ok) throw new Error("yt-dlp download HTTP " + r.status);
  fs.writeFileSync(YTDLP, Buffer.from(await r.arrayBuffer()));
  fs.chmodSync(YTDLP, 0o755);
}
// ── Fallback C: RapidAPI "youtube-mp36" (free key: rapidapi.com → .env එකේ RAPIDAPI_KEY=...) ──
async function rapidSong(ytUrl) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY not set");
  const id = (ytUrl.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/) || [])[1];
  if (!id) throw new Error("video id not found");
  for (let i = 0; i < 8; i++) {
    const r = await fetch(`https://youtube-mp36.p.rapidapi.com/dl?id=${id}`, {
      headers: { "x-rapidapi-key": key, "x-rapidapi-host": "youtube-mp36.p.rapidapi.com" }, signal: AbortSignal.timeout(25000),
    });
    const j = await r.json();
    if (j?.link) { const { buf } = await downloadBuffer(j.link, { audio: true }); return { buf, title: j.title || "", mime: "audio/mpeg" }; }
    if (j?.status === "fail") throw new Error(j.msg || "rapidapi fail");
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new Error("rapidapi timeout");
}

async function ytdlpSong(ytUrl) {
  await ensureYtdlp();
  const tmp = path.join(process.cwd(), "tmp");
  fs.mkdirSync(tmp, { recursive: true });
  const cookies = ["cookies.txt", "cookie.txt"].map((f) => path.join(process.cwd(), f)).find((f) => fs.existsSync(f));
  // YouTube bot-check මග හරින්න player client කීපයක් පිළිවෙලට try කරනවා
  const clients = [null, "tv_embedded", "ios", "mweb", "web_safari"];
  let lastErr;
  for (const client of clients) {
    const base = path.join(tmp, "song_" + Date.now());
    const argv = ["-f", "bestaudio[ext=m4a]/bestaudio", "--no-playlist", "--max-filesize", MAX_MB + "M", "-o", base + ".%(ext)s"];
    if (client) argv.push("--extractor-args", `youtube:player_client=${client}`);
    if (cookies) argv.push("--cookies", cookies);
    argv.push(ytUrl);
    try {
      await new Promise((res, rej) =>
        execFile(YTDLP, argv, { timeout: 120000, maxBuffer: 1 << 24 }, (e, _o, se) => (e ? rej(new Error(String(se || e.message).split("\n").filter(Boolean).pop() || "yt-dlp failed")) : res())));
      const file = fs.readdirSync(tmp).find((f) => f.startsWith(path.basename(base) + "."));
      if (!file) throw new Error("yt-dlp: no output file");
      const full = path.join(tmp, file);
      const buf = fs.readFileSync(full);
      fs.rmSync(full, { force: true });
      const ext = path.extname(file).toLowerCase();
      return { buf, title: "", mime: ext === ".m4a" || ext === ".mp4" ? "audio/mp4" : ext === ".mp3" ? "audio/mpeg" : "audio/webm" };
    } catch (e) { lastErr = e; console.log(`[song] yt-dlp (${client || "default"}) failed: ${String(e.message).slice(0, 100)}`); }
  }
  throw lastErr || new Error("yt-dlp failed");
}

// ── Source 1: SaveTube (API key ඕන නෑ) — යාලුවගේ play.js එකෙන් ගත්ත ක්‍රමය ──
const ST_KEY = Buffer.from("C5D58EF67A7584E4A29F6C35BBC4EB12", "hex");
const ST_HEADERS = { "Content-Type": "application/json", Origin: "https://yt.savetube.me", "User-Agent": UA };
async function stJSON(url, body) {
  const r = await fetch(url, { method: body ? "POST" : "GET", headers: ST_HEADERS, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(25000) });
  return r.json();
}
async function saveTubeSong(ytUrl) {
  const id = (ytUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/) || [])[1];
  if (!id) throw new Error("invalid YouTube url");
  let lastErr;
  for (let i = 0; i < 2; i++) {
    try {
      const cdn = (await stJSON("https://media.savetube.vip/api/random-cdn"))?.cdn;
      if (!cdn) throw new Error("no CDN");
      const info = await stJSON(`https://${cdn}/v2/info`, { url: `https://www.youtube.com/watch?v=${id}` });
      if (!info?.data) throw new Error("empty metadata");
      const enc = Buffer.from(info.data, "base64");
      const dec = createDecipheriv("aes-128-cbc", ST_KEY, enc.subarray(0, 16));
      const meta = JSON.parse(Buffer.concat([dec.update(enc.subarray(16)), dec.final()]).toString("utf8"));
      if (!meta?.key) throw new Error("no download key");
      const dl = await stJSON(`https://${cdn}/download`, { id, downloadType: "audio", quality: "128kbps", key: meta.key });
      const url = dl?.data?.downloadUrl;
      if (!url) throw new Error(dl?.message || "no download url");
      const { buf, type } = await downloadBuffer(url, { audio: true });
      return { buf, title: meta.title || "", mime: /mp4|m4a|aac/.test(type) ? "audio/mp4" : "audio/mpeg" };
    } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 1000)); }
  }
  throw lastErr;
}

// හැම source එකම try කරනවා; fail වුණ හැම එකක්ම console එකේ ලොග් කරනවා
async function getSong(ytUrl) {
  const errs = [];
  const note = (who, e) => { const m = String(e?.message || e).slice(0, 120); errs.push(`${who}: ${m}`); console.log(`[song] ${who} failed: ${m}`); };
  try { return await saveTubeSong(ytUrl); } catch (e) { note("savetube", e); }
  for (const make of API_YT) {
    let host = "api";
    try {
      const u = make(ytUrl);
      host = new URL(u).hostname;
      const json = await getJSON(u);
      const cands = pickCandidates(json, "audio", ytUrl).slice(0, 3);
      if (!cands.length) { note(host, "no media link in response " + JSON.stringify(json).slice(0, 100)); continue; }
      for (const c of cands) {
        try {
          const { buf, type } = await downloadBuffer(c, { audio: true });
          return { buf, title: pickTitle(json), mime: /mp4|m4a|aac/.test(type) ? "audio/mp4" : "audio/mpeg" };
        } catch (e) { note(host + " (download)", e); }
      }
    } catch (e) { note(host, e); }
  }
  for (const [who, fn] of [["rapidapi", rapidSong], ["oceansaver", oceanSaver], ["yt-dlp", ytdlpSong], ["ytdl-core", ytdlLocal]]) {
    try { return await fn(ytUrl); } catch (e) { note(who, e); }
  }
  const blocked = errs.some((x) => /not a bot|sign in/i.test(x));
  throw new Error(
    `All ${errs.length} sources failed.` +
    (blocked ? "\n\nYouTube මේ server IP එක block කරලා. විසඳුම්: (1) .env එකේ RAPIDAPI_KEY=... දාන්න (rapidapi.com → youtube-mp36, free), නැත්නම් (2) YouTube cookies.txt එකක් bot ෆෝල්ඩර් එකට දාන්න, නැත්නම් (3) SONG_API=... දාන්න." : "")
  );
}

/* ── Input helpers ── */
function getQuotedText(msg) {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  return q?.conversation || q?.extendedTextMessage?.text || q?.imageMessage?.caption || q?.videoMessage?.caption || "";
}
function extractLink(args, msg) {
  const src = (args.join(" ") + " " + getQuotedText(msg)).trim();
  return (src.match(/https?:\/\/[^\s]+/i) || [])[0] || "";
}
const react = (sock, jid, msg, e) => sock.sendMessage(jid, { react: { text: e, key: msg.key } }).catch(() => {});

/* ── Button card cache (resolved links) ── */
const CACHE = new Map();
const CACHE_MS = 15 * 60 * 1000;
const newId = () => Math.random().toString(36).slice(2, 8);
const sweep = () => { const n = Date.now(); for (const [k, v] of CACHE) if (n - v.time > CACHE_MS) CACHE.delete(k); };

// mp4 -> mp3 (ffmpeg-static)
async function toMp3(buf) {
  const ff = (await import("ffmpeg-static").catch(() => null))?.default;
  if (!ff) throw new Error("ffmpeg-static install වෙලා නෑ (npm i ffmpeg-static)");
  const id = newId();
  const inp = path.join(os.tmpdir(), `dl_${id}.in`), out = path.join(os.tmpdir(), `dl_${id}.mp3`);
  fs.writeFileSync(inp, buf);
  try {
    await new Promise((res, rej) =>
      execFile(ff, ["-y", "-i", inp, "-vn", "-acodec", "libmp3lame", "-b:a", "128k", out], { timeout: 120000 }, (e) => (e ? rej(e) : res())));
    return fs.readFileSync(out);
  } finally { fs.rmSync(inp, { force: true }); fs.rmSync(out, { force: true }); }
}

const NAME = "SHAAN MD V1";
const MAP = {
  fb: { apis: API_FB, label: "Facebook", icon: "📘", re: /facebook\.com|fb\.watch|fb\.com/i },
  tiktok: { apis: API_TT, label: "TikTok", icon: "🎵", re: /tiktok\.com/i },
  insta: { apis: API_IG, label: "Instagram", icon: "📸", re: /instagram\.com/i },
};
const ALIAS = { facebook: "fb", tt: "tiktok", ig: "insta" };

/* ── Plugin ── */
export default {
  command: ["song", "play", "fb", "facebook", "tiktok", "tt", "insta", "ig", "dlget"],
  category: "download",
  desc: "Song / Facebook / TikTok / Instagram downloader",
  async execute(sock, msg, args, name) {
    const jid = msg.key.remoteJid;
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });
    try {
      sweep();
      /* ── Button එකක් ඔබපු විට: .dlget <id> <video|audio|doc> ── */
      if (name === "dlget") {
        const entry = CACHE.get(String(args[0] || ""));
        const type = String(args[1] || "");
        if (!entry || !["video", "audio", "doc"].includes(type)) return reply("⌛ මේ card එක expire වෙලා. Link එක ආයෙ එවන්න.");
        await react(sock, jid, msg, "⏳");
        const caption = `✅ *${entry.label}*${entry.title ? "\n" + entry.title : ""}\n\n> ⚡ ${NAME}`;
        if (type === "video") await sendMedia(sock, jid, msg, entry.url, caption);
        else {
          const { buf, type: mime } = await downloadBuffer(entry.url);
          const fname = (entry.title || entry.label).replace(/[\\/:*?"<>|\n\r]/g, "").slice(0, 60) || "video";
          if (type === "doc") await sock.sendMessage(jid, { document: buf, mimetype: mime.startsWith("video/") ? mime : "video/mp4", fileName: `${fname}.mp4` }, { quoted: msg });
          else await sock.sendMessage(jid, { audio: await toMp3(buf), mimetype: "audio/mpeg", fileName: `${fname}.mp3` }, { quoted: msg });
        }
        return react(sock, jid, msg, "✅");
      }

      /* ── .song ── (දැන් song.js එකෙන් handle වෙනවා; මේක backup) ── */
      if (name === "song" || name === "play") {
        const query = args.join(" ").trim() || getQuotedText(msg).trim();
        if (!query) return reply("🎵 Usage: *.song <name or YouTube link>*\nExample: .song Shape of You");
        await react(sock, jid, msg, "🔎");
        let ytUrl = (query.match(/https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\/[^\s]+/i) || [])[0];
        let info = null;
        if (!ytUrl) {
          info = await ytSearch(query);
          ytUrl = `https://www.youtube.com/watch?v=${info.id}`;
        }
        if (info) {
          await sock.sendMessage(jid, { image: { url: info.thumb }, caption: `🎵 *${info.title}*\n👤 ${info.channel}\n⏱️ ${info.duration}\n\n⏳ Downloading...` }, { quoted: msg }).catch(() => {});
        }
        await react(sock, jid, msg, "⏳");
        const { buf, title, mime } = await getSong(ytUrl);
        const fileName = (info?.title || title || "song").replace(/[\\/:*?"<>|]/g, "").slice(0, 80) || "song";
        const ext = mime === "audio/mp4" ? "m4a" : "mp3";
        try {
          await sock.sendMessage(jid, { audio: buf, mimetype: mime, fileName: `${fileName}.${ext}` }, { quoted: msg });
        } catch {
          await sock.sendMessage(jid, { document: buf, mimetype: mime, fileName: `${fileName}.${ext}` }, { quoted: msg });
        }
        return react(sock, jid, msg, "✅");
      }

      /* ── .fb / .tiktok / .insta ── */
      const key = ALIAS[name] || name;
      const cfg = MAP[key];
      const link = extractLink(args, msg);
      if (!link) return reply(`📥 Usage: *.${name} <${cfg.label} link>*`);
      if (!cfg.re.test(link)) return reply(`❌ That is not a valid ${cfg.label} link.`);
      await react(sock, jid, msg, "⏳");
      const { url, title } = await resolve(cfg.apis, link, "video");

      // 🔘 Buttons card
      const id = newId();
      CACHE.set(id, { url, title, label: cfg.label, time: Date.now() });
      const pf = globalThis.SHAN?.settings?.prefix || ".";
      const card =
        `╭━━━━━━━━━━━━━━━━━━━━━╮\n┃  ${cfg.icon}  *${cfg.label.toUpperCase()} DOWNLOADER*\n╰━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
        (title ? `📝 ${String(title).slice(0, 150)}\n\n` : "") +
        `👇 ඔයාට අවශ්‍ය format එක තෝරන්න`;
      const sent = await sendButtons(sock, jid, msg, {
        caption: card, footer: NAME,
        buttons: [
          { text: "🎬 Video", id: `${pf}dlget ${id} video` },
          { text: "🎧 Audio", id: `${pf}dlget ${id} audio` },
          { text: "📁 Document", id: `${pf}dlget ${id} doc` },
        ],
      });
      if (sent) return react(sock, jid, msg, "✅");

      // buttons fail වුණොත් කෙලින්ම video එක යවනවා
      await sendMedia(sock, jid, msg, url, `✅ *${cfg.label}*${title ? "\n" + title : ""}\n\n> ⚡ ${NAME}`);
      return react(sock, jid, msg, "✅");
    } catch (e) {
      await react(sock, jid, msg, "❌");
      return reply(`❌ Download failed: ${e?.message || e}\n\nPlease try again or use a different link.`);
    }
  },
};
