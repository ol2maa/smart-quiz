// =========================================================
// مسابقة الذكاء - نسخة الويب
// =========================================================
//
// نسخة GitHub Pages
//
// Worker يرجع:
// 10 أسئلة سهل
// 10 أسئلة متوسط
//
// Gemini يتم استدعاؤه فقط عند عدم وجود الأسئلة في KV.
// بعد تحميل الأسئلة:
// أي "مسابقة جديدة" تستخدم الأسئلة الموجودة مسبقًا
// بدون طلب جديد إلى Gemini أو Worker.
//
// =========================================================


const API_BASE_URL =
  "https://brain-quiz.kaka10906.workers.dev";


const QUESTIONS_PER_LEVEL = 10;
const POINTS_PER_QUESTION = 10;


const LEVELS = [
  {
    name: "سهل",
    emoji: "🟢",
    difficulty: "سهل"
  },

  {
    name: "متوسط",
    emoji: "🟡",
    difficulty: "متوسط"
  }
];


// =========================================================
// حالة اللعبة
// =========================================================

let questions = [];

let allLevelQuestions = {
  easy: [],
  medium: []
};

let usedQuestions = [];

let currentLevel = 0;
let currentQuestionIndex = 0;

let totalScore = 0;
let levelScore = 0;

let gameLoading = false;
let gameFinished = false;


// =========================================================
// مهم جدًا
// هل تم تحميل الأسئلة بنجاح من قبل؟
// =========================================================
//
// إذا كانت true:
// "مسابقة جديدة" لا تتصل بالـWorker إطلاقًا.
//
// =========================================================

let questionsLoaded = false;


// =========================================================
// عناصر الصفحة
// =========================================================

let answerButtons =
  [...document.querySelectorAll(".answer")];

const levelLabel =
  document.getElementById("levelLabel");

const progressLabel =
  document.getElementById("progressLabel");

const questionLabel =
  document.getElementById("questionLabel");

const resultLabel =
  document.getElementById("resultLabel");

const scoreLabel =
  document.getElementById("scoreLabel");

const startBtn =
  document.getElementById("startBtn");

const closeBtn =
  document.getElementById("closeBtn");


// =========================================================
// إخفاء الإجابات عند فتح الصفحة
// =========================================================

setAnswersVisible(false);


// =========================================================
// أدوات مساعدة
// =========================================================

function normalizeText(text) {

  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}


// =========================================================
// إظهار / إخفاء الإجابات
// =========================================================

function setAnswersVisible(visible) {

  for (
    const button
    of answerButtons
  ) {

    button.classList.toggle(
      "hidden",
      !visible
    );
  }
}


// =========================================================
// تفعيل / تعطيل الإجابات
// =========================================================

function setAnswersEnabled(enabled) {

  for (
    const button
    of answerButtons
  ) {

    button.disabled = !enabled;
  }
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
// الاتصال بالـWorker
// =========================================================
//
// هذه الدالة يتم استدعاؤها فقط عندما لا تكون الأسئلة
// موجودة في الذاكرة.
//
// =========================================================

async function fetchAllQuestions() {

  if (!API_BASE_URL) {

    throw new Error(
      "لم يتم إعداد رابط خادم Gemini."
    );
  }


  const endpoint =
    `${API_BASE_URL.replace(/\/$/, "")}/api/questions`;


  let response;


  try {

    response =
      await fetch(
        endpoint,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({})
        }
      );

  } catch (error) {

    throw new Error(
      "تعذر الاتصال بالخادم.\n\n" +
      "تأكد من اتصال الإنترنت ورابط Cloudflare Worker."
    );
  }


  const text =
    await response.text();


  let data = {};


  try {

    data =
      JSON.parse(text);

  } catch (_) {

    throw new Error(
      `الخادم أعاد استجابة غير مفهومة.\n\nHTTP ${response.status}`
    );
  }


  // ======================================================
  // خطأ من Worker
  // ======================================================

  if (!response.ok) {

    const message =
      data?.error ||
      `HTTP ${response.status}`;


    const error =
      new Error(message);


    error.status =
      response.status;


    throw error;
  }


  // ======================================================
  // Worker نفسه يقول إن الطلب فشل
  // ======================================================

  if (
    data?.ok === false
  ) {

    throw new Error(
      data?.error ||
      "الخادم رفض الطلب."
    );
  }


  // ======================================================
  // التحقق من easy
  // ======================================================

  if (
    !Array.isArray(data.easy)
  ) {

    throw new Error(
      "الخادم لم يُرجع أسئلة المستوى السهل."
    );
  }


  // ======================================================
  // التحقق من medium
  // ======================================================

  if (
    !Array.isArray(data.medium)
  ) {

    throw new Error(
      "الخادم لم يُرجع أسئلة المستوى المتوسط."
    );
  }


  return {
    easy: data.easy,
    medium: data.medium
  };
}


