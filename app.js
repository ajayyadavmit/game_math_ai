import { renderHeader } from "./header.js";
import { renderFooter } from "./footer.js";

const CONFIG_URL = "./quiz-config.json";
const FIREBASE_CONFIG_URL = "./firebase-config.json";
const STORAGE_KEY = "maths-for-ai-best-scores";
const NICKNAME_KEY = "maths-for-ai-nickname";
const CLASS_CODE_KEY = "maths-for-ai-class-code";
const ANSWER_KEYS = ["A", "B", "C", "D"];
const NICKNAME_ADJECTIVES = ["Bright", "Curious", "Keen", "Kind", "Mighty", "Quick", "Sunny", "Wonder"];
const NICKNAME_NOUNS = ["Badger", "Comet", "Falcon", "Fox", "Koala", "Otter", "Panda", "Tiger"];

const elements = {
  setupView: document.querySelector("#setup-view"),
  quizView: document.querySelector("#quiz-view"),
  resultsView: document.querySelector("#results-view"),
  setupError: document.querySelector("#setup-error"),
  startButton: document.querySelector("#start-button"),
  homeLink: null,
  headerRoot: document.querySelector("#site-header"),
  footerRoot: document.querySelector("#site-footer"),
  topicGrid: document.querySelector("#topic-grid"),
  topicButtons: [],
  sessionLength: document.querySelector("#session-length"),
  cloudStatus: document.querySelector("#cloud-status"),
  topicChip: document.querySelector("#topic-chip"),
  questionCount: document.querySelector("#question-count"),
  scoreValue: document.querySelector("#score-value"),
  streakPill: document.querySelector("#streak-pill"),
  streakValue: document.querySelector("#streak-value"),
  quizEncouragement: document.querySelector("#quiz-encouragement"),
  progressTrack: document.querySelector(".progress-track"),
  progressFill: document.querySelector("#progress-fill"),
  timerTrack: document.querySelector(".timer-track"),
  timerFill: document.querySelector("#timer-fill"),
  timerValue: document.querySelector("#timer-value"),
  questionLabel: document.querySelector("#question-label"),
  questionText: document.querySelector("#question-text"),
  answerGrid: document.querySelector("#answer-grid"),
  feedbackPanel: document.querySelector("#feedback-panel"),
  feedbackMark: document.querySelector("#feedback-mark"),
  feedbackKicker: document.querySelector("#feedback-kicker"),
  feedbackTitle: document.querySelector("#feedback-title"),
  feedbackHint: document.querySelector("#feedback-hint"),
  feedbackSolution: document.querySelector("#feedback-solution"),
  aiConnection: document.querySelector("#ai-connection"),
  sourceLink: document.querySelector("#source-link"),
  continueButton: document.querySelector("#continue-button"),
  finalScore: document.querySelector("#final-score"),
  finalCorrect: document.querySelector("#final-correct"),
  finalAccuracy: document.querySelector("#final-accuracy"),
  finalStreak: document.querySelector("#final-streak"),
  resultsSubtitle: document.querySelector("#results-subtitle"),
  bestScore: document.querySelector("#best-score"),
  cloudResult: document.querySelector("#cloud-result"),
  againButton: document.querySelector("#again-button"),
  topicsButton: document.querySelector("#topics-button"),
  nicknameInput: document.querySelector("#nickname-input"),
  classCodeInput: document.querySelector("#class-code-input"),
  leaderboardStatus: document.querySelector("#leaderboard-status"),
  leaderboardList: document.querySelector("#leaderboard-list"),
};

const state = {
  config: null,
  category: "mixed",
  questions: [],
  questionIndex: 0,
  correctCount: 0,
  score: 0,
  currentStreak: 0,
  bestStreak: 0,
  answered: false,
  deadline: 0,
  timerId: null,
  sessionStartedAt: 0,
  firebase: null,
  leaderboardUnsubscribe: null,
  leaderboardClassCode: "",
  nickname: "",
  classCode: "",
};

