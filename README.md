# مسابقة الذكاء 🧠

نسخة ويب من لعبة Pythonista.

## مكونات المشروع

- `index.html` — واجهة اللعبة.
- `style.css` — التصميم المتجاوب للآيفون والكمبيوتر.
- `app.js` — منطق اللعبة.
- `worker.js` — خادم Gemini لـ Cloudflare Workers.
- `wrangler.toml` — إعداد Cloudflare Worker.

## مهم جدًا

لا تضع مفتاح Gemini داخل `app.js` أو GitHub.

ضعه كـ Secret في Cloudflare Worker باسم:

`GEMINI_API_KEY`

ثم ضع رابط الـ Worker في:

`API_BASE_URL`

داخل `app.js`.

## النشر

### 1. نشر الخادم

ثبّت Wrangler ثم:

```bash
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

سيظهر لك رابط شبيه:

```text
https://مسابقة-الذكاء-api.<حسابك>.workers.dev
```

### 2. ربط الواجهة

افتح `app.js` وضع رابط الـ Worker:

```javascript
const API_BASE_URL = "https://رابط-الخادم-هنا";
```

### 3. GitHub Pages

ارفع الملفات إلى مستودع GitHub، ثم فعّل:

Settings → Pages → Deploy from branch → main → /(root)

بعدها تحصل على رابط قابل للمشاركة.

## ملاحظة

GitHub Pages يستضيف الواجهة فقط ولا يشغّل Python أو الخادم.
لذلك استخدمنا Cloudflare Worker كخادم صغير وآمن لإخفاء مفتاح Gemini.
