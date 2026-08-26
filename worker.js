// Cloudflare Worker - خادم Gemini لمسابقة الذكاء
//
// ضع GEMINI_API_KEY في Cloudflare Worker Secrets.
// لا تضع المفتاح داخل GitHub أو app.js.
//
// النشر:
//   npx wrangler secret put GEMINI_API_KEY
//   npx wrangler deploy
//
// بعد النشر ضع رابط الـ Worker في API_BASE_URL داخل app.js.

const MODEL = "gemini-3.6-flash";
const QUESTIONS_PER_LEVEL = 10;

const QUESTION_TYPES = [
  "منطق واستنتاج", "تسلسل أرقام", "اكتشاف نمط", "ترتيب ومقارنة",
  "علاقات منطقية", "حساب ذهني", "استنتاج من معلومات", "مقارنة كميات",
  "الوقت والتسلسل", "حل مشكلة قصيرة", "صناديق وأشياء", "اكتشاف المختلف",
  "تفكير عكسي", "احتمالات بسيطة", "مسائل أعمار", "مسائل مسافات",
  "ترتيب أحداث", "كلمات وحروف", "ماذا يحدث بعد ذلك", "لغز منطقي"
];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders()
    }
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalize(text) {
  return String(text ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildPrompt(level, previousQuestions) {
  const selected = [...QUESTION_TYPES]
    .sort(() => Math.random() - 0.5)
    .slice(0, QUESTIONS_PER_LEVEL);

  const typesText = selected.map((x, i) => `${i + 1}. ${x}`).join("\n");

  const previousText = previousQuestions?.length
    ? `

هذه أسئلة سبق استخدامها في المسابقة.
ممنوع تكرارها أو إعادة نفس فكرتها أو قالبها:

${previousQuestions.map(q => `- ${q}`).join("\n")}`
    : "";

  return `
أنت مصمم اختبار ذكاء وقدرات عقلية احترافي.

أنشئ بالضبط 10 أسئلة جديدة للمستوى:
${level.difficulty}

المسابقة باللغة العربية.

قواعد عامة:
- الأسئلة يجب أن تقيس التفكير وليس المعلومات العامة.
- ممنوع الاعتماد على الدول أو الشعوب أو السياسة أو الدين أو التاريخ أو الجغرافيا أو المشاهير أو معلومات تحتاج معرفة مسبقة.
- الأسئلة عادلة لأي شخص في العالم.

مستوى الصعوبة:
- إذا كان المستوى "سهل": الحل مباشر ويحتاج تفكيرًا بسيطًا.
- إذا كان المستوى "متوسط": يحتاج السؤال خطوتين أو أكثر من التفكير، أو ملاحظة علاقة غير مباشرة، لكن لا تجعله معقدًا جدًا.

التنوع:
استخدم الأنواع التالية مرة واحدة فقط:
${typesText}

لا تستخدم نفس نوع التفكير مرتين.
لا تنشئ 10 أسئلة بنفس القالب.
ممنوع تغيير الأسماء أو الأرقام فقط في نفس القالب.
كل سؤال يجب أن تكون له طريقة تفكير مختلفة.

الإجابات:
- 4 إجابات مختلفة.
- إجابة واحدة صحيحة فقط.
- يجب أن تكون الإجابة الصحيحة موجودة حرفيًا داخل قائمة الإجابات.
- لا تجعل إجابتين صحيحتين.

اللغة:
- استخدم العربية الواضحة والبسيطة.
- لا تستخدم الرموز التعبيرية داخل السؤال.
- لا تستخدم أسماء أشخاص حقيقيين.
- لا تكتب شرح الحل.

${previousText}

أعد JSON فقط حسب المخطط المطلوب.
`;
}

function schema() {
  return {
    type: "OBJECT",
    properties: {
      questions: {
        type: "ARRAY",
        minItems: QUESTIONS_PER_LEVEL,
        maxItems: QUESTIONS_PER_LEVEL,
        items: {
          type: "OBJECT",
          properties: {
            type: { type: "STRING" },
            question: { type: "STRING" },
            answers: {
              type: "ARRAY",
              minItems: 4,
              maxItems: 4,
              items: { type: "STRING" }
            },
            correct_answer: { type: "STRING" }
          },
          required: ["type", "question", "answers", "correct_answer"]
        }
      }
    },
    required: ["questions"]
  };
}

function validate(data) {
  if (!data || !Array.isArray(data.questions) ||
      data.questions.length !== QUESTIONS_PER_LEVEL) {
    throw new Error("Gemini لم يُرجع 10 أسئلة بالضبط.");
  }

  const seen = new Set();

  for (const q of data.questions) {
    if (!q || typeof q.question !== "string" ||
        !Array.isArray(q.answers) || q.answers.length !== 4 ||
        typeof q.correct_answer !== "string") {
      throw new Error("تنسيق أحد الأسئلة غير صحيح.");
    }

    const answers = q.answers.map(String);
    if (new Set(answers.map(normalize)).size !== 4) {
      throw new Error("يوجد تكرار في إجابات أحد الأسئلة.");
    }

    if (!answers.some(a => normalize(a) === normalize(q.correct_answer))) {
      throw new Error("الإجابة الصحيحة غير موجودة ضمن الإجابات.");
    }

    const key = normalize(q.question);
    if (seen.has(key)) {
      throw new Error("يوجد سؤال مكرر داخل المجموعة.");
    }
    seen.add(key);
  }

  return data.questions;
}

async function callGemini(env, prompt) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema()
    }
  };

  const delays = [10000, 20000, 40000];
  let lastError = "";

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY
      },
      body: JSON.stringify(body)
    });

    const text = await response.text();

    if (response.ok) {
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("Gemini أعاد استجابة غير صالحة.");
      }

      const output =
        result?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!output) {
        throw new Error("Gemini لم يُرجع محتوى.");
      }

      return JSON.parse(output);
    }

    if (response.status !== 429) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 800)}`);
    }

    lastError = text;

    if (attempt < delays.length) {
      await sleep(delays[attempt]);
    }
  }

  throw new Error(
    "HTTP 429: تم تجاوز حد الطلبات مؤقتًا.\n" +
    "انتظر قليلًا ثم حاول مرة أخرى.\n\n" +
    lastError.slice(0, 500)
  );
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (url.pathname !== "/api/questions" || request.method !== "POST") {
      return jsonResponse({ error: "Not found" }, 404);
    }

    if (!env.GEMINI_API_KEY) {
      return jsonResponse({
        error: "لم يتم إعداد GEMINI_API_KEY في الخادم."
      }, 500);
    }

    try {
      const body = await request.json();
      const level = body.level || { difficulty: "سهل" };
      const previousQuestions = Array.isArray(body.previousQuestions)
        ? body.previousQuestions.slice(-30)
        : [];

      const prompt = buildPrompt(level, previousQuestions);
      const result = await callGemini(env, prompt);
      const questions = validate(result);

      return jsonResponse({ questions });
    } catch (error) {
      return jsonResponse({
        error: error.message || "حدث خطأ غير معروف."
      }, 500);
    }
  }
};
