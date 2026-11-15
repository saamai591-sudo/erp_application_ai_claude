// نصب‌کننده‌ی ERP روی سرور لینوکسی: یک صفحه‌ی محلی (فقط 127.0.0.1) که از راه SSH اسکریپت install.sh را روی سرور اجرا می‌کند
// و خروجی خط‌به‌خط آن را زنده نشان می‌دهد. هیچ رمزی روی دیسک ذخیره نمی‌شود و فقط در حافظه‌ی همین فرایند می‌ماند.
import { Client } from "ssh2";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = fs.readFileSync(path.join(here, "install.sh"), "utf8").replace(/\r\n/g, "\n");
const UI = fs.readFileSync(path.join(here, "ui.html"), "utf8");
const TOKEN = crypto.randomBytes(24).toString("hex");

// ───────────── اجرای اسکریپت روی سرور ─────────────
const shq = (v) => `'${String(v ?? "").replace(/'/g, `'\\''`)}'`;

function execOnce(conn, cmd, stdin) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream.on("data", (d) => (out += d));
      stream.stderr.on("data", (d) => (out += d));
      stream.on("close", (code) => resolve({ code, out }));
      if (stdin != null) stream.write(stdin);
      stream.end();
    });
  });
}

function parseLine(line, emit) {
  if (line.startsWith("##STEP ")) emit({ type: "step", text: line.slice(7) });
  else if (line.startsWith("##OK ")) emit({ type: "ok", text: line.slice(5) });
  else if (line.startsWith("##WARN ")) emit({ type: "warn", text: line.slice(7) });
  else if (line.startsWith("##ERR ")) emit({ type: "err", text: line.slice(6) });
  else if (line.startsWith("##RESULT ")) {
    try { emit({ type: "result", data: JSON.parse(line.slice(9)) }); } catch { emit({ type: "raw", text: line }); }
  } else if (line.trim()) emit({ type: "raw", text: line });
}

async function runRemote(p, emit) {
  const conn = new Client();
  const opts = {
    host: p.host,
    port: Number(p.sshPort) || 22,
    username: p.user,
    password: p.password,
    readyTimeout: 25000,
    keepaliveInterval: 15000,
    hostHash: "sha256",
    hostVerifier: (fp) => { emit({ type: "raw", text: `اثر انگشت سرور (SHA-256): ${fp}` }); return true; },
  };
  emit({ type: "step", text: `اتصال به ${p.host}:${opts.port} با کاربر ${p.user}` });
  await new Promise((resolve, reject) => {
    conn.once("ready", resolve);
    conn.once("error", reject);
    conn.connect(opts);
  });
  emit({ type: "ok", text: "اتصال SSH برقرار شد" });

  try {
    const root = p.user === "root";
    let cmd = "bash -s";
    let prefix = "";
    if (!root) {
      const n = await execOnce(conn, "sudo -n true");
      if (n.code === 0) {
        cmd = "sudo -n bash -s";
      } else {
        cmd = "sudo -S -p '' bash -s";
        prefix = `${p.sudoPassword || p.password}\n`;
      }
    }
    const header = [
      `export MODE=${shq(p.mode)}`,
      `export INSTALL_NAME=${shq(p.installName)}`,
      `export REGISTRY=${shq(p.registry)}`,
      `export REG_USER=${shq(p.regUser)}`,
      `export REG_PASS=${shq(p.regPass)}`,
      `export REL_VERSION=${shq(p.version)}`,
      `export SERVER_IP=${shq(p.host)}`,
      `export FORCE=${shq(p.force ? "1" : "0")}`,
      "",
    ].join("\n");

    let gotResult = false;
    let gotErr = false;
    let sudoFailed = false;
    await new Promise((resolve, reject) => {
      conn.exec(cmd, (err, stream) => {
        if (err) return reject(err);
        let buf = "";
        const onData = (d) => {
          buf += d.toString("utf8");
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).replace(/\r$/, "");
            buf = buf.slice(i + 1);
            if (/Sorry, try again|incorrect password|is not in the sudoers/i.test(line)) sudoFailed = true;
            if (line.startsWith("##RESULT ")) gotResult = true;
            if (line.startsWith("##ERR ")) gotErr = true;
            parseLine(line, emit);
          }
        };
        stream.on("data", onData);
        stream.stderr.on("data", onData);
        stream.on("close", (code) => {
          if (buf.trim()) parseLine(buf.trim(), emit);
          if (sudoFailed) emit({ type: "err", text: "رمز sudo نادرست است یا این کاربر اجازه‌ی sudo ندارد" });
          else if (!gotResult && !gotErr) emit({ type: "err", text: `اسکریپت روی سرور با کد ${code} تمام شد` });
          resolve();
        });
        stream.write(prefix + header + SCRIPT);
        stream.end();
      });
    });
  } finally {
    conn.end();
  }
}

// ───────────── سرور محلی صفحه ─────────────
let running = false;
const events = [];
const listeners = new Set();
const emit = (ev) => { events.push(ev); for (const l of listeners) l(ev); };

const readBody = (req) => new Promise((resolve, reject) => {
  let b = "";
  req.on("data", (d) => { b += d; if (b.length > 100_000) reject(new Error("big")); });
  req.on("end", () => resolve(b));
});
const json = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const host = (req.headers.host || "").split(":")[0];
  if (host !== "127.0.0.1" && host !== "localhost") { res.writeHead(403); return res.end(); }
  const tokenOk = (req.headers["x-token"] || url.searchParams.get("token")) === TOKEN;

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    return res.end(UI.replace("__TOKEN__", TOKEN));
  }
  if (!tokenOk) { res.writeHead(403); return res.end(); }

  if (req.method === "POST" && url.pathname === "/api/run") {
    if (running) return json(res, 409, { error: "یک اجرا در حال انجام است" });
    let p;
    try { p = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: "درخواست نامعتبر" }); }
    if (!["check", "install"].includes(p.mode)) return json(res, 400, { error: "حالت نامعتبر" });
    running = true;
    events.length = 0;
    json(res, 200, { ok: true });
    runRemote(p, emit)
      .catch((e) => emit({ type: "err", text: friendly(e) }))
      .finally(() => { running = false; emit({ type: "end" }); });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    const send = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
    for (const ev of events) send(ev);
    listeners.add(send);
    req.on("close", () => listeners.delete(send));
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/quit") {
    json(res, 200, { ok: true });
    setTimeout(() => process.exit(0), 200);
    return;
  }
  res.writeHead(404); res.end();
});

function friendly(e) {
  const m = String(e?.message || e);
  if (/ECONNREFUSED/.test(m)) return "اتصال رد شد (ECONNREFUSED): SSH روی سرور/پورت فعال نیست";
  if (/ETIMEDOUT|Timed out|timeout/i.test(m)) return "زمان اتصال تمام شد: آدرس یا فایروال/شبکه را بررسی کنید";
  if (/ENOTFOUND/.test(m)) return "آدرس سرور پیدا نشد";
  if (/authentication/i.test(m)) return "نام کاربری یا رمز SSH نادرست است (یا ورود با رمز برای این کاربر بسته است)";
  return m;
}

server.listen(0, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  console.log(`نصب‌کننده‌ی ERP: ${url}`);
  if (process.platform === "win32" && !process.env.NO_BROWSER) {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  }
});
