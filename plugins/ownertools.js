import { reply, targets, getQuoted } from "./_helpers.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// premium: true  ->  index.js allows only the owner
export default {
  premium: true,
  command: ["block", "unblock", "setbio", "mygroups", "bcgroups", "join", "leave"],
  async execute(sock, msg, args, name) {
    const jid = msg.key.remoteJid;
    switch (name) {
      case "block": case "unblock": {
        let t = targets(msg, args);
        if (!t.length && !jid.endsWith("@g.us")) t = [jid];
        if (!t.length) return reply(sock, msg, `Tag or reply to a user: .${name} @user`);
        for (const u of t) await sock.updateBlockStatus(u, name);
        return reply(sock, msg, `✅ ${name}ed ${t.length} user(s).`);
      }
      case "setbio": {
        const bio = args.join(" ");
        if (!bio) return reply(sock, msg, "Usage: .setbio your new bio");
        await sock.updateProfileStatus(bio);
        return reply(sock, msg, "✅ Bio updated.");
      }
      case "mygroups": {
        const all = Object.values(await sock.groupFetchAllParticipating());
        if (!all.length) return reply(sock, msg, "No groups.");
        const list = all.map((g, i) => `${i + 1}. ${g.subject} (${g.participants.length})`).join("\n");
        return reply(sock, msg, `👥 *Groups: ${all.length}*\n\n${list}`);
      }
      case "bcgroups": {
        const text = args.join(" ");
        if (!text) return reply(sock, msg, "Usage: .bcgroups your message");
        const all = Object.keys(await sock.groupFetchAllParticipating());
        await reply(sock, msg, `📢 Sending to ${all.length} groups (slow on purpose, to avoid a ban)...`);
        let ok = 0;
        for (const g of all) {
          try { await sock.sendMessage(g, { text: `📢 *Broadcast*\n\n${text}` }); ok++; } catch {}
          await sleep(2500);
        }
        return reply(sock, msg, `✅ Sent to ${ok}/${all.length} groups.`);
      }
      case "join": {
        const m = (args[0] || getQuoted(msg)?.message?.conversation || "").match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
        if (!m) return reply(sock, msg, "Usage: .join https://chat.whatsapp.com/XXXX");
        await sock.groupAcceptInvite(m[1]);
        return reply(sock, msg, "✅ Joined the group.");
      }
      case "leave": {
        if (!jid.endsWith("@g.us")) return reply(sock, msg, "❌ Use this inside a group.");
        await reply(sock, msg, "👋 Bye!");
        await sock.groupLeave(jid);
      }
    }
  },
};