// Shared look & feel for SHAAN MD (menu.js / alive.js / ping.js ... use this)
// index.js loader මේක skip කරනවා (default export නැති නිසා)

export const BOT_NAME = process.env.BOT_NAME || "SHAAN MD V1";
export const OWNER_NAME = process.env.OWNER_NAME || "SENESH NADEESHAN";
export const FOOTER = `> ⚡ Powered by ${BOT_NAME}`;

export const CAT_ICONS = {
  MAIN: "🏠",
  TOOLS: "🛠️",
  GROUP: "👥",
  DOWNLOAD: "📥",
  AI: "🤖",
  FUN: "🎉",
  OWNER: "👑",
  OTHER: "📦",
};

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "🌅 Good Morning" : h < 17 ? "☀️ Good Afternoon" : h < 20 ? "🌆 Good Evening" : "🌙 Good Night";
};

export const fmtUptime = (s) => {
  s = Math.floor(s);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${d ? d + "d " : ""}${h}h ${m}m ${sec}s`;
};

export const infoBox = (rows, title = `🔥 ${BOT_NAME} 🔥`) =>
  `╭━━━━〔 *${title}* 〕━━━━╮\n` +
  rows.map(([k, v]) => `┃ ${k}`.padEnd(0) + ` : ${v}`).join("\n") +
  `\n╰━━━━━━━━━━━━━━━━━━━━╯`;