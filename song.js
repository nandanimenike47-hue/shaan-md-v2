import yts from "yt-search";

import ytdl from "@distube/ytdl-core";

import play from "play-dl";

import { spawn } from "child_process";

/* =====================================================

   SHAN MINI BOT V1 — SONG DOWNLOADER

   Blue Neon | Developer Edition

   .song <name | youtube link>

   1 = Audio File

   2 = Audio Document

   3 = Voice Message

===================================================== */

const FOOTER = "POWERED BY SHAN MINI BOT";

const MAX_RESULTS = 10;

const MAX_SECONDS = 20 * 60;

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

function getVideoId(item) {

    return str(item?.videoId || item?.id);

}

function getTitle(item) {

    return str(item?.title || item?.name);

}

function getAuthor(item) {

    return str(item?.author?.name || item?.author || item?.channel);

}

function getDuration(item) {

    return str(

        item?.duration?.timestamp ||

        item?.timestamp ||

        item?.duration?.seconds ||

        item?.duration

    );

}

function getSeconds(item) {

    return Number(item?.seconds || item?.duration?.seconds || 0) || 0;

}

function getThumbnail(item) {

    const t = item?.thumbnail || item?.image;

    return isHttp(t) ? t : "";

}

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

async function getPrefix(msg) {

    try {

        const clean = globalThis.SHAN_CLEAN_NUMBER;

        const botId = msg?.__shanSub ? clean(msg.__shanSub) : "main";

        const s = await globalThis.SHAN_GET_SETTINGS?.(botId);

        return s?.prefix || ".";

    } catch {

        return ".";

    }

}

/* =====================================================

   YOUTUBE SEARCH (yt-search)

===================================================== */

async function searchYouTube(query) {

    const r = await yts(query);

    return (r?.videos || [])

        .filter(v => v && getVideoId(v) && getTitle(v))

        .slice(0, MAX_RESULTS);

}

async function getSongInfo(videoId) {

    try {

        return await yts({ videoId });

    } catch {

        return null;

    }

}

/* =====================================================

   ORIGINAL SONG FILTER

===================================================== */

function pickOriginal(results, query) {

    if (!results.length) return null;

    if (NOT_ORIGINAL.test(String(query || ""))) return results[0];

    const clean = results.filter(r => !NOT_ORIGINAL.test(getTitle(r)));

    return (clean.length ? clean : results)[0];

}

/* =====================================================

   SELECTION CARD

===================================================== */

const MARKER = "SELECT DOWNLOAD TYPE";

const CACHE_TIME = 10 * 60 * 1000;

const cache = new Map();

const newId = () => Math.random().toString(36).slice(2, 8);

function sweep() {

    const now = Date.now();

    for (const [k, v] of cache) {

        if (now - v.time > CACHE_TIME) cache.delete(k);

    }

}

const getViews = item => str(item?.views);

const getPublished = item => str(item?.ago || item?.uploadedAt);

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

