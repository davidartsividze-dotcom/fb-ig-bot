// ============================================================
//  Facebook + Instagram → Claude AI → Telegram ბოტი
//  Railway-ზე გასაშვებად (Node 18+, მხოლოდ express).
// ============================================================

import express from "express";

const app = express();

// ---------- კონფიგი ----------
const PORT               = process.env.PORT || 3000;
const META_PAGE_TOKEN    = process.env.META_PAGE_TOKEN    || "";
const META_VERIFY_TOKEN  = process.env.META_VERIFY_TOKEN  || "okayshop_verify_9x7p2k";
const META_API_VER       = process.env.META_API_VER       || "v21.0";
const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY  || "";
const AI_MODEL           = process.env.AI_MODEL           || "claude-sonnet-4-6";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_IDS  = (process.env.TELEGRAM_CHAT_IDS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

const FOLLOWUP_MSG = process.env.FOLLOWUP_MSG ||
  "გამარჯობა! 😊 იმედია პროდუქტი ხელში მიიღეთ! მოგეწონათ? თქვენი გამოხმაურება ძალიან მნიშვნელოვანია ჩვენთვის 🙏";

// პირველი შეტყობინება — ყოველთვის ეს (AI გარეშე)
const PRODUCT_LIST_MSG =
`ფასები 📌

🏷️ Derol-ის ტუში — 29 ლარი
🏷️ Derol-ის ტონალური — 35 ლარი
🏷️ Derol-ის ლაინერი — 20 ლარი
🏷️ Soft Skin-ის ტანის ხელთათმანი — 29 ლარი
🏷️ Soft Skin-ის სახის ხელთათმანი — 25 ლარი
🏷️ Derol-ის წარბის გელი — 35 ლარი
🏷️ Maffick-ის ქონსილერი — 29 ლარი

✅ თბილისში მიწოდება უფასოა (მეორე დღეს)
✅ რეგიონში ემატება 7 ლარი (ყველგან ზუსტ მისამართზე ვაწვდით)`;

// პროდუქტების სია cross-sell-ისთვის
const PRODUCTS = [
  { name: "Derol-ის ტუში",                   price: 29, keys: ["ტუში", "tushi", "mascara"] },
  { name: "Derol-ის ტონალური",               price: 35, keys: ["ტონალური", "tonaluri", "foundation", "სტიქი"] },
  { name: "Derol-ის ლაინერი",                price: 20, keys: ["ლაინერი", "laineri", "liner"] },
  { name: "Soft Skin-ის ტანის ხელთათმანი",  price: 29, keys: ["ტანის", "tanis", "telo", "ტანი"] },
  { name: "Soft Skin-ის სახის ხელთათმანი",  price: 25, keys: ["სახის", "saxis", "saxe", "პილინგ"] },
  { name: "Derol-ის წარბის გელი",            price: 35, keys: ["წარბის", "warbis", "გელი", "fixer"] },
  { name: "Maffick-ის ქონსილერი",            price: 29, keys: ["ქონსილერი", "konsileri", "maffick"] },
];
const CROSSSELL_DISCOUNT = 0.30;

// AI კონტექსტი
const SHOP_CONTEXT = process.env.SHOP_CONTEXT || `
შენ ხარ "Okayshop"-ის (okayshop.ge) გაყიდვების ასისტენტი Facebook/Instagram-ზე.
პასუხობ ქართულად, თბილად, ბუნებრივად და მოკლედ. ემოჯი ზომიერად.

🛍️ პროდუქტები და ფასები:
1. Derol-ის ტუში — 29 ₾ (წყალგამძლე, 24სთ, 3D მოცულობა, ჰიპოალერგიული)
2. Derol-ის ტონალური სტიქი — 35 ₾ (მძლავრი დაფარვა, მატ ეფექტი, ჩაშენებული ჯაგრისი, წყლისა და ოფლის გამძლე)
3. Derol-ის ლაინერი — 20 ₾
4. Soft Skin-ის ტანის ხელთათმანი — 29 ₾ (პილინგი, ეფექტი პირველივე გამოყენებიდან, ამოიღებს მკვდარ კანს, ამცირებს ცელულიტს)
5. Soft Skin-ის სახის ხელთათმანი — 25 ₾ (სახის პილინგი)
6. Derol-ის წარბის გელი — 35 ₾ (მთელი დღე, გამჭვირვალე, 3D ეფექტი, წყალგამძლე)
7. Maffick-ის ქონსილერი — 29 ₾ (ბნელი წრეები, სიწითლე, აკნე, ყველა ტიპის კანი)

🚚 მიწოდება:
- თბილისი: უფასო, მეორე დღეს
- რეგიონი: +7 ₾, 2–3 სამუშაო დღეში

⚠️ ᲛᲜᲘᲨᲕᲜᲔᲚᲝᲕᲐᲜᲘ წესები:
1. პირველი შეტყობინება — ყოველთვის ᲛᲮᲝᲚᲝᲓ პროდუქტების სია (სხვა არაფერი).
2. პროდუქტი რომ აირჩიეს:
   - Derol-ის ტონალური სტიქი: ჯერ ჰკითხე ტონი/ელფერი (ნათელი, საშუალო, მუქი).
   - ყველა დანარჩენი პროდუქტი: ᲞᲘᲠᲓᲐᲞᲘᲠ ერთი წინადადებით სთხოვე ტელეფონი და მისამართი.
     მაგ: "შესაძენად გვჭირდება თქვენი ტელეფონის ნომერი და მიტანის მისამართი 😊"
3. კარგია/ ჩვეულებრივი კითხვები — მოკლედ და ბუნებრივად უპასუხე.
4. ნუ ამბობ ამდენ "მადლობას" და "გამარჯობა/ნახვამდის"-ს — ბუნებრივად მოიქეცი.
5. ფასს ზუსტად ეუბნები ზემოთ სიიდან. ფაქტებს ნუ მოიგონებ.
6. კითხვა სცდება შენს ცოდნას — "ოპერატორი მალე დაუკავშირდება".
`.trim();

app.use(express.json());

// ---------- debug ----------
const DEBUG_KEY = process.env.DEBUG_KEY || "dbg_okayshop_9x7p2k";
const recentLog = [];
function logEvent(tag, data) {
  recentLog.push({ t: new Date().toISOString(), tag, data });
  if (recentLog.length > 40) recentLog.shift();
  console.log(tag, data);
}
app.get("/debug", (req, res) => {
  if (req.query.key !== DEBUG_KEY) return res.sendStatus(403);
  res.json(recentLog);
});

// ---------- state ----------
const chats = new Map();
function getState(key) {
  if (!chats.has(key)) chats.set(key, {
    history: [],
    order: {},
    order_sent: false,
    followup_sent: false,
    last_mid: null,
    asked_for_details: false, // ტელეფონი+მისამართი სთხოვეს
    collecting: false,        // 30-წამიანი ლოდინის რეჟიმი
    collect_buffer: [],       // დაბუფერებული შეტყობინებები
    collect_timer: null,
  });
  return chats.get(key);
}

// ============================================================
//  Meta Webhook
// ============================================================

app.get("/webhook", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === META_VERIFY_TOKEN)
    return res.status(200).send(challenge);
  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  const body = req.body;
  logEvent("WEBHOOK", JSON.stringify(body).slice(0, 1500));
  if (!body || !Array.isArray(body.entry)) return;

  const platform = body.object === "instagram" ? "Instagram" : "Facebook";
  for (const entry of body.entry) {
    const events = entry.messaging || entry.standby || [];
    for (const event of events) {
      try { await handleEvent(platform, event); }
      catch (e) { console.error("handleEvent error:", e); }
    }
  }
});

