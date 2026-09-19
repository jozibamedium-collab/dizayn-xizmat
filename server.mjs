import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";

const PORT = process.env.PORT || 3500;
const DATA_DIR = path.join(process.cwd(), "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const RESULTS_DIR = path.join(process.cwd(), "public", "results");

for (const dir of [DATA_DIR, UPLOADS_DIR, RESULTS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]");

function loadOrders() {
  return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
}
function saveOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function botToken() {
  const envPath = "C:/Users/1/jarvis/tg/.env";
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  const line = lines.find((l) => l.startsWith("TELEGRAM_BOT_TOKEN="));
  return line.replace("TELEGRAM_BOT_TOKEN=", "").trim();
}
const OWNER_CHAT_ID = "1273212803";

async function notifyOwner(text) {
  try {
    const token = botToken();
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: OWNER_CHAT_ID, text }),
    });
  } catch (e) {
    console.error("Telegram notify failed:", e.message);
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
});

const app = express();
app.use(express.static(path.join(process.cwd(), "public")));
app.use(express.json());

app.post("/api/order", upload.single("reference"), async (req, res) => {
  try {
    const { name, contact, description, package: pkg } = req.body;
    if (!name || !contact || !description) {
      return res.status(400).json({ ok: false, error: "Majburiy maydonlar to'ldirilmagan" });
    }
    const orderId = nanoid(8);
    const order = {
      orderId,
      name,
      contact,
      description,
      package: pkg || "oddiy",
      referenceFile: req.file ? req.file.filename : null,
      status: "qabul_qilindi",
      resultUrl: null,
      createdAt: new Date().toISOString(),
    };
    const orders = loadOrders();
    orders.push(order);
    saveOrders(orders);

    const pkgLabel = { oddiy: "Oddiy - 150,000 (1 thumbnail, 1 tuzatish)", standart: "Standart - 300,000 (3 variant + 2 tuzatish)", premium: "Premium (kelishilgan, bir nechta video)" }[order.package] || order.package;
    await notifyOwner(
      `Yangi buyurtma - #${orderId}\n\n` +
      `Ism: ${name}\nKontakt: ${contact}\nPaket: ${pkgLabel}\n\n` +
      `Tavsif: ${description}\n\n` +
      (req.file ? `Referens rasm: data/uploads/${req.file.filename}` : "Referens rasm: yo'q")
    );

    res.json({ ok: true, orderId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Server xatosi" });
  }
});

app.get("/api/order/:id", (req, res) => {
  const orders = loadOrders();
  const order = orders.find((o) => o.orderId === req.params.id);
  if (!order) return res.status(404).json({ ok: false, error: "Topilmadi" });
  res.json({ ok: true, orderId: order.orderId, status: order.status, resultUrl: order.resultUrl });
});

// Admin: buyurtma holatini yangilash (hozircha ochiq - keyinroq parol qo'shiladi)
app.post("/api/admin/order/:id", express.json(), (req, res) => {
  const orders = loadOrders();
  const order = orders.find((o) => o.orderId === req.params.id);
  if (!order) return res.status(404).json({ ok: false, error: "Topilmadi" });
  if (req.body.status) order.status = req.body.status;
  if (req.body.resultUrl) order.resultUrl = req.body.resultUrl;
  saveOrders(orders);
  res.json({ ok: true, order });
});

app.get("/api/admin/orders", (req, res) => {
  res.json({ ok: true, orders: loadOrders() });
});

app.listen(PORT, () => {
  console.log(`Dizayn Xizmati serveri ishga tushdi: http://localhost:${PORT}`);
});