// =========================================================
// التحقق من أسئلة مستوى واحد
// =========================================================

function validateQuestions(
  data,
  levelName
) {

  if (
    !Array.isArray(data) ||
    data.length !== QUESTIONS_PER_LEVEL
  ) {

    return [
      false,

      `يجب أن يصل 10 أسئلة بالضبط للمستوى ${levelName}.`
    ];
  }


  const seen =
    new Set();


  for (
    let i = 0;
    i < data.length;
    i++
  ) {

    const item =
      data[i];


    // ====================================================
    // السؤال
    // ====================================================

    if (
      !item ||
      typeof item.question !== "string" ||
      !item.question.trim()
    ) {

      return [
        false,

        `السؤال ${levelName} رقم ${i + 1} غير صالح.`
      ];
    }


    // ====================================================
    // الإجابات
    // ====================================================

    if (
      !Array.isArray(item.answers) ||
      item.answers.length !== 4
    ) {

      return [
        false,

        `السؤال ${levelName} رقم ${i + 1} يجب أن يحتوي على 4 إجابات.`
      ];
    }


    const answers =
      item.answers.map(String);


    // ====================================================
    // الإجابات المكررة
    // ====================================================

    const unique =
      new Set(
        answers.map(normalizeText)
      );


    if (
      unique.size !== 4
    ) {

      return [
        false,

        `السؤال ${levelName} رقم ${i + 1} يحتوي إجابات مكررة.`
      ];
    }


    // ====================================================
    // الإجابة الصحيحة
    // ====================================================

    if (
      typeof item.correct_answer !== "string"
    ) {

      return [
        false,

        `السؤال ${levelName} رقم ${i + 1} لا يحتوي إجابة صحيحة.`
      ];
    }


    const correctExists =
      answers.some(
        answer =>
          normalizeText(answer) ===
          normalizeText(
            item.correct_answer
          )
      );


    if (!correctExists) {

      return [
        false,

        `الإجابة الصحيحة للسؤال ${levelName} رقم ${i + 1} غير موجودة ضمن الإجابات.`
      ];
    }


    // ====================================================
    // منع تكرار السؤال
    // ====================================================

    const key =
      normalizeText(
        item.question
      );


    if (
      seen.has(key)
    ) {

      return [
        false,

        `يوجد سؤال مكرر داخل المستوى ${levelName}.`
      ];
    }


    seen.add(key);
  }


  return [
    true,
    ""
  ];
}


// =========================================================
// التحقق من المستويين معًا
// =========================================================

function validateAllQuestions(data) {

  if (!data) {

    return [
      false,
      "لم تصل بيانات الأسئلة."
    ];
  }


  // ======================================================
  // السهل
  // ======================================================

  const easyResult =
    validateQuestions(
      data.easy,
      "السهل"
    );


  if (!easyResult[0]) {

    return easyResult;
  }


  // ======================================================
  // المتوسط
  // ======================================================

  const mediumResult =
    validateQuestions(
      data.medium,
      "المتوسط"
    );


  if (!mediumResult[0]) {

    return mediumResult;
  }


  // ======================================================
  // منع تكرار سؤال بين المستويين
  // ======================================================

  const allSeen =
    new Set();


  const allQuestions = [
    ...data.easy,
    ...data.medium
  ];


  for (
    const item
    of allQuestions
  ) {

    const key =
      normalizeText(
        item.question
      );


    if (
      allSeen.has(key)
    ) {

      return [
        false,

        "يوجد سؤال مكرر بين المستوى السهل والمتوسط."
      ];
    }


    allSeen.add(key);
  }


  return [
    true,
    ""
  ];
}


// =========================================================
// خلط الأسئلة والإجابات
// =========================================================
//
// نستخدم نسخة جديدة من المصفوفات حتى لا نفسد البنك الأصلي.
//
// =========================================================

function shuffleQuestions(data) {

  const easy =
    data.easy.map(
      item => ({
        ...item,
        answers: [...item.answers]
      })
    );


  const medium =
    data.medium.map(
      item => ({
        ...item,
        answers: [...item.answers]
      })
    );


  // ======================================================
  // خلط الأسئلة
  // ======================================================

  easy.sort(
    () =>
      Math.random() - 0.5
  );


  medium.sort(
    () =>
      Math.random() - 0.5
  );


  // ======================================================
  // خلط الإجابات
  // ======================================================

  for (
    const item
    of easy
  ) {

    item.answers.sort(
      () =>
        Math.random() - 0.5
    );
  }


  for (
    const item
    of medium
  ) {

    item.answers.sort(
      () =>
        Math.random() - 0.5
    );
  }


  return {
    easy,
    medium
  };
}