async function handleEvent(platform, event) {
  if (!event.message || event.message.is_echo) return;
  const psid = event.sender?.id;
  if (!psid) return;

  const mid  = event.message.mid || "";
  const text = (event.message.text || "").trim();
  const key  = `${platform}:${psid}`;
  const state = getState(key);

  if (mid && state.last_mid === mid) return;
  state.last_mid = mid;

  if (!text) {
    await graphSend(psid, "მოკლედ მომწერეთ ტექსტით, რით დაგეხმაროთ 😊");
    return;
  }

  // ── პირველი შეტყობინება → პროდუქტების სია (AI გარეშე) ──
  if (state.history.length === 0) {
    state.history.push({ role: "user", content: text });
    await graphSend(psid, PRODUCT_LIST_MSG);
    state.history.push({ role: "assistant", content: PRODUCT_LIST_MSG });
    return;
  }

  // ── 30-წამიანი ლოდინის რეჟიმი (ტელეფონი/მისამართის შეგროვება) ──
  if (state.collecting) {
    state.collect_buffer.push(text);
    if (state.collect_timer) clearTimeout(state.collect_timer);
    state.collect_timer = setTimeout(
      () => processCollected(platform, psid, key),
      30000
    );
    return;
  }

  // ── ჩვეულებრივი AI ნაკადი ──
  state.history.push({ role: "user", content: text });
  state.history = state.history.slice(-20);

  const ai = await aiReply(state);
  let reply = (ai.reply || "").trim();
  if (!reply) reply = "ოპერატორი მალე დაუკავშირდება 🙏";

  if (ai.order && typeof ai.order === "object") {
    for (const k of ["product", "quantity", "name", "phone", "address", "summary"]) {
      if (ai.order[k]) state.order[k] = String(ai.order[k]).trim();
    }
  }

  await graphSend(psid, reply);
  state.history.push({ role: "assistant", content: reply });
  state.history = state.history.slice(-20);

  // ── პროდუქტი გვაქვს → მომდევნო შეტყობინებიდან ვიწყებთ შეგროვებას ──
  if (state.order.product && !state.order.phone && !state.asked_for_details) {
    state.asked_for_details = true;
    // მომდევნო მესიჯი პირდაპირ collecting-ში შევა
    state.collecting = true;
    state.collect_buffer = [];
  }
}

