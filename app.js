// =========================================================
// مسابقة الذكاء - نسخة الويب
// =========================================================
//
// نسخة GitHub Pages
// =========================================================

const API_BASE_URL = "https://tight-sky-05ac.kaka10906.workers.dev";

const QUESTIONS_PER_LEVEL = 10;
const POINTS_PER_QUESTION = 10;

const LEVELS = [
  { name: "سهل", emoji: "🟢", difficulty: "سهل" },
  { name: "متوسط", emoji: "🟡", difficulty: "متوسط" },
];

let questions = [];
let usedQuestions = [];
let currentLevel = 0;
let currentQuestionIndex = 0;
let totalScore = 0;
let levelScore = 0;
let gameLoading = false;
let gameFinished = false;

let answerButtons = [...document.querySelectorAll(".answer")];

const levelLabel = document.getElementById("levelLabel");
const progressLabel = document.getElementById("progressLabel");
const questionLabel = document.getElementById("questionLabel");
const resultLabel = document.getElementById("resultLabel");
const scoreLabel = document.getElementById("scoreLabel");
const startBtn = document.getElementById("startBtn");
const closeBtn = document.getElementById("closeBtn");


// =========================================================
// إخفاء الإجابات فور فتح الصفحة
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


function setAnswersVisible(visible) {
  for (const button of answerButtons) {
    button.classList.toggle("hidden", !visible);
  }
}


