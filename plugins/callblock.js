// ─────────────────────────────────────────────────────────────
// 📵 callblock.js
//   .delcall [number]  → ඒ chat එකේ කෙනාගේ calls විතරක් reject කරනවා (අනිත් අයට පුළුවන්)
//   .setcall [number]  → ඒ කෙනාට ආයෙ call කරන්න දෙනවා
//   .calllist          → reject කරන අය list එක
// index.js එකේ call handler එක globalThis.SHAN_IS_CALL_BLOCKED පාවිච්චි කරනවා
// (Anti Call settings එකෙන් ON කරාම ඔක්කොම අයගෙන් calls reject වෙනවා)
// ─────────────────────────────────────────────────────────────
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "callblock.json");
const digits = (j = "") => String(j).split("@")[0].split(":")[0].replace(/\D/g, "");

// entries: [{ ids: ["947...", "1063..."], label: "947..." }]  (real number + LID දෙකම තියාගන්නවා)
const load = () => {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return raw.map((e) => (typeof e === "string" ? { ids: [e], label: e } : e));
  } catch { return []; }
};
let entries = load();
const save = () => fs.writeFileSync(FILE, JSON.stringify(entries));

globalThis.SHAN_IS_CALL_BLOCKED = (jidOrNumber) => {
  const d = digits(jidOrNumber);
  return !!d && entries.some((e) => e.ids.includes(d));
};

async function resolveTarget(sock, msg, args) {
  const arg = digits(args[0] || "");
  let jid;
  if (arg.length >= 8) jid = arg + "@s.whatsapp.net";
  else {
    jid = msg.key.remoteJid || "";
    if (jid.endsWith("@g.us")) return null;
    if (jid.endsWith("@lid") && msg.key.remoteJidAlt) jid = msg.key.remoteJidAlt;
  }
  const ids = new Set([digits(jid)]);
  let label = digits(jid);
  let isLid = jid.endsWith("@lid");
  const map = sock.signalRepository?.lidMapping;
  try {
    if (jid.endsWith("@lid")) {
      const pn = await map?.getPNForLID?.(jid);
      if (pn) { ids.add(digits(pn)); label = digits(pn); isLid = false; }
    } else {
      const lid = await map?.getLIDForPN?.(jid);
      if (lid) ids.add(digits(lid));
    }
  } catch {}
  return { ids: [...ids], label, isLid };
}

const FOOT = "\n⚡ _SHAAN MD V1_";

export default {
  command: ["delcall", "setcall", "calllist"],

  async execute(sock, msg, args, name) {
    const jid = msg.key.remoteJid;
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    const sender = msg.key.participant || jid;
    const isOwner = msg.key.fromMe || (globalThis.SHAN?.owners || []).includes(digits(sender));
    if (!isOwner) return reply("🔒 මේක owner ට විතරයි.");

    if (name === "calllist") {
      if (!entries.length) return reply("📵 Reject කරන කවුරුත් නෑ.");
      const list = entries.map((e, i) => `┃ ${i + 1}. ☠️ +${e.label}`).join("\n");
      return reply(`╭━━━〔 📵 *𝗖𝗔𝗟𝗟 𝗕𝗟𝗔𝗖𝗞𝗟𝗜𝗦𝗧* 〕━━━╮\n${list}\n╰━━━━━━━━━━━━━━━━━━━╯${FOOT}`);
    }

    const t = await resolveTarget(sock, msg, args);
    if (!t) return reply("❌ Inbox chat එකක දාන්න, නැත්නම් number එකත් දාන්න.\nඋදා: .delcall 94771234567");

    const self = [digits(sock.user?.id || ""), digits(sock.user?.lid || ""), ...(globalThis.SHAN?.owners || [])];
    if (t.ids.some((id) => self.includes(id))) return reply("😅 මේක ඔයාගේම number එක.");

    // මේ කෙනාගේ කලින් entries අයින් කරනවා (real number / LID මොකක් වුණත්)
    entries = entries.filter((e) => !e.ids.some((id) => t.ids.includes(id)));

    if (name === "delcall") {
      entries.push({ ids: t.ids, label: t.label });
      save();
      return reply(
        [
          "╭━━━━〔 🚫 *𝗖𝗔𝗟𝗟 𝗕𝗟𝗢𝗖𝗞𝗘𝗗* 〕━━━━╮",
          `┃ ☠️ 𝗧𝗮𝗿𝗴𝗲𝘁 : +${t.label}${t.isLid ? " _(LID)_" : ""}`,
          "┃ 📵 𝗦𝘁𝗮𝘁𝘂𝘀 : 𝗥𝗘𝗝𝗘𝗖𝗧𝗘𝗗",
          "┃ 🔒 𝗔𝗰𝗰𝗲𝘀𝘀 : 𝗗𝗘𝗡𝗜𝗘𝗗",
          "╰━━━━━━━━━━━━━━━━━━━━━╯",
        ].join("\n") + FOOT
      );
    }

    save();
    return reply(
      [
        "╭━━━━〔 ✅ *𝗖𝗔𝗟𝗟 𝗔𝗟𝗟𝗢𝗪𝗘𝗗* 〕━━━━╮",
        `┃ 👤 𝗨𝘀𝗲𝗿 : +${t.label}`,
        "┃ 📞 𝗦𝘁𝗮𝘁𝘂𝘀 : 𝗨𝗡𝗕𝗟𝗢𝗖𝗞𝗘𝗗",
        "╰━━━━━━━━━━━━━━━━━━━━━╯",
      ].join("\n") + FOOT
    );
  },
};