// ── 30 წამის შემდეგ: შეკვეთის დასრულება ──
async function processCollected(platform, psid, key) {
  const state = getState(key);
  state.collecting = false;
  state.collect_timer = null;

  const combined = state.collect_buffer.join(" ");
  state.collect_buffer = [];

  state.history.push({ role: "user", content: combined });
  state.history = state.history.slice(-20);

  // AI ამოიღებს ტელეფონს და მისამართს
  const ai = await aiReply(state);
  if (ai.order && typeof ai.order === "object") {
    for (const k of ["product", "quantity", "name", "phone", "address", "summary"]) {
      if (ai.order[k]) state.order[k] = String(ai.order[k]).trim();
    }
  }

  // მიწოდების ვადა
  const addr = (state.order.address || combined).toLowerCase();
  const isTbilisi = addr.includes("თბილის") || addr.includes("tbilisi") || addr.includes("tbil");
  const delivery = isTbilisi
    ? "პროდუქტს მიიღებთ მეორე დღეს 🚚"
    : "პროდუქტს მიიღებთ 2–3 სამუშაო დღეში 🚚";

  const confirmMsg = `მადლობა, თქვენი შეკვეთა მიღებულია ❤️ ${delivery}`;
  await graphSend(psid, confirmMsg);
  state.history.push({ role: "assistant", content: confirmMsg });

  // Telegram + cross-sell
  if (!state.order_sent) {
    // ტელეფონი ან მისამართი ვერ ამოიღო — ვაგზავნით მაინც
    if (!state.order.phone) state.order.phone = combined;
    await sendOrderToTelegram(platform, psid, state.order);
    state.order_sent = true;
    setTimeout(() => sendCrossSell(psid, state.order.product || "", state.order.name || ""), 4000);
  }
}

