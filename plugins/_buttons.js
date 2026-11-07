// plugins/_buttons.js — shared button sender (loader skips it: no default export)
import { generateWAMessageFromContent, prepareWAMessageMedia, proto } from "@whiskeysockets/baileys";

const BIZ = [{ tag: "biz", attrs: {}, content: [{ tag: "interactive", attrs: { type: "native_flow", v: "1" },
  content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }] }] }];

/**
 * sendButtons(sock, jid, quoted, { image?, caption, footer?, buttons:[{text,id}] })
 * image: Buffer | { url } | null.   Returns true if sent, false if failed (caller should send its fallback).
 */
export async function sendButtons(sock, jid, quoted, { image, caption, footer = "", buttons = [] }) {
  try {
    const IM = proto.Message.InteractiveMessage;
    let header;
    if (image) {
      const media = await prepareWAMessageMedia({ image }, { upload: sock.waUploadToServer });
      header = IM.Header.create({ hasMediaAttachment: true, ...media });
    } else {
      header = IM.Header.create({ hasMediaAttachment: false });
    }
    const msg = generateWAMessageFromContent(jid, {
      viewOnceMessage: { message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage: IM.create({
          header,
          body: IM.Body.create({ text: caption }),
          footer: IM.Footer.create({ text: footer }),
          nativeFlowMessage: IM.NativeFlowMessage.create({
            buttons: buttons.map((b) => ({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: b.text, id: b.id }) })),
          }),
        }),
      } },
    }, { quoted });
    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id, additionalNodes: BIZ });
    return true;
  } catch (e) {
    console.log("❌ BUTTON ERROR:", e?.message || e);
    return false;
  }
}


/**
 * sendList(sock, jid, quoted, { caption, footer, buttonText, sections:[{title, rows:[{title, description?, id}]}], extra:[{text,id}] })
 * "single_select" list (dropdown) + optional quick_reply buttons. Returns true/false.
 */
export async function sendList(sock, jid, quoted, { caption, footer = "", buttonText = "Select", sections = [], extra = [] }) {
  try {
    const IM = proto.Message.InteractiveMessage;
    const buttons = [
      { name: "single_select", buttonParamsJson: JSON.stringify({
        title: buttonText,
        sections: sections.map((sec) => ({ title: sec.title, rows: sec.rows.map((r) => ({ title: r.title, description: r.description || "", id: r.id })) })),
      }) },
      ...extra.map((b) => ({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: b.text, id: b.id }) })),
    ];
    const msg = generateWAMessageFromContent(jid, {
      viewOnceMessage: { message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage: IM.create({
          header: IM.Header.create({ hasMediaAttachment: false }),
          body: IM.Body.create({ text: caption }),
          footer: IM.Footer.create({ text: footer }),
          nativeFlowMessage: IM.NativeFlowMessage.create({ buttons }),
        }),
      } },
    }, { quoted });
    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id, additionalNodes: BIZ });
    return true;
  } catch (e) {
    console.log("❌ LIST ERROR:", e?.message || e);
    return false;
  }
}
