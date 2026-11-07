import crypto from "crypto";
import { reply } from "./_helpers.js";

export default {
  command: ["base64", "hash", "password", "pass", "uuid", "reverse", "count", "time", "bmi", "age"],
  async execute(sock, msg, args, name) {
    const text = args.join(" ");
    switch (name) {
      case "base64": {
        const mode = (args.shift() || "").toLowerCase();
        const body = args.join(" ");
        if (!["encode", "decode"].includes(mode) || !body)
          return reply(sock, msg, "Usage:\n.base64 encode hello\n.base64 decode aGVsbG8=");
        const out = mode === "encode"
          ? Buffer.from(body).toString("base64")
          : Buffer.from(body, "base64").toString("utf8");
        return reply(sock, msg, out);
      }
      case "hash": {
        const algo = (args.shift() || "").toLowerCase();
        if (!["md5", "sha1", "sha256", "sha512"].includes(algo) || !args.length)
          return reply(sock, msg, "Usage: .hash <md5|sha1|sha256|sha512> text");
        return reply(sock, msg, crypto.createHash(algo).update(args.join(" ")).digest("hex"));
      }
      case "password": case "pass": {
        const len = Math.min(Math.max(parseInt(args[0]) || 14, 6), 64);
        const set = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?";
        let out = "";
        for (let i = 0; i < len; i++) out += set[crypto.randomInt(set.length)];
        return reply(sock, msg, `🔐 ${out}`);
      }
      case "uuid": return reply(sock, msg, crypto.randomUUID());
      case "reverse":
        if (!text) return reply(sock, msg, "Usage: .reverse hello");
        return reply(sock, msg, [...text].reverse().join(""));
      case "count": {
        if (!text) return reply(sock, msg, "Usage: .count your text here");
        const words = text.trim().split(/\s+/).length;
        return reply(sock, msg, `🔢 Characters: ${[...text].length}\nWords: ${words}`);
      }
      case "time": {
        const zone = args[0] || "Asia/Colombo";
        try {
          const s = new Date().toLocaleString("en-GB", { timeZone: zone, dateStyle: "full", timeStyle: "medium" });
          return reply(sock, msg, `🕒 *${zone}*\n${s}`);
        } catch {
          return reply(sock, msg, "❌ Invalid time zone. Example: .time Asia/Colombo  or  .time Europe/London");
        }
      }
      case "bmi": {
        const kg = parseFloat(args[0]), cm = parseFloat(args[1]);
        if (!kg || !cm) return reply(sock, msg, "Usage: .bmi <weight kg> <height cm>\nExample: .bmi 65 170");
        const bmi = kg / ((cm / 100) ** 2);
        const cat = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
        return reply(sock, msg, `⚖️ BMI: *${bmi.toFixed(1)}* (${cat})`);
      }
      case "age": {
        const d = new Date(args[0]);
        if (!args[0] || isNaN(d)) return reply(sock, msg, "Usage: .age YYYY-MM-DD\nExample: .age 2000-05-14");
        const now = new Date();
        let y = now.getFullYear() - d.getFullYear();
        let m = now.getMonth() - d.getMonth();
        let day = now.getDate() - d.getDate();
        if (day < 0) { m--; day += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
        if (m < 0) { y--; m += 12; }
        if (y < 0) return reply(sock, msg, "❌ That date is in the future.");
        return reply(sock, msg, `🎂 ${y} years, ${m} months, ${day} days`);
      }
    }
  },
};