// =========================================================
// تحميل الأسئلة من Worker
// =========================================================
//
// مهم جدًا:
//
// هذه الدالة هي المكان الوحيد الذي نطلب فيه الأسئلة
// من Worker.
//
// "مسابقة جديدة" بعد ذلك لا تستخدم هذه الدالة.
//
// =========================================================

async function loadAllLevelQuestions() {

  let lastError =
    "حدث خطأ غير معروف.";


  // محاولتان فقط
  for (
    let attempt = 0;
    attempt < 2;
    attempt++
  ) {

    try {

      const data =
        await fetchAllQuestions();


      const [
        valid,
        error
      ] =
        validateAllQuestions(
          data
        );


      if (!valid) {

        lastError =
          error;

        continue;
      }


      return [
        true,
        data
      ];

    } catch (error) {

      lastError =
        error?.message ||
        String(error);


      // إعادة محاولة واحدة
      if (
        attempt === 0
      ) {

        await sleep(1500);
      }
    }
  }


  return [
    false,
    lastError
  ];
}


// =========================================================
// تجهيز لعبة جديدة من الأسئلة الموجودة
// =========================================================
//
// مهم جدًا:
//
// لا يوجد fetch هنا.
// لا يوجد Worker هنا.
// لا يوجد Gemini هنا.
//
// =========================================================

function prepareNewGameFromLoadedQuestions() {

  // ======================================================
  // التأكد من وجود الأسئلة
  // ======================================================

  if (
    !questionsLoaded ||
    !Array.isArray(allLevelQuestions.easy) ||
    !Array.isArray(allLevelQuestions.medium) ||
    allLevelQuestions.easy.length !== QUESTIONS_PER_LEVEL ||
    allLevelQuestions.medium.length !== QUESTIONS_PER_LEVEL
  ) {

    return false;
  }


  // ======================================================
  // خلط البنك الموجود
  // ======================================================

  const shuffled =
    shuffleQuestions(
      allLevelQuestions
    );


  // ======================================================
  // بداية اللعبة
  // ======================================================

  currentLevel = 0;

  currentQuestionIndex = 0;

  totalScore = 0;

  levelScore = 0;

  gameFinished = false;

  gameLoading = false;


  questions =
    shuffled.easy;


  usedQuestions =
    [...questions];


  return true;
}


// =========================================================
// بدء اللعبة
// =========================================================
//
// إذا كانت الأسئلة موجودة:
// نستخدمها مباشرة.
//
// إذا لم تكن موجودة:
// نطلبها من Worker.
//
// =========================================================

async function startGame() {

  // ======================================================
  // إذا كانت الأسئلة موجودة بالفعل
  // ======================================================

  if (
    questionsLoaded
  ) {

    const prepared =
      prepareNewGameFromLoadedQuestions();


    if (
      prepared
    ) {

      startBtn.disabled = true;

      startBtn.classList.add(
        "hidden"
      );


      scoreLabel.textContent =
        "النقاط: 0";


      levelLabel.textContent =
        "🟢 المستوى السهل";


      progressLabel.textContent =
        "السؤال 1 من 10";


      resultLabel.textContent =
        "";


      resultLabel.className =
        "result";


      setAnswersVisible(false);


      await sleep(250);


      showQuestion();

      return;
    }
  }


  // ======================================================
  // لا توجد أسئلة
  // إذن نحتاج Worker
  // ======================================================

  currentLevel = 0;

  currentQuestionIndex = 0;

  totalScore = 0;

  levelScore = 0;


  questions = [];

  usedQuestions = [];


  allLevelQuestions = {
    easy: [],
    medium: []
  };


  gameFinished = false;

  gameLoading = true;


  startBtn.disabled = true;

  startBtn.classList.add(
    "hidden"
  );


  scoreLabel.textContent =
    "النقاط: 0";


  levelLabel.textContent =
    "🟢 المستوى السهل";


  progressLabel.textContent =
    "جاري تحميل 20 سؤالًا...";


  questionLabel.textContent =
    "⏳ جاري تحميل الأسئلة...";


  resultLabel.textContent =
    "";


  resultLabel.className =
    "result";


  setAnswersVisible(false);


  // ======================================================
  // تحميل المستويين
  // ======================================================

  const [
    success,
    data
  ] =
    await loadAllLevelQuestions();


  gameLoading = false;


  // ======================================================
  // فشل
  // ======================================================

  if (!success) {

    questionLabel.textContent =
      "❌ لم يتم تحميل الأسئلة";


    resultLabel.textContent =
      data;


    resultLabel.className =
      "result error";


    startBtn.textContent =
      "🔄 المحاولة مرة أخرى";


    startBtn.classList.remove(
      "hidden"
    );


    startBtn.disabled = false;


    return;
  }


  // ======================================================
  // حفظ الأسئلة في الذاكرة
  // ======================================================

  allLevelQuestions =
    data;


  questionsLoaded = true;


  // ======================================================
  // تجهيز أول لعبة
  // ======================================================

  const prepared =
    prepareNewGameFromLoadedQuestions();


  if (
    !prepared
  ) {

    questionsLoaded = false;


    questionLabel.textContent =
      "❌ حدث خطأ في تجهيز الأسئلة";


    resultLabel.textContent =
      "تعذر تجهيز الأسئلة للعبة.";


    resultLabel.className =
      "result error";


    startBtn.textContent =
      "🔄 المحاولة مرة أخرى";


    startBtn.classList.remove(
      "hidden"
    );


    startBtn.disabled = false;


    return;
  }


  showQuestion();
}


