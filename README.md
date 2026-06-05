# FB/IG → Telegram ბოტი (Railway)

Facebook და Instagram მესიჯებზე ავტომატური პასუხი Claude AI-ით.
შეკვეთას (სახელი / ტელეფონი / მისამართი) აგროვებს და Telegram-ში აგზავნის ✅/❌ ღილაკებით.

---

## რას აკეთებს

```
FB / IG მესიჯი → /webhook → Claude AI (ქართული პასუხი)
                    ↓
   აგროვებს: სახელი + ტელეფონი + მისამართი
                    ↓
   მზა შეკვეთა → Telegram (✅ დარეკილია / ❌ უარი)
```

ღილაკებზე დაჭერა მუშავდება `/telegram` endpoint-ზე.

---

## ნაბიჯი 1 — GitHub რეპო

1. შექმენი ახალი რეპო GitHub-ზე (მაგ. `fb-ig-bot`)
2. ატვირთე ამ საქაღალდის ფაილები:
   ```
   git init
   git add .
   git commit -m "FB/IG → Telegram bot"
   git branch -M main
   git remote add origin https://github.com/USERNAME/fb-ig-bot.git
   git push -u origin main
   ```

---

## ნაბიჯი 2 — Railway deploy

1. გადადი https://railway.app → **New Project** → **Deploy from GitHub repo**
2. აირჩიე შენი `fb-ig-bot` რეპო → Railway თვითონ ააწყობს (`npm install` + `npm start`)
3. **Variables** ჩანართში დაამატე (იხ. `.env.example`):
   - `META_PAGE_TOKEN`
   - `META_VERIFY_TOKEN` (მაგ. `okayshop_verify_9x7p2k`)
   - `ANTHROPIC_API_KEY`
   - `AI_MODEL` (`claude-sonnet-4-6`)
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_IDS` (მძიმით: `697329223,1753816948`)
4. **Settings → Networking → Generate Domain** → მიიღებ public URL-ს, მაგ:
   ```
   https://fb-ig-bot-production.up.railway.app
   ```

---

## ნაბიჯი 3 — Telegram webhook (✅/❌ ღილაკებისთვის)

ბრაუზერში გახსენი (ჩაანაცვლე TOKEN და URL):
```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<railway-domain>/telegram
```
პასუხი: `{"ok":true,...}` ✅

> ⚠️ თუ იგივე Telegram ბოტს სხვაგანაც იყენებ (მაგ. საიტის `bot.php`), webhook ერთ
> მისამართზე უნდა იყოს. ამ ბოტისთვის სჯობს **ცალკე ბოტი** (BotFather → ახალი ტოკენი).

---

## ნაბიჯი 4 — Meta webhook

Meta App → Messenger/Instagram → Webhooks:
- **Callback URL:** `https://<railway-domain>/webhook`
- **Verify token:** იგივე, რაც `META_VERIFY_TOKEN`
- Subscribe fields: `messages`, `messaging_postbacks`

---

## ლოკალური გაშვება (ტესტი)

```
npm install
cp .env.example .env   # შეავსე ცვლადები
npm start
```

---

## შენიშვნა მონაცემებზე

საუბრის მდგომარეობა in-memory-შია — Railway-ს restart-ზე იშლება (კონტექსტი).
შეკვეთები Telegram-ში ინახება (ეს არის მუდმივი ჩანაწერი).
თუ მოგვიანებით გინდა მუდმივი ბაზა — დაამატე Railway Postgres და შევცვლი `chats`-ს.
