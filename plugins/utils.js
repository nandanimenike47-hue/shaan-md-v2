// Shared helpers (no default export, so the loader skips it)

export const reply = (sock, msg, text) =>
  sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });

export async function fetchJson(url, opts = {}) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000), ...opts });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function fetchText(url, opts = {}) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000), ...opts });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

export const quotedText = (msg) => {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  return q?.conversation || q?.extendedTextMessage?.text || q?.imageMessage?.caption || q?.videoMessage?.caption || "";
};

// mentioned / replied users
export function getTargets(msg) {
  const c = msg.message?.extendedTextMessage?.contextInfo;
  const list = [...(c?.mentionedJid || [])];
  if (!list.length && c?.participant) list.push(c.participant);
  return list;
}

const d = (j = "") => String(j).split("@")[0].split(":")[0];
const match = (p, ids) => ids.some((i) => i && [p.id, p.lid, p.phoneNumber].some((x) => x && d(x) === d(i)));

// Group info + admin checks (handles both LID and normal JID)
export async function groupCtx(sock, msg) {
  const jid = msg.key.remoteJid;
  if (!jid.endsWith("@g.us")) return null;
  const meta = await sock.groupMetadata(jid);
  const senderP = meta.participants.find((p) => match(p, [msg.key.participant]));
  const botP = meta.participants.find((p) => match(p, [sock.user?.id, sock.user?.lid]));
  return { jid, meta, senderAdmin: !!msg.key.fromMe || !!senderP?.admin, botAdmin: !!botP?.admin };
}