// ---------- Claude AI ----------
async function aiReply(state) {
  let sys;
  if (state.followup_sent) {
    sys = SHOP_CONTEXT + "\n\n" +
      "⚠️ მომხმარებელი პროდუქტს უკვე ფლობს და გამოხმაურებას გიზიარებს.\n" +
      "მიუგე მოკლედ, გულწრფელად, მადლობა გადაუხადე. ახალ შეკვეთაზე ნუ ილაპარაკებ.\n" +
      'JSON: {"reply":"...","order":{}}\nJSON-ის გარდა არაფერი.';
  } else {
    sys = SHOP_CONTEXT + "\n\n" +
      "ამ მომხმარებელზე ცნობილია: " + JSON.stringify(state.order) + "\n\n" +
      "უპასუხე მხოლოდ ვალიდური JSON-ით:\n" +
      '{"reply":"<პასუხი>","order":{"product":"","quantity":"","name":"","phone":"","address":"","summary":""}}\n' +
      "- product: პროდუქტის სახელი\n" +
      "- quantity: რაოდენობა (default 1)\n" +
      "- name/phone/address: კლიენტის მონაცემები\n" +
      "- summary: 1 წინადადება (ქართ.)\n" +
      "უცნობი ველი ცარიელი. JSON-ის გარდა არაფერი.";
  }

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 600,
        system: sys,
        messages: state.history.map(m => ({ role: m.role, content: m.content })),
      }),
    });
    const data = await resp.json();
    const out  = data?.content?.[0]?.text || "";
    const m    = out.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    return { reply: out, order: {} };
  } catch (e) {
    console.error("aiReply error:", e);
    return { reply: "", order: {} };
  }
}

// ---------- Meta Send API ----------
async function graphSend(psid, text) {
  const url = `https://graph.facebook.com/${META_API_VER}/me/messages?access_token=${encodeURIComponent(META_PAGE_TOKEN)}`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: psid },
        messaging_type: "RESPONSE",
        message: { text },
      }),
    });
  } catch (e) { console.error("graphSend error:", e); }
}

// ---------- Cross-sell ----------
async function sendCrossSell(psid, purchasedProduct, customerName) {
  const bought = purchasedProduct.toLowerCase();
  const others = PRODUCTS.filter(p => !p.keys.some(k => bought.includes(k)));
  if (others.length === 0) return;

  const emojis = ["💄", "✨", "🖊️", "🧤", "🌸", "🪄", "💅"];
  const list = others.map((p, i) => {
    const sale = Math.round(p.price * (1 - CROSSSELL_DISCOUNT));
    return `${emojis[i % emojis.length]} ${p.name} — ${sale} ₾ (ნაცვლად ${p.price} ₾)`;
  }).join("\n");

  const name = customerName ? `${customerName}, ` : "";
  const msg =
    `${name}ჩვენ აქცია გვაქვს! ვინაიდან შეიძინეთ ჩვენგან, შეგვიძლია შემოგთავაზოთ 30%-იანი ფასდაკლება ნებისმიერ ქვევით ჩამოთვლილ პროდუქტზე ❤️\n\n` +
    list + "\n\n" +
    `⚡ შეთავაზება მოქმედებს მხოლოდ ახლა — სანამ ამ შეტყობინებას უპასუხებ!\n` +
    `დაინტერესების შემთხვევაში უბრალოდ მომწერე 😊`;

  await graphSend(psid, msg);
}

// ============================================================
//  Telegram
// ============================================================

function tgApi(method, params) {
  return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then(r => r.json()).catch(e => console.error("tgApi error:", e));
}