// =========================================================
// عرض السؤال
// =========================================================

function showQuestion() {

  if (
    currentQuestionIndex >=
    questions.length
  ) {

    finishLevel();

    return;
  }


  const item =
    questions[
      currentQuestionIndex
    ];


  const level =
    LEVELS[
      currentLevel
    ];


  levelLabel.textContent =
    `${level.emoji} المستوى ${level.name}`;


  progressLabel.textContent =
    `السؤال ${currentQuestionIndex + 1} من ${QUESTIONS_PER_LEVEL}`;


  questionLabel.textContent =
    item.question;


  resultLabel.textContent =
    "";

  resultLabel.className =
    "result";


  for (
    let i = 0;
    i < 4;
    i++
  ) {

    answerButtons[i].textContent =
      item.answers[i];
  }


  setAnswersVisible(true);

  setAnswersEnabled(true);
}


// =========================================================
// اختيار الإجابة
// =========================================================

function answerPressed(button) {

  if (
    gameLoading ||
    button.disabled ||
    gameFinished
  ) {

    return;
  }


  setAnswersEnabled(false);


  const item =
    questions[
      currentQuestionIndex
    ];


  const correct =
    item.correct_answer;


  // ======================================================
  // إجابة صحيحة
  // ======================================================

  if (
    normalizeText(
      button.textContent
    ) ===
    normalizeText(
      correct
    )
  ) {

    totalScore +=
      POINTS_PER_QUESTION;


    levelScore +=
      POINTS_PER_QUESTION;


    button.style.background =
      "#4CAF50";


    button.style.color =
      "#fff";


    resultLabel.textContent =
      "✅ إجابة صحيحة!";
  }


  // ======================================================
  // إجابة خاطئة
  // ======================================================

  else {

    button.style.background =
      "#F44336";


    button.style.color =
      "#fff";


    resultLabel.textContent =
      `❌ إجابة خاطئة\nالإجابة الصحيحة: ${correct}`;
  }


  scoreLabel.textContent =
    `النقاط: ${totalScore}`;


  currentQuestionIndex++;


  setTimeout(
    () => {

      for (
        const b
        of answerButtons
      ) {

        b.style.background =
          "";

        b.style.color =
          "";
      }


      showQuestion();

    },
    1500
  );
}


// =========================================================
// انتهاء المستوى
// =========================================================

function finishLevel() {

  if (
    currentLevel + 1 <
    LEVELS.length
  ) {

    const completed =
      LEVELS[
        currentLevel
      ];


    const next =
      LEVELS[
        currentLevel + 1
      ];


    levelLabel.textContent =
      `🎉 انتهى المستوى ${completed.name}`;


    progressLabel.textContent =
      `نتيجة المستوى: ${levelScore} / 100`;


    questionLabel.textContent =
      `ممتاز!\n\n${next.emoji} المستوى ${next.name}\n\nاستعد لـ 10 أسئلة جديدة`;


    resultLabel.textContent =
      `مجموع نقاطك حتى الآن: ${totalScore}`;


    resultLabel.className =
      "result";


    setAnswersVisible(false);


    setTimeout(
      startNextLevel,
      2500
    );

  } else {

    finishGame();
  }
}