function setAnswersEnabled(enabled) {
  for (const button of answerButtons) {
    button.disabled = !enabled;
  }
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function showRetryMessage(seconds) {
  if (!gameLoading) return;

  progressLabel.textContent =
    `الخدمة مشغولة، إعادة المحاولة بعد ${seconds} ثوانٍ...`;

  questionLabel.textContent =
    "⏳ جارٍ تجهيز الأسئلة...\n\nنحاول الاتصال مرة أخرى تلقائيًا";
}


// =========================================================
// الاتصال بالخادم
// =========================================================

async function fetchQuestions(level) {

  if (!API_BASE_URL) {
    throw new Error(
      "لم يتم إعداد رابط خادم Gemini بعد.\n\n" +
      "ضع رابط الخادم في API_BASE_URL داخل app.js."
    );
  }

  const response = await fetch(
    `${API_BASE_URL.replace(/\/$/, "")}/api/questions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        level: LEVELS[level],
        previousQuestions: usedQuestions.map(q => q.question)
      })
    }
  );

  const text = await response.text();

  let data = {};

  try {
    data = JSON.parse(text);
  } catch (_) {}

  if (!response.ok) {
    const message = data.error || `HTTP ${response.status}`;

    const err = new Error(message);
    err.status = response.status;

    throw err;
  }

  if (!Array.isArray(data.questions)) {
    throw new Error(
      "الخادم لم يُرجع قائمة أسئلة صحيحة."
    );
  }

  return data.questions;
}


// =========================================================
// التحقق من الأسئلة
// =========================================================

function validateQuestions(data) {

  if (
    !Array.isArray(data) ||
    data.length !== QUESTIONS_PER_LEVEL
  ) {
    return [
      false,
      "يجب أن يصل 10 أسئلة بالضبط."
    ];
  }

  const seen = new Set();

  for (let i = 0; i < data.length; i++) {

    const item = data[i];

    if (
      !item ||
      typeof item.question !== "string"
    ) {
      return [
        false,
        `السؤال ${i + 1} غير صالح.`
      ];
    }

    if (
      !Array.isArray(item.answers) ||
      item.answers.length !== 4
    ) {
      return [
        false,
        `السؤال ${i + 1} يجب أن يحتوي على 4 إجابات.`
      ];
    }

    const answers = item.answers.map(String);

    const unique = new Set(
      answers.map(normalizeText)
    );

    if (unique.size !== 4) {
      return [
        false,
        `السؤال ${i + 1} يحتوي إجابات مكررة.`
      ];
    }

    if (
      typeof item.correct_answer !== "string"
    ) {
      return [
        false,
        `السؤال ${i + 1} لا يحتوي إجابة صحيحة.`
      ];
    }

    if (
      !answers.some(
        a =>
          normalizeText(a) ===
          normalizeText(item.correct_answer)
      )
    ) {
      return [
        false,
        `الإجابة الصحيحة للسؤال ${i + 1} غير موجودة ضمن الإجابات.`
      ];
    }

    const key = normalizeText(item.question);

    if (seen.has(key)) {
      return [
        false,
        "يوجد سؤال مكرر داخل المجموعة الجديدة."
      ];
    }

    seen.add(key);
  }

  return [true, ""];
}


// =========================================================
// تحميل أسئلة المستوى
// =========================================================

async function loadLevelQuestions(level) {

  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {

    try {

      const data = await fetchQuestions(level);

      const [valid, error] =
        validateQuestions(data);

      if (!valid) {
        lastError = error;
        continue;
      }

      data.sort(
        () => Math.random() - 0.5
      );

      for (const item of data) {
        item.answers.sort(
          () => Math.random() - 0.5
        );
      }

      return [true, data];

    } catch (error) {

      lastError =
        error.message || String(error);

      if (attempt === 0) {
        await sleep(1000);
      }
    }
  }

  return [false, lastError];
}


// =========================================================
// بدء اللعبة
// =========================================================

async function startGame() {

  currentLevel = 0;
  currentQuestionIndex = 0;
  totalScore = 0;
  levelScore = 0;

  questions = [];
  usedQuestions = [];

  gameFinished = false;
  gameLoading = true;

  startBtn.disabled = true;
  startBtn.classList.add("hidden");

  scoreLabel.textContent = "النقاط: 0";

  levelLabel.textContent =
    "🟢 المستوى السهل";

  progressLabel.textContent =
    "جاري تحميل 10 أسئلة...";

  questionLabel.textContent =
    "⏳ جاري إنشاء أسئلة المستوى السهل...";

  resultLabel.textContent = "";
  resultLabel.className = "result";

  setAnswersVisible(false);

  const [success, data] =
    await loadLevelQuestions(currentLevel);

  gameLoading = false;

  if (!success) {

    questionLabel.textContent =
      "❌ لم يتم تحميل الأسئلة";

    resultLabel.textContent = data;
    resultLabel.className = "result error";

    startBtn.textContent =
      "🔄 المحاولة مرة أخرى";

    startBtn.classList.remove("hidden");
    startBtn.disabled = false;

    return;
  }

  usedQuestions.push(...data);
  questions = data;

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
    questions[currentQuestionIndex];

  const level =
    LEVELS[currentLevel];

  levelLabel.textContent =
    `${level.emoji} المستوى ${level.name}`;

  progressLabel.textContent =
    `السؤال ${currentQuestionIndex + 1} من ${QUESTIONS_PER_LEVEL}`;

  questionLabel.textContent =
    item.question;

  resultLabel.textContent = "";
  resultLabel.className = "result";

  for (let i = 0; i < 4; i++) {

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
    button.disabled
  ) {
    return;
  }

  setAnswersEnabled(false);

  const item =
    questions[currentQuestionIndex];

  const correct =
    item.correct_answer;

  if (
    normalizeText(button.textContent) ===
    normalizeText(correct)
  ) {

    totalScore += POINTS_PER_QUESTION;
    levelScore += POINTS_PER_QUESTION;

    button.style.background =
      "#4CAF50";

    button.style.color =
      "#fff";

    resultLabel.textContent =
      "✅ إجابة صحيحة!";

  } else {

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

  setTimeout(() => {

    for (const b of answerButtons) {
      b.style.background = "";
      b.style.color = "";
    }

    showQuestion();

  }, 1500);
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
      LEVELS[currentLevel];

    const next =
      LEVELS[currentLevel + 1];

    levelLabel.textContent =
      `🎉 انتهى المستوى ${completed.name}`;

    progressLabel.textContent =
      `نتيجة المستوى: ${levelScore} / 100`;

    questionLabel.textContent =
      `ممتاز!\n\n${next.emoji} المستوى ${next.name}\n\nاستعد لـ 10 أسئلة جديدة`;

    resultLabel.textContent =
      `مجموع نقاطك حتى الآن: ${totalScore}`;

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
// بدء المستوى التالي
// =========================================================

async function startNextLevel() {

  currentLevel++;
  currentQuestionIndex = 0;
  levelScore = 0;
  gameLoading = true;

  const level =
    LEVELS[currentLevel];

  levelLabel.textContent =
    `${level.emoji} المستوى ${level.name}`;

  progressLabel.textContent =
    "جاري تحميل 10 أسئلة...";

  questionLabel.textContent =
    `⏳ جاري إنشاء أسئلة المستوى ${level.name}...`;

  resultLabel.textContent = "";

  setAnswersVisible(false);

  const [success, data] =
    await loadLevelQuestions(currentLevel);

  gameLoading = false;

  if (!success) {

    questionLabel.textContent =
      "❌ لم يتم تحميل المستوى";

    resultLabel.textContent =
      data;

    resultLabel.className =
      "result error";

    startBtn.textContent =
      "🔄 إعادة المحاولة";

    startBtn.classList.remove("hidden");
    startBtn.disabled = false;

    return;
  }

  usedQuestions.push(...data);
  questions = data;

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

  scoreLabel.textContent =
    `المجموع: ${totalScore}`;

  setAnswersVisible(false);

  startBtn.textContent =
    "🔄 مسابقة جديدة";

  startBtn.classList.remove("hidden");
  startBtn.disabled = false;
}


// =========================================================
// أزرار الإجابات
// =========================================================

for (const button of answerButtons) {

  button.addEventListener(
    "click",
    () => answerPressed(button)
  );
}


// =========================================================
// زر بدء اللعبة
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

    resultLabel.textContent = "";

    resultLabel.className =
      "result";

    scoreLabel.textContent =
      "النقاط: 0";

    setAnswersVisible(false);

    startBtn.textContent =
      "🧠 ابدأ المسابقة";

    startBtn.classList.remove("hidden");
    startBtn.disabled = false;
  }
);
