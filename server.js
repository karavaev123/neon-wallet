require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
const db = new Database("miniapp.sqlite");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  telegram_id TEXT PRIMARY KEY, name TEXT NOT NULL,
  rub REAL NOT NULL DEFAULT 0, usdt REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT NOT NULL,
  kind TEXT NOT NULL, amount REAL NOT NULL, currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheckString = [...params.entries()].sort(([a],[b])=>a.localeCompare(b))
    .map(([k,v])=>`${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  const a = Buffer.from(calculated, "hex"), b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) return null;
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now()/1000-authDate > 86400) return null;
  try { return JSON.parse(params.get("user") || "null"); } catch { return null; }
}
function auth(req,res,next) {
  const user = verifyTelegramInitData(req.headers["x-telegram-init-data"], process.env.BOT_TOKEN);
  if (!user?.id) return res.status(401).json({error:"Telegram authentication failed"});
  req.tgUser=user; next();
}
app.get("/api/me", auth, (req,res)=>{
  const u=req.tgUser, id=String(u.id);
  const name=[u.first_name,u.last_name].filter(Boolean).join(" ") || u.username || "Пользователь";
  db.prepare("INSERT OR IGNORE INTO users(telegram_id,name) VALUES(?,?)").run(id,name);
  db.prepare("UPDATE users SET name=? WHERE telegram_id=?").run(name,id);
  const row=db.prepare("SELECT telegram_id,name,rub,usdt,created_at FROM users WHERE telegram_id=?").get(id);
  res.json({user:row,requests:db.prepare("SELECT id,kind,amount,currency,status,created_at FROM requests WHERE telegram_id=? ORDER BY id DESC LIMIT 10").all(id)});
});
// These endpoints create requests only; they do not move or pay real money.
app.post("/api/request", auth, (req,res)=>{
  const {kind,amount,currency}=req.body||{};
  if(!["deposit","withdraw","cash"].includes(kind) || !["RUB","USDT"].includes(currency) ||
     !Number.isFinite(amount) || amount<=0 || amount>1000000)
    return res.status(400).json({error:"Проверьте тип операции и сумму"});
  const id=String(req.tgUser.id);
  db.prepare("INSERT OR IGNORE INTO users(telegram_id,name) VALUES(?,?)").run(id,req.tgUser.first_name||"Пользователь");
  const result=db.prepare("INSERT INTO requests(telegram_id,kind,amount,currency) VALUES(?,?,?,?)").run(id,kind,amount,currency);
  res.json({ok:true,requestId:result.lastInsertRowid,message:"Заявка создана (демо). Баланс не изменён."});
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
const port=process.env.PORT||3000;
app.listen(port,()=>console.log(`Mini App server: http://localhost:${port}`));
