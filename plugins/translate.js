import { reply, fetchJson, quotedText } from "./utils.js";

export default {
  command: ["tr", "translate"],
  desc: "Translate text  (.tr si Hello)",
  category: "AI",
  async execute(sock, msg, args) {
    let lang = "en";
    if (args[0] && /^[a-z]{2}(-[A-Za-z]{2})?$/.test(args[0])) lang = args.shift();
    const text = args.join(" ") || quotedText(msg);
    if (!text) return reply(sock, msg, "ℹ️ Example: .tr si How are you?\n(You can also reply to a message)");
    try {
      const j = await fetchJson(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=Autodetect|${lang}`
      );
      const out = j?.responseData?.translatedText;
      if (!out) throw new Error("no result");
      await reply(sock, msg, `🌐 *Translate → ${lang}*\n\n${out}`);
    } catch (e) {
      await reply(sock, msg, `❌ Translation failed: ${e.message}`);
    }
  },
};