function quotedTextOf(msg) {

    try {

        let m = msg?.message;

        for (let i = 0; i < 5 && m; i += 1) {

            const w =

                m.ephemeralMessage?.message ||

                m.viewOnceMessage?.message ||

                m.viewOnceMessageV2?.message ||

                m.documentWithCaptionMessage?.message;

            if (!w) break;

            m = w;

        }

        const ctx =

            m?.extendedTextMessage?.contextInfo ||

            m?.imageMessage?.contextInfo ||

            m?.videoMessage?.contextInfo;

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

   SONG INFORMATION CARD

===================================================== */

async function sendCard(sock, msg, item) {

    const jid = getJid(msg);

    const videoId = getVideoId(item) || ytIdFromText(item?.url);

    if (!videoId) {

        await sock.sendMessage(

            jid,

            { text: "❌ Invalid video URL." },

            { quoted: msg }

        );

        return false;

    }

    const v = {

        title: getTitle(item),

        artist: getAuthor(item),

        duration: getDuration(item),

        seconds: getSeconds(item),

        views: getViews(item),

        published: getPublished(item),

        thumb: getThumbnail(item)

    };

    if (!v.title || !v.artist || !v.duration) {

        const info = await getSongInfo(videoId);

        if (info) {

            v.title = v.title || getTitle(info);

            v.artist = v.artist || getAuthor(info);

            v.duration = v.duration || getDuration(info);

            v.seconds = v.seconds || getSeconds(info);

            v.views = v.views || getViews(info);

            v.published = v.published || getPublished(info);

            v.thumb = v.thumb || getThumbnail(info);

        }

    }

    v.title = v.title || "YouTube Song";

    v.thumb = v.thumb || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    const shortTitle = v.title.length > 80 ? `${v.title.slice(0, 80)}…` : v.title;

    const id = newId();

    cache.set(id, {

        videoId,

        title: v.title,

        artist: v.artist,

        seconds: v.seconds,

        time: Date.now()

    });

    const caption =

        "╭━━━〔 👨‍💻 SHAN MINI BOT 〕━━━╮\n" +

        "┃\n" +

        "┃  🎧 SONG INFORMATION\n" +

        "┃  ━━━━━━━━━━━━━━━━━\n" +

        `┃  🎵 Title     : ${shortTitle}\n` +

        `┃  👤 Artist    : ${v.artist || "N/A"}\n` +

        `┃  👁️ Views     : ${fmtViews(v.views)}\n` +

        `┃  📅 Released  : ${v.published || "N/A"}\n` +

        `┃  ⏱️ Duration  : ${fmtDur(v.duration)}\n` +

        "┃\n" +

        "┣━━━━━━━━━━━━━━━━━━━\n" +

        "┃  ⚙️ SELECT DOWNLOAD TYPE\n" +

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

    try {

        await sock.sendMessage(

            jid,

            { image: { url: v.thumb }, caption },

            { quoted: msg }

        );

    } catch {

        await sock.sendMessage(

            jid,

            { text: caption },

            { quoted: msg }

        );

    }

    return true;

}

/* =====================================================

   DOWNLOAD (ytdl -> play-dl -> ytdl alt client)

===================================================== */

function streamToBuffer(stream) {

    return new Promise((resolve, reject) => {

        const chunks = [];

        stream.on("data", c => chunks.push(c));

        stream.on("end", () => resolve(Buffer.concat(chunks)));

        stream.on("error", reject);

    });

}

async function withTimeout(promise, ms, label) {

    let t;

    const timeout = new Promise((_, reject) => {

        t = setTimeout(() => reject(new Error(`${label} timeout`)), ms);

    });

    try {

        return await Promise.race([promise, timeout]);

    } finally {

        clearTimeout(t);

    }

}

async function downloadAudio(videoId) {

    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const errors = [];

    /* method 1: ytdl */

    try {

        const stream = ytdl(url, {

            filter: "audioonly",

            quality: "highestaudio",

            highWaterMark: 1 << 25

        });

        const buf = await withTimeout(streamToBuffer(stream), 120000, "ytdl");

        if (buf.length > 10 * 1024) return buf;

        throw new Error("empty audio");

    } catch (error) {

        errors.push(`ytdl: ${error?.message || error}`);

        console.error("[YTDL FAILED]", error?.message || error);

    }

    /* method 2: play-dl */

    try {

        const s = await play.stream(url, { quality: 2 });

        const buf = await withTimeout(streamToBuffer(s.stream), 120000, "play-dl");

        if (buf.length > 10 * 1024) return buf;

        throw new Error("empty audio");

    } catch (error) {

        errors.push(`play-dl: ${error?.message || error}`);

        console.error("[PLAY-DL FAILED]", error?.message || error);

    }

    /* method 3: ytdl with getInfo + chosen audio format */

    try {

        const info = await ytdl.getInfo(url, {

            playerClients: ["IOS", "ANDROID", "WEB"]

        });

        const format = ytdl.chooseFormat(info.formats, {

            filter: "audioonly",

            quality: "highestaudio"

        });

        const stream = ytdl.downloadFromInfo(info, {

            format,

            highWaterMark: 1 << 25

        });

        const buf = await withTimeout(streamToBuffer(stream), 120000, "ytdl-alt");

        if (buf.length > 10 * 1024) return buf;

        throw new Error("empty audio");

    } catch (error) {

        errors.push(`ytdl-alt: ${error?.message || error}`);

        console.error("[YTDL-ALT FAILED]", error?.message || error);

    }

    throw new Error(errors.join(" | "));

}

/* =====================================================

   FFMPEG

===================================================== */

async function ffmpegBin() {

    try {

        const mod = await import("ffmpeg-static");

        if (mod?.default) return mod.default;

    } catch {}

    return "ffmpeg";

}

async function runFfmpeg(input, args) {

    const bin = await ffmpegBin();

    return new Promise((resolve, reject) => {

        const proc = spawn(bin, [

            "-hide_banner", "-loglevel", "error",

            "-i", "pipe:0",

            "-vn", "-map_metadata", "-1",

            ...args,

            "pipe:1"

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

const toMp3 = input =>

    runFfmpeg(input, ["-c:a", "libmp3lame", "-b:a", "128k", "-f", "mp3"]);

const toOpus = input =>

    runFfmpeg(input, [

        "-c:a", "libopus", "-b:a", "48k",

        "-ac", "1", "-ar", "48000",

        "-f", "ogg"

    ]);

/* =====================================================

   SEND SELECTED TYPE

===================================================== */

async function sendByType(sock, msg, entry, type) {

    const jid = getJid(msg);

    if (entry.seconds && entry.seconds > MAX_SECONDS) {

        await sock.sendMessage(

            jid,

            { text: "❌ Song is too long (max 20 minutes)." },

            { quoted: msg }

        );

        return false;

    }

    const safe = entry.title

        .replace(/[\\/:*?"<>|\n\r]/g, "")

        .slice(0, 80) || "song";

    let raw;

    try {

        raw = await downloadAudio(entry.videoId);

    } catch (error) {

        console.error("[SONG DOWNLOAD]", error?.message || error);

        await sock.sendMessage(

            jid,

            { text: "❌ Unable to download the audio.\n\n🔧 Please try again later." },

            { quoted: msg }

        );

        return false;

    }

    try {

        /* ---- 3 : voice message ---- */

        if (type === 3) {

            try {

                const opus = await toOpus(raw);

                await sock.sendMessage(

                    jid,

                    {

                        audio: opus,

                        mimetype: "audio/ogg; codecs=opus",

                        ptt: true

                    },

                    { quoted: msg }

                );

                return true;

            } catch (error) {

                console.error("[SONG VOICE]", error?.message || error);

                await sock.sendMessage(

                    jid,

                    {

                        text:

                            "⚠️ Voice conversion failed.\n" +

                            "🔧 Sending as a normal audio file."

                    },

                    { quoted: msg }

                );

            }

        }

        /* ---- 1 / 2 : mp3 (fallback to original m4a/webm) ---- */

        let buffer = raw;

        let mimetype = "audio/mp4";

        let ext = "m4a";

        try {

            buffer = await toMp3(raw);

            mimetype = "audio/mpeg";

            ext = "mp3";

        } catch (error) {

            console.error("[SONG MP3]", error?.message || error);

        }

        if (type === 2) {

            await sock.sendMessage(

                jid,

                { document: buffer, mimetype, fileName: `${safe}.${ext}` },

                { quoted: msg }

            );

        } else {

            await sock.sendMessage(

                jid,

                { audio: buffer, mimetype, fileName: `${safe}.${ext}` },

                { quoted: msg }

            );

        }

    } catch (error) {

        console.error("[SONG SEND]", error?.message || error);

        await sock.sendMessage(

            jid,

            { text: "❌ Unable to send the audio file." },

            { quoted: msg }

        );

        return false;

    }

    return true;

}

/* =====================================================

   PLUGIN EXPORT

===================================================== */

export default {

    name: "SHAN MINI BOT SONG",

    command: "song",

    alias: ["play"],

    category: "DOWNLOAD",

    description: "Download original YouTube songs",

    usage: ".song <song name | youtube link>",

    replyHandler: true,

    async execute(sock, msg, args) {

        const jid = getJid(msg);

        const query = args.join(" ").trim();

        sweep();

        const react = emoji =>

            sock

                .sendMessage(jid, {

                    react: {

                        text: emoji,

                        key: msg.key

                    }

                })

                .catch(() => {});

        if (!query) {

            const p = await getPrefix(msg);

            return sock.sendMessage(

                jid,

                {

                    text:

                        "╭━━━〔 👨‍💻 SHAN MINI BOT 〕━━━╮\n" +

                        "┃\n" +

                        "┃  🎧 SONG DOWNLOADER\n" +

                        "┃  ━━━━━━━━━━━━━━━━━\n" +

                        `┃  📌 Usage: ${p}song <name | link>\n` +

                        `┃  📌 Example: ${p}song Shape of You\n` +

                        "┃\n" +

                        "┃  ⚙️ Features\n" +

                        "┃  ├─ Original Song Search\n" +

                        "┃  ├─ Audio File\n" +

                        "┃  ├─ Audio Document\n" +

                        "┃  └─ Voice Message\n" +

                        "┃\n" +

                        "╰━━━━━━━━━━━━━━━━━━━╯\n\n" +

                        `⚡ ${FOOTER}`

                },

                { quoted: msg }

            );

        }

        try {

            await react("🔍");

            let item;

            const vid = ytIdFromText(query);

            if (vid) {

                item = { videoId: vid };

            } else {

                const results = await searchYouTube(query);

                item = pickOriginal(results, query);

                if (!item) {

                    await react("❌");

                    return sock.sendMessage(

                        jid,

                        {

                            text:

                                "╭━━━〔 ⚠️ SEARCH ERROR 〕━━━╮\n" +

                                "┃\n" +

                                "┃  ❌ No songs found.\n" +

                                "┃  🔧 Try another search query.\n" +

                                "┃\n" +

                                "╰━━━━━━━━━━━━━━━━━━━╯"

                        },

                        { quoted: msg }

                    );

                }

            }

            const ok = await sendCard(sock, msg, item);

            await react(ok ? "✅" : "❌");

        } catch (error) {

            console.error("[SONG]", error?.message || error);

            await react("❌");

            await sock.sendMessage(

                jid,

                {

                    text:

                        "╭━━━〔 ⚠️ SONG ERROR 〕━━━╮\n" +

                        "┃\n" +

                        "┃  ❌ Song search failed.\n" +

                        "┃  🔧 Please try again later.\n" +

                        "┃\n" +

                        "╰━━━━━━━━━━━━━━━━━━━╯"

                },

                { quoted: msg }

            );

        }

    },

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

                    {

                        text:

                            "╭━━━〔 🔧 DOWNLOAD OPTIONS 〕━━━╮\n" +

                            "┃\n" +

                            "┃  〔 1 〕 🎵 Audio File\n" +

                            "┃  〔 2 〕 📁 Audio Document\n" +

                            "┃  〔 3 〕 🎙️ Voice Message\n" +

                            "┃\n" +

                            "┃  ⚙️ Reply with 1, 2, or 3.\n" +

                            "╰━━━━━━━━━━━━━━━━━━━╯"

                    },

                    { quoted: msg }

                );

                return true;

            }

            sweep();

            const entry = id ? cache.get(id) : null;

            if (!entry) {

                const p = await getPrefix(msg);

                await sock.sendMessage(

                    jid,

                    {

                        text:

                            "⌛ This selection has expired.\n\n" +

                            `🔍 Search again using ${p}song <name>`

                    },

                    { quoted: msg }

                );

                return true;

            }

            const react = emoji =>

                sock

                    .sendMessage(jid, {

                        react: {

                            text: emoji,

                            key: msg.key

                        }

                    })

                    .catch(() => {});

            await react("⏳");

            const ok = await sendByType(sock, msg, entry, type);

            await react(ok ? "✅" : "❌");

            return true;

        } catch (error) {

            console.error("[SONG REPLY]", error?.message || error);

            return false;

        }

    }

};