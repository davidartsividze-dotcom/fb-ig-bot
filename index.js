// ============================================================
//  Facebook + Instagram → Claude AI → Telegram ბოტი
//  - იღებს FB Page / Instagram მესიჯებს (Meta webhook)
//  - პასუხობს Claude AI-ით (ქართულად)
//  - აგროვებს შეკვეთას (სახელი/ტელეფონი/მისამართი)
//  - მზა შეკვეთას აგზავნის Telegram-ში ✅/❌ ღილაკებით
//  - 📦 ღილაკით გამოხმაურებას უგზავნის მომხმარებელს FB/IG-ზე
//  Railway-ზე გასაშვებად (Node 18+, მხოლოდ express).
// ============================================================

import express from "express";

const app = express();

// ---------- კონფიგი (Railway → Variables) ----------
const PORT               = process.env.PORT || 3000;
const META_PAGE_TOKEN    = process.env.META_PAGE_TOKEN    || "";
const META_VERIFY_TOKEN  = process.env.META_VERIFY_TOKEN  || "okayshop_verify_9x7p2k";
const META_API_VER       = process.env.META_API_VER       || "v21.0";
const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY  || "";
const AI_MODEL           = process.env.AI_MODEL           || "claude-sonnet-4-6";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_IDS  = (process.env.TELEGRAM_CHAT_IDS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

// გამოხმაურების შეტყობინება (შეიძლება Railway Variable-ით შეცვლა)
const FOLLOWUP_MSG = process.env.FOLLOWUP_MSG ||
  "გამარჯობა! 😊 იმედია პროდუქტი ხელში მიიღეთ! მოგეწონათ? თქვენი გამოხმაურება ძალიან მნიშვნელოვანია ჩვენთვის 🙏";

// პროდუქტების სია (cross-sell-ისთვის)
const PRODUCTS = [
  { name: "Derol ტუში",                  price: 29, keys: ["ტუში", "tushi"] },
  { name: "Derol ტონალური",              price: 35, keys: ["ტონალური", "tonaluri"] },
  { name: "Derol ლაინერი",               price: 20, keys: ["ლაინერი", "laineri"] },
  { name: "Derol წარბის გელი",           price: 35, keys: ["წარბის", "warbis"] },
  { name: "Soft Skin ტანის ხელთათმანი", price: 29, keys: ["ტანის", "tanis"] },
  { name: "Soft Skin სახის ხელთათმანი", price: 25, keys: ["სახის", "saxis"] },
  { name: "Maffick ქონსილერი",           price: 29, keys: ["ქონსილერი", "konsileri", "maffick"] },
];
const CROSSSELL_DISCOUNT = 0.30; // 30%

// მაღაზიის ცოდნა — AI-ს კონტექსტი
const SHOP_CONTEXT = process.env.SHOP_CONTEXT || `
შენ ხარ "Okayshop"-ის (okayshop.ge) გაყიდვების ასისტენტი Facebook/Instagram-ზე.
პასუხობ ქართულად, თბილად, თავაზიანად და მოკლედ. ემოჯი ზომიერად.

🛍️ პროდუქტები და ფასები:
- Derol ტუში — 29 ₾
- Derol ტონალური — 35 ₾
- Derol ლაინერი — 20 ₾
- Soft Skin ტანის ხელთათმანი — 29 ₾
- Soft Skin სახის ხელთათმანი — 25 ₾
- Derol წარბის გელი — 35 ₾
- Maffick ქონსილერი — 29 ₾

🚚 მიწოდება და გადახდა:
- თბილისი: მიწოდება უფასოა, მეორე დღეს.
- რეგიონები: +7 ₾, 2–3 სამუშაო დღეში, ზუსტ მისამართზე ვაწვდით ყველგან.
- გადახდა: ადგილზე, კურიერთან.

🎯 მთავარი მიზანი — შეკვეთის გაფორმება. შეკვეთისთვის გჭირდება:
1. რომელი პროდუქტი და რაოდენობა
2. სახელი
3. ტელეფონის ნომერი
4. მისამართი (ქალაქი + ზუსტი მისამართი)

წესები:
- პასუხი მოკლე და ბუნებრივი (1–3 წინადადება). სათითაოდ სთხოვე საჭირო მონაცემები.
- ფასს ზუსტად ეუბნები ზემოთ სიიდან. ფაქტებს ნუ მოიგონებ.
- თუ კითხვა სცდება შენს ცოდნას — უთხარი, რომ ოპერატორი მალე დაუკავშირდება.
- როცა პროდუქტი + სახელი + ტელეფონი + მისამართი გაქვს — დაუდასტურე შეკვეთა
  და უთხარი, რომ მალე დაურეკავენ დასადასტურებლად.
`.trim();

app.use(express.json());

// ---------- დროებითი debug-ლოგი ----------
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

// ---------- in-memory საუბრის მდგომარეობა ----------
const chats = new Map();
function getState(key) {
  if (!chats.has(key)) chats.set(key, { history: [], order: {}, order_sent: false, followup_sent: false, last_mid: null });
  return chats.get(key);
}

// ============================================================
//  Meta Webhook
// ============================================================

app.get("/webhook", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
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
      try {
        await handleEvent(platform, event);
      } catch (e) {
        console.error("handleEvent error:", e);
      }
    }
  }
});

