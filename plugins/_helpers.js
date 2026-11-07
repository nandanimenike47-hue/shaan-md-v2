// Shared helpers for plugins (loader skips this file because it has no default export)
export const digits = (j = "") => String(j).split("@")[0].split(":")[0].replace(/\D/g, "");

const OWNERS = (process.env.OWNER_NUMBER || "94771168937")
  .split(",").map((n) => n.replace(/\D/g, "")).filter(Boolean);

export const senderOf = (msg) => msg.key.participant || msg.key.remoteJid;
export const isOwner = (msg) => !!msg.key.fromMe || OWNERS.includes(digits(senderOf(msg)));
export const reply = (sock, msg, text, extra = {}) =>
  sock.sendMessage(msg.key.remoteJid, { text, ...extra }, { quoted: msg });

export function ctxInfo(msg) {
  const m = msg.message || {};
  return (
    m.extendedTextMessage?.contextInfo || m.imageMessage?.contextInfo ||
    m.videoMessage?.contextInfo || m.documentMessage?.contextInfo || {}
  );
}

export function unwrapMsg(m) {
  while (m) {
    const inner =
      m.ephemeralMessage?.message || m.viewOnceMessage?.message ||
      m.viewOnceMessageV2?.message || m.viewOnceMessageV2Extension?.message ||
      m.documentWithCaptionMessage?.message;
    if (!inner) break;
    m = inner;
  }
  return m;
}

export function getQuoted(msg) {
  const c = ctxInfo(msg);
  if (!c.quotedMessage) return null;
  return { id: c.stanzaId, participant: c.participant, message: unwrapMsg(c.quotedMessage) };
}

export const samePerson = (p, id) =>
  !!id && [p.id, p.lid, p.phoneNumber].filter(Boolean).some((x) => digits(x) === digits(id));

export async function groupCtx(sock, msg) {
  const jid = msg.key.remoteJid;
  if (!jid.endsWith("@g.us")) return null;
  const meta = await sock.groupMetadata(jid);
  const adm = (p) => !!p && (p.admin === "admin" || p.admin === "superadmin");
  const me = meta.participants.find((p) => samePerson(p, sock.user?.id) || samePerson(p, sock.user?.lid));
  const sender = meta.participants.find((p) => samePerson(p, senderOf(msg)));
  return {
    jid, meta,
    botAdmin: adm(me),
    senderAdmin: adm(sender) || isOwner(msg),
    find: (id) => meta.participants.find((p) => samePerson(p, id)),
  };
}

// mentioned users + replied user + numbers typed in args
export function targets(msg, args = []) {
  const c = ctxInfo(msg);
  const out = new Set(c.mentionedJid || []);
  if (c.participant && c.quotedMessage) out.add(c.participant);
  for (const a of args) {
    const d = a.replace(/\D/g, "");
    if (d.length >= 8 && d.length <= 15) out.add(d + "@s.whatsapp.net");
  }
  return [...out];
}

export async function getJSON(url, ms = 12000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}