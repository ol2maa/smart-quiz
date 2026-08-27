// =========================================================
// مسابقة الذكاء - Cloudflare Worker
// =========================================================
//
// Gemini ينشئ 20 سؤالًا في طلب واحد:
// 10 سهل + 10 متوسط
//
// ضع GEMINI_API_KEY في Cloudflare Worker Secrets.
// لا تضع المفتاح داخل GitHub أو app.js.
// =========================================================


const MODEL = "gemini-3.6-flash";

const QUESTIONS_PER_LEVEL = 10;
const TOTAL_QUESTIONS = 20;


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
        "Content-Type":
          "application/json; charset=utf-8",

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
- لا تجعل السؤال يعتمد على معلومة خارجية.
- يجب أن يكون لكل سؤال إجابة واحدة صحيحة فقط.

==================================================
المستوى السهل
==================================================

أنشئ 10 أسئلة سهلة.

الحل يجب أن يكون مباشرًا ويحتاج تفكيرًا بسيطًا.

لا تجعلها تافهة جدًا.

يجب أن تكون الأسئلة متنوعة فعلًا.

==================================================
المستوى المتوسط
==================================================

أنشئ 10 أسئلة متوسطة.

يجب أن تحتاج إلى خطوتين أو أكثر من التفكير،
أو ملاحظة علاقة غير مباشرة.

لكن لا تجعلها معقدة جدًا.

يجب أن تكون أصعب بوضوح من المستوى السهل.

==================================================
التنوع
==================================================

استخدم أنواع التفكير التالية:

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
- اجعل الإجابات الخاطئة منطقية وليست سخيفة جدًا.

==================================================
مهم جدًا
==================================================

يجب أن يكون الناتج:

easy = 10 أسئلة بالضبط

medium = 10 أسئلة بالضبط

ولا يجوز أن يكون أقل أو أكثر.

يجب أن تكون جميع الأسئلة مختلفة.

أعد JSON فقط حسب المخطط المطلوب.
`;
}


// =========================================================
// Schema
// =========================================================

function schema() {

  const questionSchema = {

    type: "object",

    properties: {

      type: {
        type: "string"
      },

      question: {
        type: "string"
      },

      answers: {

        type: "array",

        minItems: 4,
        maxItems: 4,

        items: {
          type: "string"
        }
      },

      correct_answer: {
        type: "string"
      }
    },

    required: [
      "type",
      "question",
      "answers",
      "correct_answer"
    ],

    additionalProperties: false
  };


  return {

    type: "object",

    properties: {

      easy: {

        type: "array",

        minItems: 10,
        maxItems: 10,

        items: questionSchema
      },

      medium: {

        type: "array",

        minItems: 10,
        maxItems: 10,

        items: questionSchema
      }
    },

    required: [
      "easy",
      "medium"
    ],

    additionalProperties: false
  };
}


// =========================================================
// التحقق من سؤال واحد
// =========================================================

function validateQuestion(
  q,
  index,
  levelName
) {

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
// التحقق من مجموعة أسئلة
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
// التحقق من النتيجة كاملة
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
// تأخير
// =========================================================

function sleep(ms) {

  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );
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
        role: "user",

        parts: [
          {
            text: prompt
          }
        ]
      }
    ],


    generationConfig: {

      responseFormat: {

        text: {

          mimeType:
            "application/json",

          schema:
            schema()
        }
      },


      maxOutputTokens:
        16000
    }
  };


  // ======================================================
  // محاولتان إضافيتان في حالة 429
  // ======================================================

  const MAX_ATTEMPTS = 3;


  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {

    let response;


    try {

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

    } catch (networkError) {

      throw new Error(
        `تعذر الاتصال بـ Gemini: ${networkError?.message || networkError}`
      );
    }


    const text =
      await response.text();


    // ====================================================
    // 429
    // ====================================================

    if (
      response.status === 429
    ) {

      if (
        attempt < MAX_ATTEMPTS
      ) {

        await sleep(
          attempt * 2000
        );

        continue;
      }


      let message =
        "تم تجاوز حد طلبات Gemini.";


      try {

        const data =
          JSON.parse(text);


        if (
          data?.error?.message
        ) {

          message =
            data.error.message;
        }

      } catch (_) {}


      throw new Error(
        `Gemini 429: ${message}`
      );
    }


    // ====================================================
    // أخطاء HTTP
    // ====================================================

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

      } catch (_) {}


      if (
        response.status === 400
      ) {

        throw new Error(
          `Gemini 400: ${errorMessage}`
        );
      }


      if (
        response.status === 401 ||
        response.status === 403
      ) {

        throw new Error(
          `Gemini ${response.status}: مفتاح Gemini غير صالح أو ليس لديه صلاحية استخدام API. ${errorMessage}`
        );
      }


      throw new Error(
        errorMessage
      );
    }


    // ====================================================
    // قراءة استجابة Gemini
    // ====================================================

    let result;


    try {

      result =
        JSON.parse(text);

    } catch (_) {

      throw new Error(
        "Gemini أعاد استجابة غير صالحة."
      );
    }


    // ====================================================
    // فحص candidates
    // ====================================================

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


    // ====================================================
    // فحص سبب انتهاء التوليد
    // ====================================================

    const finishReason =
      candidate?.finishReason;


    if (
      finishReason &&
      finishReason !== "STOP"
    ) {

      throw new Error(
        `Gemini أنهى التوليد بسبب: ${finishReason}`
      );
    }


    // ====================================================
    // استخراج النص
    // ====================================================

    const parts =
      candidate?.content?.parts || [];


    const output =
      parts
        .map(
          part =>
            part?.text || ""
        )
        .join("");


    if (!output) {

      throw new Error(
        "Gemini لم يُرجع محتوى."
      );
    }


    // ====================================================
    // تحويل JSON
    // ====================================================

    try {

      return JSON.parse(output);

    } catch (_) {

      throw new Error(
        "Gemini أعاد JSON غير صالح."
      );
    }
  }


  throw new Error(
    "فشل الاتصال بـ Gemini."
  );
}


// =========================================================
// Worker
// =========================================================

export default {

  async fetch(
    request,
    env
  ) {

    // ====================================================
    // OPTIONS / CORS
    // ====================================================

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
          ok: false,

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
          ok: false,

          error:
            "GEMINI_API_KEY غير موجود في Cloudflare Secrets."
        },
        500
      );
    }


    try {

      // ==================================================
      // قراءة الطلب القادم من الموقع
      // ==================================================

      try {

        await request.json();

      } catch (_) {

        // لا نحتاج بيانات من الموقع
      }


      // ==================================================
      // إنشاء الأسئلة
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
      // خلط ترتيب الأسئلة والإجابات
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


      // ==================================================
      // مهم جدًا:
      // نرسل الخطأ الحقيقي للموقع
      // ==================================================

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