async function handleEvent(platform, event) {
  if (!event.message || event.message.is_echo) return;
  const psid = event.sender && event.sender.id;
  if (!psid) return;

  const mid  = event.message.mid || "";
  const text = (event.message.text || "").trim();

  const key   = `${platform}:${psid}`;
  const state = getState(key);

  if (mid && state.last_mid === mid) return;
  state.last_mid = mid;

  if (!text) {
    await graphSend(psid, "მადლობა! 🙏 მოკლედ მომწერეთ ტექსტით, რით დაგეხმაროთ?");
    return;
  }

  state.history.push({ role: "user", content: text });
  state.history = state.history.slice(-20);

  const ai = await aiReply(state);
  let reply = (ai.reply || "").trim();
  if (!reply) reply = "ერთ წუთს, ოპერატორი მალე გიპასუხებთ 🙏";

  if (ai.order && typeof ai.order === "object") {
    for (const k of ["product", "quantity", "name", "phone", "address", "summary"]) {
      if (ai.order[k]) state.order[k] = String(ai.order[k]).trim();
    }
  }

  const o = state.order;
  const complete = o.name && o.phone && o.address;
  if (complete && !state.order_sent) {
    await sendOrderToTelegram(platform, psid, o);
    state.order_sent = true;
    // cross-sell — 3 წამში გავაგზავნოთ (მაშინ, სანამ AI-ს პასუხი წასულია)
    setTimeout(() => sendCrossSell(psid, o.product || ""), 3000);
  }

  await graphSend(psid, reply);
  state.history.push({ role: "assistant", content: reply });
  state.history = state.history.slice(-20);
}

// ---------- Claude AI ----------
async function aiReply(state) {
  let sys;

  if (state.followup_sent) {
    // გამოხმაურების რეჟიმი — შეკვეთა უკვე გაფორმებულია, ახლა მომხმარებელი შეაფასებს
    sys = SHOP_CONTEXT + "\n\n" +
      "⚠️ ᲛᲜᲘᲨᲕᲜᲔᲚᲝᲕᲐᲜᲘ: ეს მომხმარებელი უკვე შეკვეთას ფლობს. შენ კი გამოხმაურება სთხოვე.\n" +
      "ახლა ის გვიზიარებს შთაბეჭდილებებს პროდუქტზე.\n" +
      "რეაგირება: მადლობა გადაუხადე გულწრფელად, 1-2 წინადადებით. ნუ სთხოვ ახალ შეკვეთას.\n" +
      "JSON ფორმატი:\n" +
      '{"reply":"<მადლობა ქართულად, 1-2 წინადადება>","order":{}}\n' +
      "JSON-ის გარდა არაფერი დაწერო.";
  } else {
    // ჩვეულებრივი შეკვეთის რეჟიმი
    sys = SHOP_CONTEXT + "\n\n" +
      "ამ მომხმარებელზე უკვე ცნობილია: " + JSON.stringify(state.order) + "\n\n" +
      "უპასუხე მხოლოდ ვალიდური JSON-ით:\n" +
      '{"reply":"<პასუხი ქართულად>","order":{"product":"","quantity":"","name":"","phone":"","address":"","summary":""}}\n' +
      "ველების მნიშვნელობა:\n" +
      "- product: რომელი პროდუქტი უნდა (თუ ერთი პროდუქტია, ჩაწერე ის)\n" +
      "- quantity: რაოდენობა (თუ არ უთქვამს, ჩათვალე 1)\n" +
      "- name / phone / address: კლიენტის სახელი / ტელეფონი / მისამართი\n" +
      "- summary: 1 წინადადებით რა უნდა კლიენტს (ქართულად)\n" +
      "უცნობი ველი დატოვე ცარიელი (\"\"). JSON-ის გარდა არაფერი დაწერო.";
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
    const out = data?.content?.[0]?.text || "";
    const match = out.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return { reply: out, order: {} };
  } catch (e) {
    console.error("aiReply error:", e);
    return { reply: "", order: {} };
  }
}