function validateConfig(config) {
  if (!config || !Number.isInteger(config.settings?.questionCount) ||
      !Number.isInteger(config.settings?.secondsPerQuestion) ||
      !Number.isInteger(config.settings?.pointsPerCorrect) ||
      config.settings.questionCount < 1 ||
      config.settings.questionCount > 50 ||
      config.settings.secondsPerQuestion < 5 ||
      config.settings.secondsPerQuestion > 3600 ||
      config.settings.pointsPerCorrect < 1 ||
      !config.categories || typeof config.categories !== "object") {
    throw new Error("Quiz settings are missing or invalid. Check quiz-config.json.");
  }

  if (!config.experience || !config.copy || !config.appearance ||
      !config.leaderboard || !config.branding ||
      typeof config.experience.streak?.enabled !== "boolean" ||
      !config.experience.messages || typeof config.experience.messages !== "object") {
    throw new Error("Experience, appearance and copy settings are missing from quiz-config.json.");
  }

  const streak = config.experience.streak;
  if (!Number.isInteger(streak.bonusEvery) || streak.bonusEvery < 1 ||
      !Number.isInteger(streak.bonusPoints) || streak.bonusPoints < 0 ||
      !Number.isInteger(config.experience.streakMinimumForMessage) ||
      config.experience.streakMinimumForMessage < 1) {
    throw new Error("Streak settings in quiz-config.json must use positive whole numbers; bonus points may be zero.");
  }
  const maxScore = config.settings.questionCount * config.settings.pointsPerCorrect +
    (streak.enabled ? Math.floor(config.settings.questionCount / streak.bonusEvery) * streak.bonusPoints : 0);
  if (maxScore > 1000) {
    throw new Error("The maximum session score (including streak bonuses) must be 1000 points or less.");
  }
  if (typeof config.experience.allowMixed !== "boolean" ||
      typeof config.experience.randomizeQuestions !== "boolean" ||
      typeof config.experience.randomizeOptions !== "boolean" ||
      typeof config.experience.mixedTopic?.label !== "string" ||
      typeof config.experience.mixedTopic?.description !== "string" ||
      !config.experience.mixedTopic?.label ||
      !config.experience.mixedTopic?.description ||
      Object.entries(config.copy).some(([key, text]) => typeof text !== "string" || !text.trim())) {
    throw new Error("Check the experience and copy options in quiz-config.json.");
  }
  for (const [key, message] of Object.entries(config.experience.messages)) {
    if (typeof message !== "string" || !message.trim()) {
      throw new Error(`The encouragement message "${key}" in quiz-config.json cannot be empty.`);
    }
  }

  const appearance = config.appearance;
  for (const [name, size] of Object.entries(appearance)) {
    if (!Number.isFinite(size) || size < 8 || size > 32) {
      throw new Error(`Appearance setting "${name}" must be a font size or spacing from 8 to 32 pixels.`);
    }
  }
  for (const requiredSetting of [
    "quizTopicFontSizePx",
    "quizDetailFontSizePx",
    "quizScoreFontSizePx",
    "quizStreakFontSizePx",
    "quizMetaGapPx",
    "quizQuestionFontSizePx",
    "quizAnswerFontSizePx",
  ]) {
    if (!Object.hasOwn(appearance, requiredSetting)) {
      throw new Error(`Add "${requiredSetting}" to the appearance settings in quiz-config.json.`);
    }
  }

  const leaderboard = config.leaderboard;
  if (typeof leaderboard.enabled !== "boolean" ||
      !Number.isInteger(leaderboard.topCount) || leaderboard.topCount < 1 || leaderboard.topCount > 25 ||
      !Number.isInteger(leaderboard.nicknameMinLength) ||
      !Number.isInteger(leaderboard.nicknameMaxLength) ||
      leaderboard.nicknameMinLength < 3 ||
      leaderboard.nicknameMaxLength < leaderboard.nicknameMinLength ||
      leaderboard.nicknameMaxLength > 30 ||
      !Number.isInteger(leaderboard.classCodeMinLength) ||
      !Number.isInteger(leaderboard.classCodeMaxLength) ||
      leaderboard.classCodeMinLength < 4 ||
      leaderboard.classCodeMaxLength < leaderboard.classCodeMinLength ||
      leaderboard.classCodeMaxLength > 16 ||
      typeof leaderboard.defaultClassCode !== "string" ||
      (leaderboard.defaultClassCode &&
        (!/^[A-Z0-9][A-Z0-9-]*$/.test(leaderboard.defaultClassCode) ||
          leaderboard.defaultClassCode.length < leaderboard.classCodeMinLength ||
          leaderboard.defaultClassCode.length > leaderboard.classCodeMaxLength))) {
    throw new Error("Check leaderboard settings in quiz-config.json.");
  }
  if (typeof config.branding.siteName !== "string" ||
      typeof config.branding.brandText !== "string" ||
      typeof config.branding.logoMark !== "string" ||
      typeof config.branding.tagline !== "string" ||
      typeof config.branding.eyebrow !== "string" ||
      typeof config.branding.headlineLine1 !== "string" ||
      typeof config.branding.headlineLine2 !== "string" ||
      typeof config.branding.headlineHighlight !== "string" ||
      typeof config.branding.heroImageUrl !== "string" ||
      typeof config.branding.heroImageAlt !== "string" ||
      typeof config.branding.footerMessage !== "string" ||
      typeof config.branding.footerIcon !== "string" ||
      typeof config.branding.footerTagline !== "string" ||
      typeof config.branding.footerClosing !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(config.branding.theme?.primary) ||
      !/^#[0-9a-f]{6}$/i.test(config.branding.theme?.primaryDark) ||
      !/^#[0-9a-f]{6}$/i.test(config.branding.theme?.page)) {
    throw new Error("Check the branding text and hex color values in quiz-config.json.");
  }
  if (config.branding.heroImageUrl) {
    const imageUrl = new URL(config.branding.heroImageUrl, window.location.href);
    if (imageUrl.protocol !== "https:" && imageUrl.origin !== window.location.origin) {
      throw new Error("The header image must be an HTTPS URL or a file hosted with the app.");
    }
  }
  for (const requiredMessage of [
    "correct",
    "streak",
    "streakBonus",
    "incorrect",
    "timeout",
    "resultPerfect",
    "resultGood",
    "resultKeepGoing",
  ]) {
    if (!config.experience.messages[requiredMessage]) {
      throw new Error(`Add the "${requiredMessage}" encouragement message to quiz-config.json.`);
    }
  }

  const categories = Object.entries(config.categories);
  if (categories.length === 0) {
    throw new Error("Add at least one topic to quiz-config.json.");
  }

  for (const [categoryId, category] of categories) {
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(categoryId) || categoryId === "mixed" ||
        typeof category.label !== "string" || !category.label.trim() ||
        typeof category.questionFile !== "string" ||
        !/^questions\/[a-z][a-z0-9-]*\.json$/.test(category.questionFile)) {
      throw new Error(`Topic "${categoryId}" needs a lowercase ID, label and a questionFile such as "questions/${categoryId}.json".`);
    }
  }
}

