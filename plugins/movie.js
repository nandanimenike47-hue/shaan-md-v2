// ─────────────────────────────────────────────────────────────
// 🎬 movie.js — .movie <නම>  (Movie / Series info — OMDb)
// .env එකට දාන්න: OMDB_API_KEY=xxxxxxx   (free key: omdbapi.com/apikey.aspx)
// ─────────────────────────────────────────────────────────────

export default {
  command: "movie",
  alias: ["imdb", "film"],

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    const q = args.join(" ").trim();
    if (!q) return reply("🎬 *Usage:* .movie <movie නම>\nඋදා: .movie Inception");

    const key = process.env.OMDB_API_KEY;
    if (!key) return reply("⚠️ .env එකේ OMDB_API_KEY එක නෑ.");

    const res = await fetch(`https://www.omdbapi.com/?apikey=${key}&plot=short&t=${encodeURIComponent(q)}`);
    const d = await res.json();
    if (d.Response === "False") return reply(`❌ "${q}" හොයාගත්තේ නෑ.`);

    const caption = [
      `╭━━〔 🎬 *${d.Title}* 〕━━╮`,
      `┃ 📅 Year : ${d.Year}`,
      `┃ ⭐ IMDb : ${d.imdbRating}/10`,
      `┃ ⏱️ Time : ${d.Runtime}`,
      `┃ 🎭 Genre : ${d.Genre}`,
      `┃ 🎬 Director : ${d.Director}`,
      `┃ 👥 Cast : ${d.Actors}`,
      "╰━━━━━━━━━━━━━━━━╯",
      "",
      `📝 ${d.Plot}`,
      "",
      `🔗 https://www.imdb.com/title/${d.imdbID}`,
      "",
      "💡 Free (public domain) movies download කරන්න: *.moviedl <නම>*",
      "⚡ _SHAAN MD V1_",
    ].join("\n");

    const hasPoster = d.Poster && d.Poster !== "N/A";
    await sock.sendMessage(jid, hasPoster ? { image: { url: d.Poster }, caption } : { text: caption }, { quoted: msg });
  },
};
