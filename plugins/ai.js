import { reply, fetchText, quotedText } from "./utils.js";

export default {
  command: ["ai", "gpt"],
  desc: "AI chat  (.ai hello)",
  category: "AI",
  async execute(sock, msg, args) {
    const q = args.join(" ") || quotedText(msg);
    if (!q) return reply(sock, msg, "ℹ️ Example: .ai What is the capital of Sri Lanka?");
    await sock.sendPresenceUpdate("composing", msg.key.remoteJid).catch(() => {});
    const system = "You are SHAAN MD V1, a friendly WhatsApp assistant. Reply in the same language the user writes in. Keep answers concise.";
    const url = `https://text.pollinations.ai/${encodeURIComponent(q)}?model=openai&system=${encodeURIComponent(system)}`;
    try {
      const ans = (await fetchText(url)).trim();
      await reply(sock, msg, `🤖 ${ans || "No response."}`);
    } catch (e) {
      await reply(sock, msg, `❌ AI error: ${e.message}`);
    }
  },
};