function validateQuestionBank(categoryId, questions, questionCount) {
  if (!Array.isArray(questions) || questions.length < questionCount) {
    throw new Error(`Question file for "${categoryId}" must contain at least ${questionCount} questions.`);
  }
  for (const [index, question] of questions.entries()) {
    if (typeof question.prompt !== "string" || !question.prompt.trim() || !Array.isArray(question.options) ||
        question.options.some((option) => typeof option !== "string" || !option.trim()) ||
        question.options.length !== 4 || new Set(question.options).size !== 4 ||
        !question.options.includes(question.answer) ||
        typeof question.hint !== "string" || !question.hint.trim() ||
        typeof question.solution !== "string" || !question.solution.trim() ||
        typeof question.aiConnection !== "string" || !question.aiConnection.trim() ||
        typeof question.sourceTitle !== "string" || !question.sourceTitle.trim() ||
        typeof question.sourceUrl !== "string" || !/^https?:\/\//i.test(question.sourceUrl)) {
      throw new Error(`Question ${index + 1} in "${categoryId}" is incomplete. Include four unique options, an answer, a hint, a solution and an http(s) source.`);
    }
  }
}

async function loadQuestionBanks(config) {
  await Promise.all(Object.entries(config.categories).map(async ([categoryId, category]) => {
    const response = await fetch(category.questionFile);
    if (!response.ok) {
      throw new Error(`Could not load question file "${category.questionFile}" (${response.status}).`);
    }
    const questionBank = await response.json();
    validateQuestionBank(categoryId, questionBank.questions, config.settings.questionCount);
    category.questions = questionBank.questions;
  }));
}

function setCloudStatus(message, stateName = "") {
  elements.cloudStatus.textContent = message;
  elements.cloudStatus.dataset.state = stateName;
}

function getFirebaseErrorMessage(error, stage) {
  const code = typeof error?.code === "string" ? error.code : "unknown";
  if (code === "permission-denied") {
    return `Firebase sign-in succeeded, but Firestore denied the leaderboard request (${code}). Publish firestore.rules to the same Firebase project shown in firebase-config.json, and check that the class code is 4–16 uppercase letters, digits or hyphens.`;
  }
  if (code === "auth/unauthorized-domain") {
    return `Firebase sign-in was blocked (${code}). Add this website's hostname to Authentication → Settings → Authorized domains in the Firebase project.`;
  }
  if (code === "auth/operation-not-allowed") {
    return `Firebase sign-in is disabled (${code}). Enable Authentication → Sign-in method → Anonymous in the Firebase project.`;
  }
  if (code === "auth/invalid-api-key") {
    return `Firebase rejected the web API key (${code}). Check that firebase-config.json contains the Web app config from the same Firebase project.`;
  }
  if (code === "auth/network-request-failed") {
    return `Firebase could not be reached (${code}). Check the internet connection, browser extensions, and network access to Firebase.`;
  }
  return `Firebase ${stage} failed (${code}). Check the browser console for details and verify the Firebase project configuration and deployed Firestore rules.`;
}

