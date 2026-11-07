import axios from "axios";

import { sendButtons } from "./_buttons.js";

import { spawn } from "child_process";

/* =====================================================

   SHAN MINI BOT V1 — SONG DOWNLOADER (Chamindu API)

   Fits index.js (SHAAN MD V1): execute(sock, msg, args)

   + replyHandler / handleReply(sock, msg, text)

   .song <name | youtube link>

   Reply to the card:  1 = Audio File

                       2 = Audio Document

                       3 = Voice Message

   .env  ->  CHAMA_API_KEY=your_key

   npm i axios ffmpeg-static

===================================================== */

const API_BASE = "https://api.chamindu.site/api/v1/youtube";

const API_KEY = process.env.CHAMA_API_KEY || "";

const FOOTER = "POWERED BY SHAN MINI BOT";

const MARKER = "SELECT DOWNLOAD TYPE";

const CACHE_TIME = 10 * 60 * 1000;

const REQUEST_TIMEOUT = 60000;

const QUALITIES = ["320kbps", "128kbps"];

const NOT_ORIGINAL =

    /\b(cover|remix|karaoke|instrumental|slowed|reverb|sped\s*up|nightcore|8d|reaction|tutorial|live)\b/i;

/* =====================================================

   HELPERS

===================================================== */

const str = v =>

    typeof v === "string" || typeof v === "number" ? String(v).trim() : "";

const isHttp = v => typeof v === "string" && /^https?:\/\//i.test(v);

const getJid = msg => msg?.key?.remoteJid;

const ytIdFromText = t =>

    (String(t || "").match(

        /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i

    ) || [])[1] || "";

const getVideoId = item =>

    str(item?.videoId || item?.id || item?.video_id || item?.youtubeId || item?.key);

const getTitle = item => str(item?.title || item?.name || item?.videoTitle);

const getAuthor = item =>

    str(item?.author?.name || item?.author || item?.channel || item?.uploader);

const getDuration = item =>

    str(

        item?.duration?.timestamp ||

        item?.duration?.seconds ||

        item?.duration ||

        item?.timestamp

    );

const getViews = item => str(item?.views ?? item?.view_count ?? item?.viewCount);

const getPublished = item =>

    str(

        item?.published ?? item?.ago ?? item?.uploaded ??

        item?.uploadedAt ?? item?.upload_date ?? item?.published_at

    );

const getThumbnail = item => {

    const t = item?.thumbnail || item?.image || item?.thumb || item?.thumbnailUrl;

    return isHttp(t) ? t : "";

};

function fmtDur(d) {

    const s = str(d);

    if (!s) return "N/A";

    if (!/^\d+$/.test(s)) return s;

    const n = Number(s);

    const h = Math.floor(n / 3600);

    const m = Math.floor((n % 3600) / 60);

    const sec = String(n % 60).padStart(2, "0");

    return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;

}

function fmtViews(v) {

    const s = str(v);

    if (!s) return "N/A";

    if (!/^\d+$/.test(s)) return s;

    const n = Number(s);

    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";

    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";

    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";

    return s;

}

function extractResults(data) {

    const results =

        data?.result ||

        data?.results ||

        data?.data?.results ||

        data?.data ||

        data?.videos ||

        data?.items ||

        [];

    return Array.isArray(results) ? results : [];

}

function extractDownloadUrl(data) {

    for (const o of [data?.data, data?.result, data]) {

        if (!o || typeof o !== "object") continue;

        for (const k of [

            "download_url", "downloadUrl", "download_link",

            "url", "link", "direct_url", "audio"

        ]) {

            if (isHttp(o[k]) && !/youtube\.com|youtu\.be/i.test(o[k])) {

                return o[k];

            }

        }

    }

    return "";

}

// index.js hook: SHAN_GET_SETTINGS() -> settings (prefix)

async function getPrefix() {

    try {

        const s = await globalThis.SHAN_GET_SETTINGS?.();

        return s?.prefix || globalThis.SHAN?.settings?.prefix || ".";

    } catch {

        return ".";

    }

}

const reactTo = (sock, msg, emoji) =>

    sock

        .sendMessage(getJid(msg), { react: { text: emoji, key: msg.key } })

        .catch(() => {});

// replied (quoted) message text — index.js already unwraps msg.message

function quotedTextOf(msg) {

    try {

        const m = msg?.message || {};

        const ctx =

            m.extendedTextMessage?.contextInfo ||

            m.imageMessage?.contextInfo ||

            m.videoMessage?.contextInfo;

        let q = ctx?.quotedMessage || {};

        for (let i = 0; i < 5; i += 1) {

            const w =

                q.ephemeralMessage?.message ||

                q.viewOnceMessage?.message ||

                q.viewOnceMessageV2?.message ||

                q.documentWithCaptionMessage?.message;

            if (!w) break;

            q = w;

        }

        return (

            q.conversation ||

            q.extendedTextMessage?.text ||

            q.imageMessage?.caption ||

            q.videoMessage?.caption ||

            ""

        );

    } catch {

        return "";

    }

}

