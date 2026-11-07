import { reply, getJSON } from "./_helpers.js";

export default {
  command: ["weather", "wiki", "define", "cat", "dog", "quote"],
  async execute(sock, msg, args, name) {
    const q = args.join(" ").trim();
    const jid = msg.key.remoteJid;
    try {
      switch (name) {
        case "weather": {
          if (!q) return reply(sock, msg, "Usage: .weather Colombo");
          const d = await getJSON(`https://wttr.in/${encodeURIComponent(q)}?format=j1`);
          const c = d.current_condition[0];
          const area = d.nearest_area?.[0]?.areaName?.[0]?.value || q;
          return reply(sock, msg,
            `🌤️ *${area}*\n\nTemp: ${c.temp_C}°C (feels ${c.FeelsLikeC}°C)\n` +
            `Sky: ${c.weatherDesc[0].value}\nHumidity: ${c.humidity}%\nWind: ${c.windspeedKmph} km/h`);
        }
        case "wiki": {
          if (!q) return reply(sock, msg, "Usage: .wiki Sri Lanka");
          const d = await getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`);
          if (!d.extract) return reply(sock, msg, "❌ Nothing found.");
          return reply(sock, msg, `📚 *${d.title}*\n\n${d.extract}\n\n${d.content_urls?.mobile?.page || ""}`);
        }
        case "define": {
          if (!q) return reply(sock, msg, "Usage: .define serendipity");
          const d = await getJSON(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`);
          const lines = d[0].meanings.slice(0, 3).map(
            (m) => `• _${m.partOfSpeech}_: ${m.definitions[0].definition}`);
          return reply(sock, msg, `📖 *${d[0].word}*\n\n${lines.join("\n")}`);
        }
        case "cat": {
          const d = await getJSON("https://api.thecatapi.com/v1/images/search");
          return sock.sendMessage(jid, { image: { url: d[0].url }, caption: "🐱" }, { quoted: msg });
        }
        case "dog": {
          const d = await getJSON("https://dog.ceo/api/breeds/image/random");
          return sock.sendMessage(jid, { image: { url: d.message }, caption: "🐶" }, { quoted: msg });
        }
        case "quote": {
          const d = await getJSON("https://zenquotes.io/api/random");
          return reply(sock, msg, `💬 _${d[0].q}_\n— *${d[0].a}*`);
        }
      }
    } catch (e) {
      return reply(sock, msg, name === "define" || name === "wiki" ? "❌ Not found." : `❌ Failed: ${e.message}`);
    }
  },
};