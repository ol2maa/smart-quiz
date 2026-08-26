// =========================================================
// مسابقة الذكاء - Cloudflare Worker
// =========================================================
//
// يقوم Gemini بإنشاء 20 سؤالًا في طلب واحد:
// 10 سهل + 10 متوسط
//
// ضع GEMINI_API_KEY في Cloudflare Worker Secrets.
// لا تضع المفتاح داخل GitHub أو app.js.
// =========================================================

const MODEL = "gemini-3.6-flash";

const QUESTIONS_PER_LEVEL = 10;
const TOTAL_QUESTIONS = 20;

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
// Normalize
// =========================================================

function normalize(text) {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}


// =========================================================
// اختيار أنواع الأسئلة
// =========================================================

function selectQuestionTypes() {

  return [...QUESTION_TYPES]
    .sort(() => Math.random() - 0.5)
    .slice(0, TOTAL_QUESTIONS);
}


// =========================================================
// بناء Prompt
// =========================================================

function buildPrompt() {

  const selected =
    selectQuestionTypes();

  const typesText =
    selected
      .map((x, i) => `${i + 1}. ${x}`)
      .join("\n");

  return `
أنت مصمم اختبار ذكاء وقدرات عقلية احترافي.

أنشئ بالضبط:

10 أسئلة للمستوى "سهل"
و
10 أسئلة للمستوى "متوسط"

أي 20 سؤالًا إجمالًا.

المسابقة باللغة العربية.

==================================================
قواعد عامة
==================================================

- الأسئلة تقيس التفكير والمنطق وليس المعلومات العامة.
- ممنوع الاعتماد على الدول أو الشعوب أو السياسة أو الدين أو التاريخ أو الجغرافيا أو المشاهير.
- لا تحتاج الأسئلة إلى معرفة مسبقة.
- الأسئلة عادلة لأي شخص في العالم.
- استخدم العربية الواضحة والبسيطة.
- لا تستخدم الرموز التعبيرية داخل الأسئلة.
- لا تستخدم أسماء أشخاص حقيقيين.
- لا تكتب شرح الحل.

==================================================
المستوى السهل
==================================================

أنشئ 10 أسئلة سهلة.

الحل يجب أن يكون مباشرًا ويحتاج تفكيرًا بسيطًا.

لا تجعلها تافهة جدًا.

==================================================
المستوى المتوسط
==================================================

أنشئ 10 أسئلة متوسطة.

يجب أن تحتاج إلى خطوتين أو أكثر من التفكير،
أو ملاحظة علاقة غير مباشرة.

لكن لا تجعلها معقدة جدًا.

==================================================
التنوع
==================================================

استخدم أنواع التفكير التالية.

${typesText}

لا تستخدم نفس نوع التفكير أكثر من مرة قدر الإمكان.

ممنوع إنشاء 20 سؤالًا بنفس القالب.

ممنوع تغيير الأسماء أو الأرقام فقط في نفس السؤال.

كل سؤال يجب أن يكون مختلفًا فعلًا عن الآخر.

==================================================
الإجابات
==================================================

كل سؤال يجب أن يحتوي على:

- 4 إجابات مختلفة.
- إجابة واحدة صحيحة فقط.
- الإجابة الصحيحة يجب أن تكون موجودة حرفيًا داخل قائمة الإجابات.
- لا تجعل إجابتين صحيحتين.

==================================================
مهم جدًا
==================================================

يجب أن يكون عدد الأسئلة:

easy = 10

medium = 10

ولا يجوز أن يكون أقل أو أكثر.

أعد JSON فقط حسب المخطط المطلوب.
`;
}


// =========================================================
// Schema
// =========================================================

function schema() {

  const questionSchema = {
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
  };


  return {

    type: "OBJECT",

    properties: {

      easy: {
        type: "ARRAY",

        minItems: 10,
        maxItems: 10,

        items: questionSchema
      },

      medium: {
        type: "ARRAY",

        minItems: 10,
        maxItems: 10,

        items: questionSchema
      }
    },

    required: [
      "easy",
      "medium"
    ]
  };
}


// =========================================================
// التحقق من سؤال واحد
// =========================================================

function validateQuestion(q, index, levelName) {

  if (
    !q ||
    typeof q.question !== "string" ||
    !Array.isArray(q.answers) ||
    q.answers.length !== 4 ||
    typeof q.correct_answer !== "string"
  ) {

    throw new Error(
      `السؤال ${levelName} رقم ${index + 1} غير صحيح.`
    );
  }


  const answers =
    q.answers.map(String);


  const unique =
    new Set(
      answers.map(normalize)
    );


  if (unique.size !== 4) {

    throw new Error(
      `السؤال ${levelName} رقم ${index + 1} يحتوي إجابات مكررة.`
    );
  }


  const correctExists =
    answers.some(
      answer =>
        normalize(answer) ===
        normalize(q.correct_answer)
    );


  if (!correctExists) {

    throw new Error(
      `الإجابة الصحيحة للسؤال ${levelName} رقم ${index + 1} غير موجودة ضمن الإجابات.`
    );
  }
}


// =========================================================
// التحقق من المجموعة
// =========================================================