/* =====================================================

   API REQUEST

===================================================== */

async function apiRequest(endpoint, params = {}) {

    const headers = { Accept: "application/json" };

    const query = { ...params };

    if (API_KEY) {

        headers["x-api-key"] = API_KEY;

        query.api_key = API_KEY;

    }

    const response = await axios.get(`${API_BASE}${endpoint}`, {

        params: query,

        headers,

        timeout: REQUEST_TIMEOUT

    });

    return response.data;

}

async function searchYouTube(query) {

    const data = await apiRequest("/search", { q: query, query, limit: 10 });

    return extractResults(data).filter(r => r && getVideoId(r) && getTitle(r));

}

async function getSongInfo(url) {

    try {

        const data = await apiRequest("/info", { url, video: url });

        return data?.data && typeof data.data === "object" ? data.data : data;

    } catch {

        return null;

    }

}

async function getMP3(url) {

    for (const quality of QUALITIES) {

        try {

            const data = await apiRequest("/mp3", { url, video: url, quality });

            const link = extractDownloadUrl(data);

            if (link) return { link, quality };

        } catch (error) {

            console.error(

                `[SONG MP3 ${quality}]`,

                error?.response?.status || "",

                error?.message || error

            );

        }

    }

    return null;

}

function pickOriginal(results, query) {

    if (!results.length) return null;

    if (NOT_ORIGINAL.test(String(query || ""))) return results[0];

    const clean = results.filter(r => !NOT_ORIGINAL.test(getTitle(r)));

    return (clean.length ? clean : results)[0];

}

/* =====================================================

   CARD CACHE

===================================================== */

const cache = new Map();

const newId = () => Math.random().toString(36).slice(2, 8);

function sweep() {

    const now = Date.now();

    for (const [k, v] of cache) {

        if (now - v.time > CACHE_TIME) cache.delete(k);

    }

}

/* =====================================================

   DOWNLOAD + VOICE CONVERT

===================================================== */

async function downloadBuffer(link) {

    const res = await axios.get(link, {

        responseType: "arraybuffer",

        timeout: 120000,

        maxContentLength: 100 * 1024 * 1024,

        headers: {

            "User-Agent":

                "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36"

        }

    });

    const buf = Buffer.from(res.data);

    const type = String(res.headers?.["content-type"] || "");

    if (buf.length < 10 * 1024 || /text\/|json|html/i.test(type)) {

        throw new Error(

            `Bad audio download (${buf.length} bytes, ${type || "unknown type"})`

        );

    }

    return buf;

}

async function ffmpegBin() {

    try {

        const mod = await import("ffmpeg-static");

        if (mod?.default) return mod.default;

    } catch {}

    return "ffmpeg";

}

async function toOpus(input) {

    const bin = await ffmpegBin();

    return new Promise((resolve, reject) => {

        const proc = spawn(bin, [

            "-hide_banner", "-loglevel", "error",

            "-i", "pipe:0",

            "-vn", "-map_metadata", "-1",

            "-c:a", "libopus", "-b:a", "48k",

            "-ac", "1", "-ar", "48000",

            "-f", "ogg", "pipe:1"

        ]);

        const out = [];

        let err = "";

        proc.stdout.on("data", d => out.push(d));

        proc.stderr.on("data", d => { err += d; });

        proc.on("error", reject);

        proc.on("close", code => {

            const buf = Buffer.concat(out);

            if (code === 0 && buf.length > 1024) resolve(buf);

            else reject(new Error(err.trim() || `ffmpeg exit ${code}`));

        });

        proc.stdin.on("error", () => {});

        proc.stdin.end(input);

    });

}

/* =====================================================

   SEND SELECTED TYPE (song only)

===================================================== */