async function sendOrderToTelegram(platform, psid, o) {
  const now  = new Date();
  const pad  = n => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const id    = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const emoji    = platform === "Instagram" ? "📸" : "💬";
  const platCode = platform === "Instagram" ? "I" : "F";
  const dash     = v => (v && String(v).trim()) ? v : "—";

  const txt =
    `🛒 ახალი შეკვეთა! ${emoji} (${platform})\n\n` +
    `📦 პროდუქტი: ${dash(o.product)}\n` +
    `🔢 რაოდენობა: ${dash(o.quantity)}\n` +
    `👤 სახელი: ${dash(o.name)}\n` +
    `📞 ტელეფონი: ${dash(o.phone)}\n` +
    `📍 მისამართი: ${dash(o.address)}\n` +
    `📝 შეჯამება: ${dash(o.summary)}\n\n` +
    `🕒 ${stamp}`;

  const markup = {
    inline_keyboard: [
      [
        { text: "✅ დარეკილია", callback_data: `st|c|${id}` },
        { text: "❌ უარი",      callback_data: `st|x|${id}` },
      ],
      [
        { text: "📦 მომხმარებელს მივწერო?", callback_data: `fu|${platCode}|${psid}` },
      ],
    ],
  };

  for (const cid of TELEGRAM_CHAT_IDS) {
    await tgApi("sendMessage", { chat_id: cid, text: txt, reply_markup: markup });
  }
}

// ---------- Telegram Webhook — ✅/❌/📦 ──────────────────────
app.post("/telegram", async (req, res) => {
  res.sendStatus(200);
  const cb = req.body?.callback_query;
  if (!cb) return;

  const data  = cb.data || "";
  const msg   = cb.message || {};
  const parts = data.split("|");
  const by    = cb.from?.first_name || "";
  const hh    = new Date();
  const time  = `${String(hh.getHours()).padStart(2,"0")}:${String(hh.getMinutes()).padStart(2,"0")}`;

  // ✅ / ❌
  if (parts.length === 3 && parts[0] === "st") {
    const confirmed = parts[1] === "c";
    const label     = confirmed ? "✅ დარეკილია" : "❌ უარი";
    const newText   = (msg.text || "") + `\n\n— სტატუსი: ${label} (${by}, ${time})`;

    if (confirmed) {
      const fuMatch = (msg.reply_markup?.inline_keyboard || [])
        .flat().find(btn => btn.callback_data?.startsWith("fu|"));

      if (fuMatch) {
        const fp         = fuMatch.callback_data.split("|");
        const targetPsid = fp[2];
        const delayMs    = parseInt(process.env.FOLLOWUP_DELAY_MS || "120000");

        setTimeout(async () => {
          try {
            await graphSend(targetPsid, FOLLOWUP_MSG);
            const platform = fp[1] === "I" ? "Instagram" : "Facebook";
            const st = getState(`${platform}:${targetPsid}`);
            st.followup_sent = true;
          } catch (e) { console.error("followup error:", e); }
        }, delayMs);
      }

      const remaining = fuMatch ? { inline_keyboard: [[fuMatch]] } : { inline_keyboard: [] };
      const mins = Math.round((parseInt(process.env.FOLLOWUP_DELAY_MS || "120000")) / 60000);
      await tgApi("editMessageText", {
        chat_id: msg.chat?.id, message_id: msg.message_id,
        text: newText + `\n⏳ გამოხმაურება გაიგზავნება ${mins} წუთში...`,
        reply_markup: remaining,
      });
    } else {
      await tgApi("editMessageText", {
        chat_id: msg.chat?.id, message_id: msg.message_id,
        text: newText, reply_markup: { inline_keyboard: [] },
      });
    }
  }

  // 📦 ხელით გაგზავნა
  else if (parts.length === 3 && parts[0] === "fu") {
    const targetPsid = parts[2];
    await graphSend(targetPsid, FOLLOWUP_MSG);
    const newText = (msg.text || "") + `\n\n— 📦 გამოხმაურება გაიგზავნა ახლავე (${by}, ${time})`;
    await tgApi("editMessageText", {
      chat_id: msg.chat?.id, message_id: msg.message_id,
      text: newText, reply_markup: { inline_keyboard: [] },
    });
  }

  await tgApi("answerCallbackQuery", { callback_query_id: cb.id });
});

// ---------- Health check ----------
app.get("/", (_req, res) => res.send("FB/IG → Telegram bot is running ✅"));

app.listen(PORT, () => console.log(`Bot listening on :${PORT}`));
