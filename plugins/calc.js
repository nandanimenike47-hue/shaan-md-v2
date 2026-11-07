export default {
  command: ["calc"],
  desc: "Calculator  (.calc 5*(2+3))",
  category: "TOOLS",
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const expr = args.join(" ").replace(/×/g, "*").replace(/÷/g, "/").replace(/\^/g, "**");
    if (!expr) return sock.sendMessage(jid, { text: "ℹ️ Example: .calc 5*(2+3)" }, { quoted: msg });
    if (!/^[0-9+\-*/().%\s*]+$/.test(expr))
      return sock.sendMessage(jid, { text: "❌ Numbers and + - * / ( ) % ^ only." }, { quoted: msg });
    try {
      const result = Function(`"use strict"; return (${expr})`)();
      if (!Number.isFinite(result)) throw new Error("bad result");
      await sock.sendMessage(jid, { text: `🧮 ${expr} = *${result}*` }, { quoted: msg });
    } catch {
      await sock.sendMessage(jid, { text: "❌ Invalid expression." }, { quoted: msg });
    }
  },
};