function validateLevelQuestions(
  questions,
  levelName
) {

  if (
    !Array.isArray(questions) ||
    questions.length !== QUESTIONS_PER_LEVEL
  ) {

    throw new Error(
      `Gemini لم يُرجع 10 أسئلة للمستوى ${levelName}.`
    );
  }


  const seen =
    new Set();


  for (
    let i = 0;
    i < questions.length;
    i++
  ) {

    const q =
      questions[i];


    validateQuestion(
      q,
      i,
      levelName
    );


    const key =
      normalize(q.question);


    if (seen.has(key)) {

      throw new Error(
        `يوجد سؤال مكرر داخل المستوى ${levelName}.`
      );
    }


    seen.add(key);
  }


  return questions;
}


// =========================================================
// التحقق من المستويين
// =========================================================

function validateResult(data) {

  if (!data) {

    throw new Error(
      "Gemini لم يُرجع بيانات."
    );
  }


  const easy =
    validateLevelQuestions(
      data.easy,
      "السهل"
    );


  const medium =
    validateLevelQuestions(
      data.medium,
      "المتوسط"
    );


  const allQuestions = [
    ...easy,
    ...medium
  ];


  const allSeen =
    new Set();


  for (const q of allQuestions) {

    const key =
      normalize(q.question);


    if (allSeen.has(key)) {

      throw new Error(
        "Gemini أنشأ سؤالًا مكررًا بين المستويين."
      );
    }


    allSeen.add(key);
  }


  return {
    easy,
    medium
  };
}


// =========================================================
// الاتصال بـ Gemini
// =========================================================

async function callGemini(
  env,
  prompt
) {

  if (!env.GEMINI_API_KEY) {

    throw new Error(
      "GEMINI_API_KEY غير موجود في Cloudflare Secrets."
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
        schema(),

      temperature:
        0.9,

      maxOutputTokens:
        12000
    }
  };


  // محاولة أولى
  let response =
    await fetch(
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


  let text =
    await response.text();


  // ======================================================
  // إذا كان 429، ننتظر 8 ثوانٍ فقط ثم نحاول مرة ثانية
  // ======================================================

  if (
    response.status === 429
  ) {

    await new Promise(
      resolve =>
        setTimeout(resolve, 8000)
    );


    response =
      await fetch(
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


    text =
      await response.text();
  }


  // ======================================================
  // أي خطأ من Gemini
  // ======================================================

  if (!response.ok) {

    let errorMessage =
      `Gemini API HTTP ${response.status}`;


    try {

      const errorData =
        JSON.parse(text);


      if (
        errorData?.error?.message
      ) {

        errorMessage =
          errorData.error.message;
      }

    } catch (_) {
      // تجاهل JSON غير الصالح
    }


    if (
      response.status === 429
    ) {

      throw new Error(
        "Gemini مشغول أو تم تجاوز حد الطلبات مؤقتًا. حاول مرة أخرى بعد قليل."
      );
    }


    if (
      response.status === 401 ||
      response.status === 403
    ) {

      throw new Error(
        "مفتاح Gemini غير صالح أو ليس لديه صلاحية استخدام API."
      );
    }


    throw new Error(
      errorMessage
    );
  }


  // ======================================================
  // قراءة الاستجابة
  // ======================================================

  let result;


  try {

    result =
      JSON.parse(text);

  } catch (_) {

    throw new Error(
      "Gemini أعاد استجابة غير صالحة."
    );
  }


  const candidate =
    result?.candidates?.[0];


  if (!candidate) {

    const blockReason =
      result?.promptFeedback?.blockReason;


    if (blockReason) {

      throw new Error(
        `تم رفض طلب Gemini. السبب: ${blockReason}`
      );
    }


    throw new Error(
      "Gemini لم يُرجع نتيجة."
    );
  }


  const output =
    candidate?.content?.parts?.[0]?.text;


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


// =========================================================
// Worker
// =========================================================

export default {

  async fetch(
    request,
    env
  ) {

    // OPTIONS
    if (
      request.method === "OPTIONS"
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


    // ====================================================
    // التحقق من المسار
    // ====================================================

    if (
      url.pathname !==
        "/api/questions" ||
      request.method !== "POST"
    ) {

      return jsonResponse(
        {
          error:
            "Not found"
        },
        404
      );
    }


    // ====================================================
    // التحقق من المفتاح
    // ====================================================

    if (
      !env.GEMINI_API_KEY
    ) {

      return jsonResponse(
        {
          error:
            "GEMINI_API_KEY غير موجود في Cloudflare Secrets."
        },
        500
      );
    }


    try {

      // نقرأ Body حتى لو لم نستخدمه حاليًا
      try {
        await request.json();
      } catch (_) {
        // لا مشكلة
      }


      // ==================================================
      // طلب Gemini واحد فقط
      // ==================================================

      const prompt =
        buildPrompt();


      const result =
        await callGemini(
          env,
          prompt
        );


      // ==================================================
      // التحقق
      // ==================================================

      const questions =
        validateResult(result);


      // ==================================================
      // خلط الإجابات والأسئلة
      // ==================================================

      for (
        const level
        of ["easy", "medium"]
      ) {

        questions[level].sort(
          () =>
            Math.random() - 0.5
        );


        for (
          const q
          of questions[level]
        ) {

          q.answers.sort(
            () =>
              Math.random() - 0.5
          );
        }
      }


      // ==================================================
      // إرسال النتيجة
      // ==================================================

      return jsonResponse(
        {
          ok: true,
          easy:
            questions.easy,
          medium:
            questions.medium
        }
      );

    } catch (error) {

      console.error(
        "Worker error:",
        error
      );


      return jsonResponse(
        {
          ok: false,

          error:
            error?.message ||
            "حدث خطأ غير معروف في الخادم."
        },
        500
      );
    }
  }
};