// =========================================================
// بدء المستوى المتوسط
// =========================================================
//
// لا يوجد اتصال بالخادم.
// الأسئلة موجودة في الذاكرة.
// =========================================================

async function startNextLevel() {

  currentLevel++;

  currentQuestionIndex = 0;

  levelScore = 0;


  // ======================================================
  // التأكد من وجود الأسئلة المتوسطة
  // ======================================================

  if (
    !Array.isArray(
      allLevelQuestions.medium
    ) ||
    allLevelQuestions.medium.length !==
      QUESTIONS_PER_LEVEL
  ) {

    gameLoading = false;


    questionLabel.textContent =
      "❌ لم يتم العثور على أسئلة المستوى المتوسط.";


    resultLabel.textContent =
      "الأسئلة المتوسطة لم تصل من الخادم.";


    resultLabel.className =
      "result error";


    startBtn.textContent =
      "🔄 إعادة المحاولة";


    startBtn.classList.remove(
      "hidden"
    );


    startBtn.disabled = false;


    return;
  }


  // ======================================================
  // استخدام نسخة مخلوطة من الأسئلة المتوسطة
  // ======================================================

  const shuffled =
    shuffleQuestions({
      easy: allLevelQuestions.easy,
      medium: allLevelQuestions.medium
    });


  questions =
    shuffled.medium;


  usedQuestions.push(
    ...questions
  );


  const level =
    LEVELS[
      currentLevel
    ];


  levelLabel.textContent =
    `${level.emoji} المستوى ${level.name}`;


  progressLabel.textContent =
    "السؤال 1 من 10";


  questionLabel.textContent =
    "استعد...";


  resultLabel.textContent =
    "";


  resultLabel.className =
    "result";


  setAnswersVisible(false);


  // ======================================================
  // مهلة قصيرة للانتقال
  // ======================================================

  await sleep(500);


  showQuestion();
}


// =========================================================
// انتهاء المسابقة
// =========================================================

function finishGame() {

  gameFinished = true;


  levelLabel.textContent =
    "🏆 انتهت المسابقة";


  progressLabel.textContent =
    `أكملت ${LEVELS.length * QUESTIONS_PER_LEVEL} سؤالًا`;


  questionLabel.textContent =
    "نتيجتك النهائية";


  resultLabel.textContent =
    `🎯 ${totalScore} من ${LEVELS.length * QUESTIONS_PER_LEVEL * POINTS_PER_QUESTION} نقطة`;


  resultLabel.className =
    "result";


  scoreLabel.textContent =
    `المجموع: ${totalScore}`;


  setAnswersVisible(false);


  // ======================================================
  // مهم جدًا:
  // هذا الزر أصبح "مسابقة جديدة"
  // وليس "تحميل أسئلة جديدة".
  // ======================================================

  startBtn.textContent =
    "🔄 مسابقة جديدة";


  startBtn.classList.remove(
    "hidden"
  );


  startBtn.disabled = false;
}


// =========================================================
// أزرار الإجابات
// =========================================================

for (
  const button
  of answerButtons
) {

  button.addEventListener(
    "click",
    () => answerPressed(button)
  );
}


// =========================================================
// زر بدء / مسابقة جديدة / إعادة المحاولة
// =========================================================

startBtn.addEventListener(
  "click",
  startGame
);


// =========================================================
// زر X
// =========================================================

closeBtn.addEventListener(
  "click",
  () => {

    questions = [];

    usedQuestions = [];


    allLevelQuestions = {
      easy: [],
      medium: []
    };


    // ====================================================
    // مهم:
    // عند إغلاق المسابقة لا نحذف الأسئلة من KV،
    // لكن نمسحها من ذاكرة الصفحة.
    //
    // إذا ضغط المستخدم "ابدأ" بعد ذلك،
    // سيطلبها من Worker.
    //
    // Worker سيقرأها من KV بدون Gemini.
    // ====================================================

    questionsLoaded = false;


    currentLevel = 0;

    currentQuestionIndex = 0;


    totalScore = 0;

    levelScore = 0;


    gameLoading = false;

    gameFinished = false;


    levelLabel.textContent =
      "🟢 المستوى السهل";


    progressLabel.textContent =
      "10 أسئلة";


    questionLabel.textContent =
      "اضغط «ابدأ المسابقة»";


    resultLabel.textContent =
      "";


    resultLabel.className =
      "result";


    scoreLabel.textContent =
      "النقاط: 0";


    setAnswersVisible(false);


    startBtn.textContent =
      "🧠 ابدأ المسابقة";


    startBtn.classList.remove(
      "hidden"
    );


    startBtn.disabled = false;
  }
);