async function loadFirebase() {
  if (!state.config.leaderboard.enabled) {
    setCloudStatus("Saving on this device");
    setLeaderboardStatus(state.config.copy.leaderboardDisabled);
    return;
  }

  let firebaseConfig;
  try {
    const response = await fetch(FIREBASE_CONFIG_URL);
    if (!response.ok) {
      throw new Error(`Could not load ${FIREBASE_CONFIG_URL} (${response.status}).`);
    }
    firebaseConfig = await response.json();
  } catch (error) {
    console.error("Firebase configuration could not be loaded.", error);
    setCloudStatus("Cloud setup unavailable · saving on this device", "local");
    setLeaderboardStatus(state.config.copy.localLeaderboard);
    return;
  }

  if (!firebaseConfig.enabled) {
    setCloudStatus("Saving on this device");
    setLeaderboardStatus(state.config.copy.leaderboardDisabled);
    return;
  }

  if (!firebaseConfig.apiKey || !firebaseConfig.authDomain ||
      !firebaseConfig.projectId || !firebaseConfig.appId) {
    setCloudStatus("Add your Firebase settings · saving on this device", "local");
    setLeaderboardStatus(state.config.copy.leaderboardDisabled);
    return;
  }

  try {
    const version = "10.12.2";
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`),
    ]);
    const app = appModule.initializeApp(firebaseConfig);
    const auth = authModule.getAuth(app);
    const credential = await authModule.signInAnonymously(auth);
    state.firebase = {
      db: firestoreModule.getFirestore(app),
      collection: firestoreModule.collection,
      doc: firestoreModule.doc,
      getDoc: firestoreModule.getDoc,
      setDoc: firestoreModule.setDoc,
      query: firestoreModule.query,
      orderBy: firestoreModule.orderBy,
      limit: firestoreModule.limit,
      onSnapshot: firestoreModule.onSnapshot,
      serverTimestamp: firestoreModule.serverTimestamp,
      uid: credential.user.uid,
    };
    setCloudStatus("Firebase connected", "connected");
    subscribeToLeaderboard();
  } catch (error) {
    console.error("Firebase connection failed.", error);
    setCloudStatus("Firebase connection failed · saving on this device", "error");
    setLeaderboardStatus(getFirebaseErrorMessage(error, "connection"), "error");
  }
}

function setLeaderboardStatus(message, stateName = "") {
  elements.leaderboardStatus.textContent = message;
  elements.leaderboardStatus.dataset.state = stateName;
}

function createAnonymousNickname() {
  const adjective = NICKNAME_ADJECTIVES[Math.floor(Math.random() * NICKNAME_ADJECTIVES.length)];
  const noun = NICKNAME_NOUNS[Math.floor(Math.random() * NICKNAME_NOUNS.length)];
  return `${adjective}${noun}${Math.floor(10 + Math.random() * 90)}`;
}

function isValidNickname(nickname) {
  const { nicknameMinLength, nicknameMaxLength } = state.config.leaderboard;
  return nickname.length >= nicknameMinLength &&
    nickname.length <= nicknameMaxLength &&
    /^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(nickname);
}

function isValidClassCode(classCode) {
  const { classCodeMinLength, classCodeMaxLength } = state.config.leaderboard;
  return classCode.length >= classCodeMinLength &&
    classCode.length <= classCodeMaxLength &&
    /^[A-Z0-9][A-Z0-9-]*$/.test(classCode);
}

function persistIdentity() {
  state.nickname = elements.nicknameInput.value.trim();
  state.classCode = elements.classCodeInput.value.trim().toUpperCase();
  elements.classCodeInput.value = state.classCode;
  try {
    localStorage.setItem(NICKNAME_KEY, state.nickname);
    localStorage.setItem(CLASS_CODE_KEY, state.classCode);
  } catch (error) {
    console.error("Could not save your nickname or class code on this device.", error);
  }
  if (state.firebase) subscribeToLeaderboard();
}

function initializeIdentity() {
  let savedNickname = "";
  let savedClassCode = "";
  try {
    savedNickname = localStorage.getItem(NICKNAME_KEY) || "";
    savedClassCode = localStorage.getItem(CLASS_CODE_KEY) || "";
  } catch (error) {
    console.error("Could not read your saved nickname or class code.", error);
  }
  state.nickname = isValidNickname(savedNickname) ? savedNickname : createAnonymousNickname();
  state.classCode = (savedClassCode || state.config.leaderboard.defaultClassCode).trim().toUpperCase();
  elements.nicknameInput.value = state.nickname;
  elements.classCodeInput.value = state.classCode;
  elements.classCodeInput.placeholder = `e.g. ${state.config.leaderboard.defaultClassCode || "MATHS-1"}`;
  elements.nicknameInput.addEventListener("change", persistIdentity);
  elements.classCodeInput.addEventListener("change", persistIdentity);
  elements.classCodeInput.addEventListener("input", () => {
    elements.classCodeInput.value = elements.classCodeInput.value.toUpperCase();
  });
}

function renderLeaderboard(snapshot) {
  elements.leaderboardList.replaceChildren();
  if (snapshot.empty) {
    setLeaderboardStatus(state.config.copy.leaderboardEmpty);
    return;
  }
  snapshot.docs.forEach((entry, index) => {
    const data = entry.data();
    const row = document.createElement("li");
    row.className = "leaderboard-row";
    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = `${index + 1}`;
    const student = document.createElement("span");
    student.className = "leaderboard-name";
    student.textContent = data.nickname;
    const streak = document.createElement("span");
    streak.className = "leaderboard-streak";
    streak.textContent = `🔥 ${data.bestStreak}`;
    streak.setAttribute("aria-label", `Best streak ${data.bestStreak}`);
    const score = document.createElement("strong");
    score.className = "leaderboard-score";
    score.textContent = `${data.score} pts`;
    row.append(rank, student, streak, score);
    elements.leaderboardList.append(row);
  });
  setLeaderboardStatus(
    state.config.copy.leaderboardUpdated.replace("{classCode}", state.classCode),
    "connected",
  );
}

function subscribeToLeaderboard() {
  if (state.leaderboardUnsubscribe) {
    state.leaderboardUnsubscribe();
    state.leaderboardUnsubscribe = null;
  }
  elements.leaderboardList.replaceChildren();
  if (!state.config.leaderboard.enabled) {
    setLeaderboardStatus(state.config.copy.leaderboardDisabled);
    return;
  }
  if (!isValidNickname(state.nickname)) {
    setLeaderboardStatus(formatMessage(state.config.copy.nicknameInvalid, {
      min: state.config.leaderboard.nicknameMinLength,
      max: state.config.leaderboard.nicknameMaxLength,
    }), "error");
    return;
  }
  if (!isValidClassCode(state.classCode)) {
    const message = state.classCode
      ? formatMessage(state.config.copy.classCodeInvalid, {
        min: state.config.leaderboard.classCodeMinLength,
        max: state.config.leaderboard.classCodeMaxLength,
      })
      : state.config.copy.leaderboardNotReady;
    setLeaderboardStatus(message);
    return;
  }
  if (!state.firebase) {
    setLeaderboardStatus(state.config.copy.leaderboardDisabled);
    return;
  }

  setLeaderboardStatus(`Loading the ${state.classCode} class leaderboard…`);
  const entries = state.firebase.collection(
    state.firebase.db,
    "classrooms",
    state.classCode,
    "leaderboard",
  );
  const topScores = state.firebase.query(
    entries,
    state.firebase.orderBy("score", "desc"),
    state.firebase.limit(state.config.leaderboard.topCount),
  );
  state.leaderboardClassCode = state.classCode;
  state.leaderboardUnsubscribe = state.firebase.onSnapshot(
    topScores,
    renderLeaderboard,
    (error) => {
      console.error("Could not load the class leaderboard.", error);
      setCloudStatus("Firebase connected · leaderboard access needs attention", "error");
      setLeaderboardStatus(getFirebaseErrorMessage(error, "leaderboard loading"), "error");
    },
  );
}

async function saveLeaderboardScore(attempt) {
  if (!state.firebase || !isValidNickname(state.nickname) || !isValidClassCode(state.classCode)) {
    throw new Error("Connect Firebase and enter a valid nickname and class code before saving to the leaderboard.");
  }
  const nicknameKey = encodeURIComponent(state.nickname.trim().toLowerCase());
  const entry = state.firebase.doc(
    state.firebase.db,
    "classrooms",
    state.classCode,
    "leaderboard",
    `${state.firebase.uid}_${nicknameKey}`,
  );
  const previous = await state.firebase.getDoc(entry);
  if (previous.exists() && previous.data().score > attempt.score) {
    setLeaderboardStatus(state.config.copy.leaderboardUpdated, "connected");
    return;
  }
  await state.firebase.setDoc(entry, {
    ownerUid: state.firebase.uid,
    nickname: state.nickname,
    category: attempt.category,
    score: attempt.score,
    total: attempt.total,
    correct: attempt.correct,
    bestStreak: attempt.bestStreak,
    createdAt: state.firebase.serverTimestamp(),
  });
  setLeaderboardStatus(state.config.copy.leaderboardSaved, "connected");
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function getCategoryQuestions(categoryId) {
  if (categoryId !== "mixed") {
    return state.config.categories[categoryId].questions.map((question) => ({
      ...question,
      categoryId,
    }));
  }
  return Object.entries(state.config.categories).flatMap(([id, category]) =>
    category.questions.map((question) => ({ ...question, categoryId: id })),
  );
}

function setView(view) {
  elements.setupView.hidden = view !== "setup";
  elements.quizView.hidden = view !== "quiz";
  elements.resultsView.hidden = view !== "results";
}

function startQuiz() {
  persistIdentity();
  const available = getCategoryQuestions(state.category);
  if (available.length < state.config.settings.questionCount) {
    elements.setupError.textContent = `There are not enough questions for this session. Add at least ${state.config.settings.questionCount} questions to the selected topic in quiz-config.json.`;
    elements.setupError.hidden = false;
    return;
  }

  elements.setupError.hidden = true;
  const questionPool = state.config.experience.randomizeQuestions ? shuffle(available) : available;
  state.questions = questionPool.slice(0, state.config.settings.questionCount);
  state.questionIndex = 0;
  state.correctCount = 0;
  state.score = 0;
  state.currentStreak = 0;
  state.bestStreak = 0;
  state.sessionStartedAt = Date.now();
  setView("quiz");
  renderQuestion();
}

function renderQuestion() {
  clearInterval(state.timerId);
  state.answered = false;
  elements.feedbackPanel.hidden = true;
  const question = state.questions[state.questionIndex];
  const total = state.questions.length;

  elements.topicChip.textContent = state.category === "mixed"
    ? "MIXED PRACTICE"
    : state.config.categories[state.category].label.toUpperCase();
  elements.questionCount.textContent = `QUESTION ${state.questionIndex + 1} OF ${total}`;
  elements.scoreValue.textContent = state.score;
  elements.streakValue.textContent = state.currentStreak;
  elements.streakPill.hidden = !state.config.experience.streak.enabled;
  elements.progressTrack.setAttribute("aria-valuemax", total);
  elements.progressTrack.setAttribute("aria-valuenow", state.questionIndex);
  elements.progressFill.style.width = `${(state.questionIndex / total) * 100}%`;
  elements.questionLabel.textContent = state.config.categories[question.categoryId].label.toUpperCase();
  elements.questionText.textContent = question.prompt;
  elements.answerGrid.replaceChildren();

  const options = state.config.experience.randomizeOptions ? shuffle(question.options) : question.options;
  options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-option";
    button.dataset.answer = option;
    button.setAttribute("aria-label", `Option ${ANSWER_KEYS[index]}: ${option}`);
    const key = document.createElement("span");
    key.className = "answer-key";
    key.textContent = ANSWER_KEYS[index];
    const text = document.createElement("span");
    text.className = "answer-text";
    text.textContent = option;
    button.append(key, text);
    button.addEventListener("click", () => submitAnswer(option));
    elements.answerGrid.append(button);
  });

  elements.continueButton.textContent = state.questionIndex === total - 1
    ? "See your results"
    : "Next question";
  elements.continueButton.insertAdjacentHTML("beforeend", ' <span aria-hidden="true">→</span>');
  startTimer();
  elements.questionText.focus();
}

function startTimer() {
  const seconds = state.config.settings.secondsPerQuestion;
  state.deadline = performance.now() + seconds * 1000;
  elements.timerTrack.setAttribute("aria-valuemax", seconds);
  elements.timerTrack.setAttribute("aria-valuenow", seconds);
  elements.timerFill.classList.remove("low");
  updateTimer();
  state.timerId = window.setInterval(updateTimer, 100);
}

function updateTimer() {
  if (state.answered) return;
  const totalMs = state.config.settings.secondsPerQuestion * 1000;
  const remainingMs = Math.max(0, state.deadline - performance.now());
  const secondsRemaining = Math.ceil(remainingMs / 1000);
  elements.timerValue.textContent = secondsRemaining;
  elements.timerTrack.setAttribute("aria-valuenow", secondsRemaining);
  elements.timerFill.style.width = `${(remainingMs / totalMs) * 100}%`;
  elements.timerFill.classList.toggle("low", remainingMs <= 10000);
  if (remainingMs <= 0) submitAnswer(null);
}

function submitAnswer(selectedAnswer) {
  if (state.answered) return;
  state.answered = true;
  clearInterval(state.timerId);
  const question = state.questions[state.questionIndex];
  const isCorrect = selectedAnswer === question.answer;
  let bonusPoints = 0;
  const streak = state.config.experience.streak;
  if (isCorrect) {
    state.correctCount += 1;
    state.currentStreak = streak.enabled ? state.currentStreak + 1 : 0;
    state.bestStreak = Math.max(state.bestStreak, state.currentStreak);
    if (streak.enabled && state.currentStreak % streak.bonusEvery === 0) {
      bonusPoints = streak.bonusPoints;
    }
    state.score += state.config.settings.pointsPerCorrect + bonusPoints;
  } else {
    state.currentStreak = 0;
  }
  elements.scoreValue.textContent = state.score;
  elements.streakValue.textContent = state.currentStreak;
  elements.progressTrack.setAttribute("aria-valuenow", state.questionIndex + 1);
  elements.progressFill.style.width = `${((state.questionIndex + 1) / state.questions.length) * 100}%`;

  for (const button of elements.answerGrid.querySelectorAll(".answer-option")) {
    button.disabled = true;
    if (button.dataset.answer === question.answer) button.classList.add("correct-answer");
    if (button.dataset.answer === selectedAnswer && !isCorrect) button.classList.add("wrong-answer");
  }

  showFeedback(question, isCorrect, selectedAnswer === null, bonusPoints);
}

function showFeedback(question, isCorrect, timedOut, bonusPoints) {
  elements.feedbackMark.textContent = isCorrect ? "✓" : timedOut ? "⌛" : "!";
  elements.feedbackMark.classList.toggle("incorrect", !isCorrect);
  elements.feedbackKicker.textContent = isCorrect ? "NICE WORK" : timedOut ? "TIME'S UP" : "LET'S LEARN FROM IT";
  elements.feedbackTitle.textContent = isCorrect
    ? "That's right!"
    : timedOut ? "The answer was " + question.answer : `The answer was ${question.answer}`;
  const messageType = isCorrect
    ? !state.config.experience.streak.enabled
      ? "correct"
      : bonusPoints > 0
      ? "streakBonus"
      : state.currentStreak >= state.config.experience.streakMinimumForMessage ? "streak" : "correct"
    : timedOut ? "timeout" : "incorrect";
  elements.quizEncouragement.textContent = formatMessage(
    state.config.experience.messages[messageType],
    {
      streak: state.currentStreak,
      points: state.config.settings.pointsPerCorrect,
      bonus: bonusPoints,
      answer: question.answer,
    },
  );
  elements.feedbackHint.innerHTML = `<strong>Clue:</strong> ${escapeHtml(question.hint)}`;
  elements.feedbackSolution.innerHTML = `<strong>How to solve it:</strong> ${escapeHtml(question.solution)}`;
  elements.aiConnection.innerHTML = `<strong>AI connection:</strong> ${escapeHtml(question.aiConnection)}`;
  elements.sourceLink.textContent = `Explore the source: ${question.sourceTitle} ↗`;
  elements.sourceLink.href = question.sourceUrl;
  elements.feedbackPanel.hidden = false;
  elements.continueButton.focus();
}

function formatMessage(template, values) {
  return template.replace(/\{([a-z]+)\}/g, (match, key) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}

function escapeHtml(text) {
  const node = document.createElement("span");
  node.textContent = text;
  return node.innerHTML;
}

function nextQuestion() {
  if (!state.answered) return;
  if (state.questionIndex + 1 < state.questions.length) {
    state.questionIndex += 1;
    renderQuestion();
    elements.questionText.focus?.();
    return;
  }
  finishQuiz();
}

function readBestScores() {
  try {
    const scores = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!scores || typeof scores !== "object" || Array.isArray(scores)) {
      throw new Error("Saved scores are not in the expected format.");
    }
    return scores;
  } catch (error) {
    console.error("Could not read saved scores.", error);
    return {};
  }
}

function finishQuiz() {
  clearInterval(state.timerId);
  setView("results");
  const total = state.questions.length;
  const accuracy = Math.round((state.correctCount / total) * 100);
  const durationSeconds = Math.max(0, Math.round((Date.now() - state.sessionStartedAt) / 1000));
  const key = state.category;
  const bestScores = readBestScores();
  const previousBest = Number.isInteger(bestScores[key]) ? bestScores[key] : 0;
  const newBest = Math.max(previousBest, state.score);
  bestScores[key] = newBest;
  elements.bestScore.textContent = "";

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bestScores));
  } catch (error) {
    console.error("Could not save your score on this device.", error);
    elements.bestScore.textContent = "Your score is shown for this session, but could not be saved on this device.";
  }

  elements.finalScore.textContent = state.score;
  elements.finalCorrect.textContent = `${state.correctCount}/${total}`;
  elements.finalAccuracy.textContent = `${accuracy}%`;
  elements.finalStreak.textContent = state.bestStreak;
  elements.finalStreak.parentElement.hidden = !state.config.experience.streak.enabled;
  elements.resultsSubtitle.textContent = accuracy === 100
    ? state.config.experience.messages.resultPerfect
    : accuracy >= 60
      ? state.config.experience.messages.resultGood
      : state.config.experience.messages.resultKeepGoing;
  if (!elements.bestScore.textContent.includes("could not")) {
    elements.bestScore.textContent = newBest > previousBest
      ? "New personal best — saved on this device."
      : `Personal best: ${newBest} points · saved on this device.`;
  }

  elements.cloudResult.textContent = state.firebase && state.config.leaderboard.enabled
    ? "Saving your anonymous class leaderboard score…"
    : state.config.leaderboard.enabled
      ? state.config.copy.localLeaderboard
      : "Your session stayed on this device.";
  if (state.firebase && state.config.leaderboard.enabled && isValidClassCode(state.classCode) && isValidNickname(state.nickname)) {
    saveLeaderboardScore({ category: key, score: state.score, total, correct: state.correctCount, bestStreak: state.bestStreak, durationSeconds })
      .then(() => { elements.cloudResult.textContent = state.config.copy.leaderboardSaved; })
      .catch((error) => {
        console.error("Could not save the class leaderboard score.", error);
        elements.cloudResult.textContent = `Score could not be shared. ${getFirebaseErrorMessage(error, "score save")} Your score is still available on this device.`;
      });
  } else if (state.firebase && state.config.leaderboard.enabled) {
    elements.cloudResult.textContent = state.config.copy.leaderboardNotReady;
  }
  document.querySelector("#results-title").focus();
}

function resetToSetup() {
  clearInterval(state.timerId);
  setView("setup");
  elements.setupError.hidden = true;
}

function chooseCategory(categoryId) {
  if (categoryId !== "mixed" && !state.config.categories[categoryId]) return;
  state.category = categoryId;
  for (const button of elements.topicButtons) {
    const selected = button.dataset.category === categoryId;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
}

function addTopicButton(categoryId, category) {
  const button = document.createElement("button");
  button.className = "topic-card";
  button.type = "button";
  button.dataset.category = categoryId;
  button.setAttribute("aria-pressed", "false");

  const icon = document.createElement("span");
  icon.className = `topic-icon ${categoryId === "arithmetic" ? "arithmetic-icon" : categoryId === "matrices" ? "matrix-icon" : categoryId === "mixed" ? "mixed-icon" : "generic-icon"}`;
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = category.icon || (categoryId === "mixed" ? "✳" : "∿");

  const copy = document.createElement("span");
  copy.className = "topic-copy";
  const title = document.createElement("strong");
  title.textContent = category.label;
  const description = document.createElement("span");
  description.textContent = category.description || `Explore ${category.label.toLowerCase()} and how it connects to AI.`;
  copy.append(title, description);

  const arrow = document.createElement("span");
  arrow.className = "topic-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";
  button.append(icon, copy, arrow);
  button.addEventListener("click", () => chooseCategory(categoryId));
  elements.topicGrid.append(button);
}

function renderTopicButtons() {
  elements.topicGrid.replaceChildren();
  for (const [categoryId, category] of Object.entries(state.config.categories)) {
    addTopicButton(categoryId, category);
  }
  if (state.config.experience.allowMixed) {
    addTopicButton("mixed", state.config.experience.mixedTopic);
  }
  elements.topicButtons = [...elements.topicGrid.querySelectorAll(".topic-card")];
  chooseCategory(state.config.experience.allowMixed ? "mixed" : Object.keys(state.config.categories)[0]);
}

function applyConfig() {
  const { appearance, copy, branding, leaderboard } = state.config;
  const cssSizes = {
    "--quiz-topic-font-size": appearance.quizTopicFontSizePx,
    "--quiz-detail-font-size": appearance.quizDetailFontSizePx,
    "--quiz-score-font-size": appearance.quizScoreFontSizePx,
    "--quiz-streak-font-size": appearance.quizStreakFontSizePx,
    "--quiz-meta-gap": appearance.quizMetaGapPx,
    "--quiz-question-font-size": appearance.quizQuestionFontSizePx,
    "--quiz-answer-font-size": appearance.quizAnswerFontSizePx,
  };
  for (const [property, value] of Object.entries(cssSizes)) {
    document.documentElement.style.setProperty(property, `${value}px`);
  }
  document.querySelector("#learning-note-title").textContent = copy.learningNoteTitle;
  document.querySelector("#learning-note").textContent = copy.learningNote;
  document.querySelector("#setup-encouragement").textContent = copy.setupEncouragement;
  elements.startButton.firstChild.textContent = `${copy.startButton} `;
  elements.streakPill.title = copy.streakDescription;
  elements.streakPill.setAttribute("aria-label", copy.streakDescription);
  document.querySelector("#streak-explanation").textContent = copy.streakHelp;
  elements.nicknameInput.setAttribute("aria-label", copy.nicknameLabel);
  elements.classCodeInput.setAttribute("aria-label", copy.classCodeLabel);
  elements.nicknameInput.minLength = leaderboard.nicknameMinLength;
  elements.nicknameInput.maxLength = leaderboard.nicknameMaxLength;
  elements.classCodeInput.minLength = leaderboard.classCodeMinLength;
  elements.classCodeInput.maxLength = leaderboard.classCodeMaxLength;
  document.querySelector("#classroom-title").textContent = copy.leaderboardTitle;
  document.querySelector("#classroom-title").previousElementSibling.textContent = copy.leaderboardIntro.toUpperCase();
  document.querySelector("#nickname-label").textContent = copy.nicknameLabel;
  document.querySelector("#class-code-label").textContent = copy.classCodeLabel;
  document.querySelector(".leaderboard-privacy").textContent = copy.leaderboardPrivacy;
  elements.leaderboardList.setAttribute("aria-label", copy.leaderboardTitle);
  document.querySelector("#leaderboard-panel").hidden = !state.config.leaderboard.enabled;
  document.documentElement.style.setProperty("--purple", branding.theme.primary);
  document.documentElement.style.setProperty("--purple-dark", branding.theme.primaryDark);
  document.documentElement.style.setProperty("--page", branding.theme.page);
  elements.homeLink = renderHeader({
    root: elements.headerRoot,
    branding,
    introText: copy.introText,
    onHome: handleHomeClick,
  });
  renderFooter({ root: elements.footerRoot, branding });
  initializeIdentity();
}

function handleHomeClick(event) {
  event.preventDefault();
  const hasQuizDetails = !elements.quizView.hidden || !elements.resultsView.hidden;
  if (hasQuizDetails && !window.confirm(state.config.copy.homeConfirm)) return;
  resetToSetup();
  chooseCategory(state.config.experience.allowMixed ? "mixed" : Object.keys(state.config.categories)[0]);
  window.location.hash = "home";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function initialize() {
  fetch(CONFIG_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load ${CONFIG_URL} (${response.status}).`);
      return response.json();
    })
    .then(async (config) => {
      validateConfig(config);
      await loadQuestionBanks(config);
      state.config = config;
      applyConfig();
      elements.startButton.disabled = false;
      elements.sessionLength.textContent = `${config.settings.questionCount} questions · ${config.settings.secondsPerQuestion} sec each`;
      renderTopicButtons();
      elements.startButton.addEventListener("click", startQuiz);
      elements.continueButton.addEventListener("click", nextQuestion);
      elements.againButton.addEventListener("click", startQuiz);
      elements.topicsButton.addEventListener("click", resetToSetup);
      await loadFirebase();
    })
    .catch((error) => {
      console.error("Quiz could not be initialized.", error);
      elements.setupError.textContent = `The quiz could not start: ${error.message}`;
      elements.setupError.hidden = false;
      elements.startButton.disabled = true;
    });
}

initialize();
