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

// =========================================================
// أنواع الأسئلة
// =========================================================

const QUESTION_TYPES = [
  "منطق واستنتاج",
  "تسلسل أرقام",
  "اكتشاف نمط",
  "ترتيب ومقارنة",
  "علاقات منطقية",
  "حساب ذهني",
  "استنتاج من معلومات",
  "مقارنة كميات",
  "الوقت والتسلسل",
  "حل مشكلة قصيرة",
  "صناديق وأشياء",
  "اكتشاف المختلف",
  "تفكير عكسي",
  "احتمالات بسيطة",
  "مسائل أعمار",
  "مسائل مسافات",
  "ترتيب أحداث",
  "كلمات وحروف",
  "ماذا يحدث بعد ذلك",
  "لغز منطقي"
];


// =========================================================
// CORS
// =========================================================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}


// =========================================================
// JSON Response
// =========================================================

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...corsHeaders()
      }
    }
  );
}


// =========================================================
// انتظار
// =========================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// =========================================================
// Normalize
// =========================================================

function normalize(text) {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}


// =========================================================
// بناء Prompt
// =========================================================

function buildPrompt(level, previousQuestions) {

  const selected = [...QUESTION_TYPES]
    .sort(() => Math.random() - 0.5)
    .slice(0, QUESTIONS_PER_LEVEL);

  const typesText = selected
    .map((x, i) => `${i + 1}. ${x}`)
    .join("\n");

  const previousText = previousQuestions?.length
    ? `

هذه أسئلة سبق استخدامها في المسابقة.

ممنوع تكرارها أو إعادة نفس فكرتها أو قالبها:

${previousQuestions
  .map(q => `- ${q}`)
  .join("\n")}
`
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


// =========================================================
// Schema
// =========================================================

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
            type: {
              type: "STRING"
            },

            question: {
              type: "STRING"
            },

            answers: {
              type: "ARRAY",
              minItems: 4,
              maxItems: 4,
              items: {
                type: "STRING"
              }
            },

            correct_answer: {
              type: "STRING"
            }
          },

          required: [
            "type",
            "question",
            "answers",
            "correct_answer"
          ]
        }
      }
    },

    required: [
      "questions"
    ]
  };
}


// =========================================================
// التحقق من الأسئلة
// =========================================================

function validate(data) {

  if (
    !data ||
    !Array.isArray(data.questions) ||
    data.questions.length !== QUESTIONS_PER_LEVEL
  ) {
    throw new Error(
      "Gemini لم يُرجع 10 أسئلة بالضبط."
    );
  }

  const seen = new Set();

  for (let i = 0; i < data.questions.length; i++) {

    const q = data.questions[i];

    if (
      !q ||
      typeof q.question !== "string" ||
      !Array.isArray(q.answers) ||
      q.answers.length !== 4 ||
      typeof q.correct_answer !== "string"
    ) {
      throw new Error(
        `تنسيق السؤال رقم ${i + 1} غير صحيح.`
      );
    }

    const answers = q.answers.map(String);

    const uniqueAnswers = new Set(
      answers.map(normalize)
    );

    if (uniqueAnswers.size !== 4) {
      throw new Error(
        `يوجد تكرار في إجابات السؤال رقم ${i + 1}.`
      );
    }

    const correctExists = answers.some(
      answer =>
        normalize(answer) ===
        normalize(q.correct_answer)
    );

    if (!correctExists) {
      throw new Error(
        `الإجابة الصحيحة للسؤال رقم ${i + 1} غير موجودة ضمن الإجابات.`
      );
    }

    const questionKey =
      normalize(q.question);

    if (seen.has(questionKey)) {
      throw new Error(
        "يوجد سؤال مكرر داخل المجموعة."
      );
    }

    seen.add(questionKey);
  }

  return data.questions;
}


// =========================================================
// استخراج مدة الانتظار من رد Gemini
// =========================================================

function getRetryDelayMs(text) {

  try {

    const data = JSON.parse(text);

    const details =
      data?.error?.details;

    if (!Array.isArray(details)) {
      return null;
    }

    for (const detail of details) {

      if (
        detail?.["@type"] ===
        "type.googleapis.com/google.rpc.RetryInfo"
      ) {

        const retryDelay =
          detail.retryDelay;

        if (typeof retryDelay === "string") {

          const match =
            retryDelay.match(
              /^(\d+(?:\.\d+)?)s$/
            );

          if (match) {

            const seconds =
              Number(match[1]);

            if (
              Number.isFinite(seconds) &&
              seconds >= 0
            ) {
              return Math.ceil(
                seconds * 1000
              );
            }
          }
        }
      }
    }

  } catch (_) {}

  return null;
}


// =========================================================
// استخراج رسالة Gemini
// =========================================================

function getGeminiErrorMessage(
  status,
  text
) {

  try {

    const data =
      JSON.parse(text);

    const message =
      data?.error?.message;

    if (message) {
      return message;
    }

  } catch (_) {}

  return `HTTP ${status}: ${text.slice(0, 800)}`;
}


// =========================================================
// الاتصال بـ Gemini
// =========================================================