async function sendByType(sock, msg, entry, type) {

    const jid = getJid(msg);

    const mp3 = await getMP3(`https://www.youtube.com/watch?v=${entry.videoId}`);

    if (!mp3) {

        await sock.sendMessage(

            jid,

            { text: "❌ Song download link not found.\n🔧 Please try again later." },

            { quoted: msg }

        );

        return false;

    }

    const safe =

        entry.title.replace(/[\\/:*?"<>|\n\r]/g, "").slice(0, 80) || "song";

    let buffer;

    try {

        buffer = await downloadBuffer(mp3.link);

    } catch (error) {

        console.error("[SONG DOWNLOAD]", error?.message || error);

        await sock.sendMessage(

            jid,

            { text: `❌ Unable to download the audio.\n\n📥 Download Link:\n${mp3.link}` },

            { quoted: msg }

        );

        return false;

    }

    try {

        if (type === 3) {

            try {

                const opus = await toOpus(buffer);

                await sock.sendMessage(

                    jid,

                    { audio: opus, mimetype: "audio/ogg; codecs=opus", ptt: true },

                    { quoted: msg }

                );

                return true;

            } catch (error) {

                console.error("[SONG VOICE]", error?.message || error);

                // voice convert failed -> fall through and send normal audio

            }

        }

        if (type === 2) {

            await sock.sendMessage(

                jid,

                { document: buffer, mimetype: "audio/mpeg", fileName: `${safe}.mp3` },

                { quoted: msg }

            );

        } else {

            await sock.sendMessage(

                jid,

                { audio: buffer, mimetype: "audio/mpeg", fileName: `${safe}.mp3` },

                { quoted: msg }

            );

        }

        return true;

    } catch (error) {

        console.error("[SONG SEND]", error?.message || error);

        await sock.sendMessage(

            jid,

            { text: `❌ Unable to send the audio file.\n\n📥 Download Link:\n${mp3.link}` },

            { quoted: msg }

        );

        return false;

    }

}

/* =====================================================

   SONG INFORMATION CARD

===================================================== */

async function sendCard(sock, msg, item) {

    const jid = getJid(msg);

    const videoId = getVideoId(item) || ytIdFromText(item?.url);

    if (!videoId) {

        await sock.sendMessage(jid, { text: "❌ Invalid video URL." }, { quoted: msg });

        return false;

    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const v = {

        title: getTitle(item),

        artist: getAuthor(item),

        duration: getDuration(item),

        views: getViews(item),

        published: getPublished(item),

        thumb: getThumbnail(item)

    };

    if (!v.title || !v.artist || !v.views || !v.published || !v.duration) {

        const info = await getSongInfo(url);

        if (info) {

            v.title = v.title || getTitle(info);

            v.artist = v.artist || getAuthor(info);

            v.duration = v.duration || getDuration(info);

            v.views = v.views || getViews(info);

            v.published = v.published || getPublished(info);

            v.thumb = v.thumb || getThumbnail(info);

        }

    }

    v.title = v.title || "YouTube Song";

    v.thumb = v.thumb || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    const id = newId();

    cache.set(id, { videoId, title: v.title, time: Date.now() });

    const head =
        "╭━━━〔 👨‍💻 SHAN MD V1 〕━━━╮\n" +
        "┃\n" +
        "┃  🎧 SONG INFORMATION\n" +
        "┃  ━━━━━━━━━━━━━━━━━\n" +
        `┃  🎵 Title     : ${v.title}\n` +
        `┃  👤 Artist    : ${v.artist || "N/A"}\n` +
        `┃  👁️ Views     : ${fmtViews(v.views)}\n` +
        `┃  📅 Released  : ${v.published || "N/A"}\n` +
        `┃  ⏱️ Duration  : ${fmtDur(v.duration)}\n` +
        "┃\n";
    const caption =
        head +
        "┣━━━━━━━━━━━━━━━━━━━\n" +
        `┃  ⚙️ ${MARKER}\n` +
        "┃\n" +
        "┃  〔 1 〕 🎵 Audio File\n" +
        "┃  〔 2 〕 📁 Audio Document\n" +
        "┃  〔 3 〕 🎙️ Voice Message\n" +
        "┃\n" +
        "┣━━━━━━━━━━━━━━━━━━━\n" +
        "┃  🔧 Reply with 1, 2, or 3\n" +
        `┃  🆔 ${id}\n` +
        "┃\n" +
        "╰━━━━━━━━━━━━━━━━━━━╯\n\n" +
        `⚡ ${FOOTER} 👨‍💻`;
    // Buttons (fail වුණොත් පරණ 1/2/3 reply card එකට fallback)
    const pfx = await getPrefix();
    const sent = await sendButtons(sock, jid, msg, {
        image: { url: v.thumb },
        caption: head + "┃  👇 ඔයාට අවශ්‍ය format එක තෝරන්න\n┃\n╰━━━━━━━━━━━━━━━━━━━╯",
        footer: FOOTER,
        buttons: [
            { text: "🎵 Audio", id: `${pfx}songdl ${id} 1` },
            { text: "📁 Document", id: `${pfx}songdl ${id} 2` },
            { text: "🎙️ Voice", id: `${pfx}songdl ${id} 3` }
        ]
    });
    if (sent) return true;
    try {
        await sock.sendMessage(jid, { image: { url: v.thumb }, caption }, { quoted: msg });
    } catch {
        await sock.sendMessage(jid, { text: caption }, { quoted: msg });
    }
    return true;

}

/* =====================================================

   PLUGIN EXPORT

===================================================== */

export default {

    name: "SHAN MINI BOT SONG",

    command: "song",

    alias: ["play", "songdl"],

    category: "DOWNLOAD",

    description: "Download original YouTube songs",

    usage: ".song <song name | youtube link>",

    replyHandler: true,

    async execute(sock, msg, args, name) {
        const jid = getJid(msg);
        sweep();
        // Button එකක් ඔබපු විට: .songdl <id> <1|2|3>
        if (String(name || "").toLowerCase() === "songdl") {
            const entry = cache.get(String(args[0] || ""));
            const type = Number(args[1]);
            if (!entry || ![1, 2, 3].includes(type)) {
                return sock.sendMessage(jid, { text: "⌛ මේ card එක expire වෙලා. ආයෙ .song එකක් ගහන්න." }, { quoted: msg });
            }
            await reactTo(sock, msg, "⏳");
            const ok = await sendByType(sock, msg, entry, type);
            if (ok) await reactTo(sock, msg, "✅");
            return;
        }
        const query = args.join(" ").trim();

        if (!query) {

            const p = await getPrefix();

            return sock.sendMessage(

                jid,

                {

                    text:

                        "╭━━━〔 👨‍💻 SHAN MD V1 〕━━━╮\n" +

                        "┃\n" +

                        "┃  🎧 SONG DOWNLOADER\n" +

                        "┃  ━━━━━━━━━━━━━━━━━\n" +

                        `┃  📌 Usage: ${p}song <name | link>\n` +

                        `┃  📌 Example: ${p}song Shape of You\n` +

                        "┃\n" +

                        "╰━━━━━━━━━━━━━━━━━━━╯\n\n" +

                        `⚡ ${FOOTER}`

                },

                { quoted: msg }

            );

        }

        try {

            await reactTo(sock, msg, "⏳");

            const vid = ytIdFromText(query);

            let item;

            if (vid) {

                item = { id: vid };

            } else {

                item = pickOriginal(await searchYouTube(query), query);

                if (!item) {

                    return sock.sendMessage(

                        jid,

                        { text: "❌ No songs found.\n🔧 Try another search query." },

                        { quoted: msg }

                    );

                }

            }

            const ok = await sendCard(sock, msg, item);

            if (ok) await reactTo(sock, msg, "✅");

        } catch (error) {

            console.error(

                "[SONG]",

                error?.response?.status || "",

                error?.message || error

            );

            const unauthorized = error?.response?.status === 401;

            await sock.sendMessage(

                jid,

                {

                    text: unauthorized

                        ? "❌ API key error.\n🔧 Check CHAMA_API_KEY in .env"

                        : "❌ Song search failed.\n🔧 Please try again later."

                },

                { quoted: msg }

            );

        }

    },

    // index.js: replyPlugins -> handleReply(sock, msg, text) ; true = handled

    async handleReply(sock, msg, text) {

        try {

            const quoted = quotedTextOf(msg);

            if (!quoted.includes(MARKER)) return false;

            const jid = getJid(msg);

            const id = (quoted.match(/🆔\s*([a-z0-9]{4,8})/i) || [])[1];

            const type = Number(String(text || "").trim());

            if (![1, 2, 3].includes(type)) {

                await sock.sendMessage(

                    jid,

                    { text: "⚙️ Reply with 1, 2, or 3." },

                    { quoted: msg }

                );

                return true;

            }

            sweep();

            const entry = id ? cache.get(id) : null;

            // card belongs to another bot instance (same number) or expired -> stay silent

            if (!entry) return false;

            await reactTo(sock, msg, "⏳");

            const ok = await sendByType(sock, msg, entry, type);

            if (ok) await reactTo(sock, msg, "✅");

            return true;

        } catch (error) {

            console.error("[SONG REPLY]", error?.message || error);

            return false;

        }

    }

};



/* =====================================================
   EXPORT: channel plugin වලට (song search + mp3 buffer)
===================================================== */
export async function fetchSongBuffer(query) {
    const results = await searchYouTube(query);
    if (!results.length) return null;
    const item = pickOriginal(results, query) || results[0];
    const videoId = getVideoId(item);
    const mp3 = await getMP3(`https://www.youtube.com/watch?v=${videoId}`);
    if (!mp3) return null;
    const buffer = await downloadBuffer(mp3.link);
    return {
        title: getTitle(item),
        artist: getAuthor(item),
        duration: getDuration(item),
        thumb: getThumbnail(item),
        buffer
    };
}
