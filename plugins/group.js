import { groupCtx, targets, reply } from "./_helpers.js";

async function guard(sock, msg, needBotAdmin = true) {
  const g = await groupCtx(sock, msg);
  if (!g) { await reply(sock, msg, "❌ This command works in groups only."); return null; }
  if (!g.senderAdmin) { await reply(sock, msg, "🔒 Group admins only."); return null; }
  if (needBotAdmin && !g.botAdmin) { await reply(sock, msg, "⚠️ Make the bot an admin first."); return null; }
  return g;
}

async function participantAction(sock, msg, args, action, label) {
  const g = await guard(sock, msg);
  if (!g) return;
  const list = targets(msg, args);
  if (!list.length) return reply(sock, msg, `Tag, reply to, or type the number of the user.\nExample: .${label} @user`);
  const ids = action === "add" ? list : list.map((t) => g.find(t)?.id || t);
  const res = await sock.groupParticipantsUpdate(g.jid, ids, action);
  const ok = res.filter((r) => String(r.status) === "200").length;
  await reply(sock, msg, `${ok ? "✅" : "❌"} ${label}: ${ok}/${ids.length} done.`);
}

export default {
  command: [
    "kick", "remove", "add", "promote", "demote", "mute", "close", "unmute", "open",
    "link", "gclink", "revoke", "resetlink", "ginfo", "groupinfo", "setname", "setdesc",
  ],
  async execute(sock, msg, args, name) {
    switch (name) {
      case "kick": case "remove": return participantAction(sock, msg, args, "remove", "kick");
      case "add": return participantAction(sock, msg, args, "add", "add");
      case "promote": return participantAction(sock, msg, args, "promote", "promote");
      case "demote": return participantAction(sock, msg, args, "demote", "demote");

      case "mute": case "close": {
        const g = await guard(sock, msg); if (!g) return;
        await sock.groupSettingUpdate(g.jid, "announcement");
        return reply(sock, msg, "🔇 Group closed. Only admins can send messages.");
      }
      case "unmute": case "open": {
        const g = await guard(sock, msg); if (!g) return;
        await sock.groupSettingUpdate(g.jid, "not_announcement");
        return reply(sock, msg, "🔊 Group opened. Everyone can send messages.");
      }
      case "link": case "gclink": {
        const g = await guard(sock, msg); if (!g) return;
        const code = await sock.groupInviteCode(g.jid);
        return reply(sock, msg, `🔗 https://chat.whatsapp.com/${code}`);
      }
      case "revoke": case "resetlink": {
        const g = await guard(sock, msg); if (!g) return;
        const code = await sock.groupRevokeInvite(g.jid);
        return reply(sock, msg, `♻️ Link reset.\nhttps://chat.whatsapp.com/${code}`);
      }
      case "setname": {
        const g = await guard(sock, msg); if (!g) return;
        if (!args.length) return reply(sock, msg, "Usage: .setname New Group Name");
        await sock.groupUpdateSubject(g.jid, args.join(" "));
        return reply(sock, msg, "✅ Group name updated.");
      }
      case "setdesc": {
        const g = await guard(sock, msg); if (!g) return;
        if (!args.length) return reply(sock, msg, "Usage: .setdesc New description");
        await sock.groupUpdateDescription(g.jid, args.join(" "));
        return reply(sock, msg, "✅ Group description updated.");
      }
      case "ginfo": case "groupinfo": {
        const g = await groupCtx(sock, msg);
        if (!g) return reply(sock, msg, "❌ This command works in groups only.");
        const m = g.meta;
        const admins = m.participants.filter((p) => p.admin).length;
        const created = m.creation ? new Date(m.creation * 1000).toISOString().slice(0, 10) : "-";
        return reply(sock, msg,
          `👥 *${m.subject}*\n\n` +
          `Members : ${m.participants.length}\nAdmins  : ${admins}\nCreated : ${created}\n` +
          `Mode    : ${m.announce ? "Admins only" : "Everyone"}\n\n` +
          `📝 ${m.desc || "No description"}`);
      }
    }
  },
};