async function callGemini(env, prompt) {

  if (!env.GEMINI_API_KEY) {

    throw new Error(
      "لم يتم إعداد GEMINI_API_KEY في الخادم."
    );
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const body = {

    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],

    generationConfig: {

      responseMimeType:
        "application/json",

      responseSchema:
        schema()
    }
  };


  // =======================================================
  // محاولات الاتصال
  // =======================================================

  const fallbackDelays = [
    5000,
    10000,
    20000,
    40000,
    60000
  ];

  let lastError =
    "خطأ غير معروف من Gemini.";

  for (
    let attempt = 0;
    attempt <= fallbackDelays.length;
    attempt++
  ) {

    let response;

    try {

      response = await fetch(
        url,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-goog-api-key":
              env.GEMINI_API_KEY
          },

          body:
            JSON.stringify(body)
        }
      );

    } catch (networkError) {

      lastError =
        networkError?.message ||
        "تعذر الاتصال بخدمة Gemini.";

      if (
        attempt <
        fallbackDelays.length
      ) {

        await sleep(
          fallbackDelays[attempt]
        );

        continue;
      }

      throw new Error(
        `تعذر الاتصال بـ Gemini بعد عدة محاولات.\n${lastError}`
      );
    }


    const text =
      await response.text();


    // =====================================================
    // نجاح
    // =====================================================

    if (response.ok) {

      let result;

      try {

        result =
          JSON.parse(text);

      } catch (_) {

        throw new Error(
          "Gemini أعاد استجابة غير صالحة."
        );
      }


      const output =
        result
          ?.candidates?.[0]
          ?.content?.parts?.[0]
          ?.text;


      if (!output) {

        throw new Error(
          "Gemini لم يُرجع محتوى."
        );
      }


      try {

        return JSON.parse(output);

      } catch (_) {

        throw new Error(
          "Gemini أعاد JSON غير صالح."
        );
      }
    }


    // =====================================================
    // الخطأ
    // =====================================================

    lastError =
      getGeminiErrorMessage(
        response.status,
        text
      );


    // =====================================================
    // أخطاء مؤقتة:
    // 429 Rate Limit
    // 503 Service Unavailable
    // 500 Server Error
    // =====================================================

    const retryable =
      response.status === 429 ||
      response.status === 500 ||
      response.status === 502 ||
      response.status === 503 ||
      response.status === 504;


    if (!retryable) {

      throw new Error(
        `Gemini API (${response.status}): ${lastError}`
      );
    }


    // =====================================================
    // انتهت المحاولات
    // =====================================================

    if (
      attempt >=
      fallbackDelays.length
    ) {
      break;
    }


    // =====================================================
    // نحاول قراءة RetryInfo من Gemini
    // =====================================================

    const retryDelay =
      getRetryDelayMs(text);


    const delay =
      retryDelay !== null
        ? Math.max(
            retryDelay,
            fallbackDelays[attempt]
          )
        : fallbackDelays[attempt];


    // =====================================================
    // انتظار قبل المحاولة التالية
    // =====================================================

    await sleep(delay);
  }


  throw new Error(
    `تعذر الحصول على الأسئلة من Gemini بعد عدة محاولات.\n\n${lastError}`
  );
}


// =========================================================
// Worker
// =========================================================

export default {

  async fetch(request, env) {

    // =====================================================
    // OPTIONS
    // =====================================================

    if (
      request.method ===
      "OPTIONS"
    ) {

      return new Response(
        null,
        {
          headers:
            corsHeaders()
        }
      );
    }


    const url =
      new URL(request.url);


    // =====================================================
    // التحقق من الرابط
    // =====================================================

    if (
      url.pathname !==
        "/api/questions" ||
      request.method !==
        "POST"
    ) {

      return jsonResponse(
        {
          error:
            "Not found"
        },
        404
      );
    }


    // =====================================================
    // التحقق من Secret
    // =====================================================

    if (!env.GEMINI_API_KEY) {

      return jsonResponse(
        {
          error:
            "لم يتم إعداد GEMINI_API_KEY في الخادم."
        },
        500
      );
    }


    // =====================================================
    // تشغيل الطلب
    // =====================================================

    try {

      const body =
        await request.json();


      const level =
        body.level ||
        {
          difficulty:
            "سهل"
        };


      const previousQuestions =
        Array.isArray(
          body.previousQuestions
        )
          ? body.previousQuestions.slice(-30)
          : [];


      // ===================================================
      // بناء السؤال
      // ===================================================

      const prompt =
        buildPrompt(
          level,
          previousQuestions
        );


      // ===================================================
      // الاتصال بـ Gemini
      // ===================================================

      const result =
        await callGemini(
          env,
          prompt
        );


      // ===================================================
      // التحقق
      // ===================================================

      const questions =
        validate(result);


      // ===================================================
      // النجاح
      // ===================================================

      return jsonResponse(
        {
          questions
        },
        200
      );

    } catch (error) {

      console.error(
        "Brain Quiz Worker Error:",
        error
      );


      return jsonResponse(
        {
          error:
            error?.message ||
            "حدث خطأ غير معروف."
        },
        500
      );
    }
  }
};