// ---------- Cross-sell ----------
async function sendCrossSell(psid, purchasedProduct) {
  const bought = purchasedProduct.toLowerCase();

  // შეძენილი პროდუქტი გამოვრიცხოთ
  const others = PRODUCTS.filter(p =>
    !p.keys.some(k => bought.includes(k))
  );

  if (others.length === 0) return; // ყველა პროდუქტი შეიძინა

  const discountedList = others.map(p => {
    const sale = Math.round(p.price * (1 - CROSSSELL_DISCOUNT));
    return `• ${p.name}: ~~${p.price}₾~~ → ${sale}₾`;
  }).join("\n");

  const msg =
    `🎁 სპეციალური შეთავაზება მხოლოდ შენთვის!\n\n` +
    `შენი შეკვეთის გამო დღეს გაქვს 30% ფასდაკლება:\n\n` +
    discountedList + `\n\n` +
    `⏰ შეთავაზება მოქმედებს 24 საათი.\n` +
    `დაინტერესების შემთხვევაში უბრალოდ მომწერე! 😊`;

  await graphSend(psid, msg);
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
  } catch (e) {
    console.error("graphSend error:", e);
  }
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
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const id = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const emoji = platform === "Instagram" ? "📸" : "💬";
  const platCode = platform === "Instagram" ? "I" : "F";
  const dash = v => (v && String(v).trim()) ? v : "—";

  const txt =
    `🛒 ახალი შეკვეთა! ${emoji} (${platform})\n\n` +
    `📦 პროდუქტი: ${dash(o.product)}\n` +
    `🔢 რაოდენობა: ${dash(o.quantity)}\n` +
    `👤 სახელი: ${dash(o.name)}\n` +
    `📞 ტელეფონი: ${dash(o.phone)}\n` +
    `📍 მისამართი: ${dash(o.address)}\n` +
    `📝 შეჯამება: ${dash(o.summary)}\n\n` +
    `🕒 ${stamp}`;

  // callback_data ლიმიტი 64 ბაიტი — psid ~15 სიმბოლო, ჯდება
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

// ---------- Telegram Webhook — ✅/❌/📦 ღილაკების დამუშავება ----------
app.post("/telegram", async (req, res) => {
  res.sendStatus(200);
  const update = req.body;
  const cb = update && update.callback_query;
  if (!cb) return;

  const data  = cb.data || "";
  const msg   = cb.message || {};
  const parts = data.split("|");
  const by    = cb.from?.first_name || "";
  const hh    = new Date();
  const time  = `${String(hh.getHours()).padStart(2,"0")}:${String(hh.getMinutes()).padStart(2,"0")}`;

  // ✅ დარეკილია / ❌ უარი
  if (parts.length === 3 && parts[0] === "st") {
    const confirmed = parts[1] === "c";
    const label     = confirmed ? "✅ დარეკილია" : "❌ უარი";
    const newText   = (msg.text || "") + `\n\n— სტატუსი: ${label} (${by}, ${time})`;

    if (confirmed) {
      // ✅ შემდეგ — 📦 ღილაკიდან psid ამოვიღოთ და 2 წუთში ავტო-გავაგზავნოთ
      const fuMatch = (msg.reply_markup?.inline_keyboard || [])
        .flat()
        .find(btn => btn.callback_data?.startsWith("fu|"));

      if (fuMatch) {
        const fuParts    = fuMatch.callback_data.split("|");
        const targetPsid = fuParts[2];
        const delayMs    = parseInt(process.env.FOLLOWUP_DELAY_MS || "120000"); // default 2 წუთი

        setTimeout(async () => {
          try {
            await graphSend(targetPsid, FOLLOWUP_MSG);
            // state-ში ვნიშნავთ რომ გამოხმაურება გავაგზავნეთ
            const platform = fuParts[1] === "I" ? "Instagram" : "Facebook";
            const st = getState(`${platform}:${targetPsid}`);
            st.followup_sent = true;
            console.log("followup sent to", targetPsid);
          } catch (e) {
            console.error("followup error:", e);
          }
        }, delayMs);
      }

      // ✅ შემდეგ ყველა ღილაკი ქრება (ავტო-გაგზავნა მოხდება)
      await tgApi("editMessageText", {
        chat_id:    msg.chat?.id,
        message_id: msg.message_id,
        text:       newText + `\n⏳ გამოხმაურება გაიგზავნება ${Math.round((parseInt(process.env.FOLLOWUP_DELAY_MS || "120000"))/60000)} წუთში...`,
        reply_markup: { inline_keyboard: [] },
      });
    } else {
      // ❌ შემდეგ ყველა ღილაკი ქრება
      await tgApi("editMessageText", {
        chat_id:    msg.chat?.id,
        message_id: msg.message_id,
        text:       newText,
        reply_markup: { inline_keyboard: [] },
      });
    }
  }

  // 📦 გამოხმაურება — FB/IG-ზე მიუწერე მომხმარებელს
  else if (parts.length === 3 && parts[0] === "fu") {
    const targetPsid = parts[2];

    // FB/IG-ზე გზავნის შეტყობინებას
    await graphSend(targetPsid, FOLLOWUP_MSG);

    // Telegram-ში განახლებს
    const newText = (msg.text || "") + `\n\n— 📦 გამოხმაურება გაიგზავნა ახლავე (${by}, ${time})`;
    await tgApi("editMessageText", {
      chat_id:    msg.chat?.id,
      message_id: msg.message_id,
      text:       newText,
      reply_markup: { inline_keyboard: [] },
    });
  }

  await tgApi("answerCallbackQuery", { callback_query_id: cb.id });
});

// ---------- Health check ----------
app.get("/", (_req, res) => res.send("FB/IG → Telegram bot is running ✅"));

app.listen(PORT, () => console.log(`Bot listening on :${PORT}`));
