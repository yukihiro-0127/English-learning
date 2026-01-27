const STORAGE_KEY = "english-buddy-state";

const defaultState = {
  settings: {
    name: "",
    theme: "auto",
    cardMode: "en-ja",
    quizDirection: "en-ja",
    speech: true,
    badgeNotifications: true,
  },
  progress: {
    total: 0,
    correct: 0,
    streak: 0,
    lastStudy: "",
    xp: 0,
    correctStreak: 0,
    badges: [],
    category: {
      daily: { total: 0, correct: 0 },
      business: { total: 0, correct: 0 },
      it: { total: 0, correct: 0 },
    },
  },
  cards: {
    favorites: [],
    known: {},
    lastCardId: "",
  },
};

const badgeCatalog = [
  { id: "first-study", label: "初回学習" },
  { id: "ten-correct", label: "10連続正解" },
  { id: "daily-20", label: "Daily 20問" },
  { id: "business-20", label: "Business 20問" },
  { id: "it-20", label: "IT 20問" },
  { id: "xp-100", label: "XP 100" },
];

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));

const loadState = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      ...defaultState,
      ...saved,
      settings: { ...defaultState.settings, ...(saved?.settings || {}) },
      progress: {
        ...defaultState.progress,
        ...(saved?.progress || {}),
        category: {
          ...defaultState.progress.category,
          ...(saved?.progress?.category || {}),
        },
      },
      cards: { ...defaultState.cards, ...(saved?.cards || {}) },
    };
  } catch (error) {
    return { ...defaultState };
  }
};

const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const applyTheme = (theme) => {
  const root = document.documentElement;
  if (theme === "auto") {
    root.removeAttribute("data-theme");
    return;
  }
  root.setAttribute("data-theme", theme);
};

const todayString = () => new Date().toISOString().slice(0, 10);

const updateStreak = (state) => {
  const today = todayString();
  if (!state.progress.lastStudy) {
    state.progress.streak = 1;
    state.progress.lastStudy = today;
    return;
  }
  if (state.progress.lastStudy === today) {
    return;
  }
  const last = new Date(state.progress.lastStudy);
  const diff = (new Date(today) - last) / (1000 * 60 * 60 * 24);
  if (diff === 1) {
    state.progress.streak += 1;
  } else {
    state.progress.streak = 1;
  }
  state.progress.lastStudy = today;
};

const addXP = (state, amount) => {
  state.progress.xp += amount;
};

const awardBadge = (state, badgeId) => {
  if (!state.progress.badges.includes(badgeId)) {
    state.progress.badges.push(badgeId);
  }
};

const checkBadges = (state, category) => {
  if (state.progress.total > 0) {
    awardBadge(state, "first-study");
  }
  if (state.progress.correctStreak >= 10) {
    awardBadge(state, "ten-correct");
  }
  if (state.progress.xp >= 100) {
    awardBadge(state, "xp-100");
  }
  if (category) {
    const count = state.progress.category[category]?.total || 0;
    if (count >= 20) {
      awardBadge(state, `${category}-20`);
    }
  }
};

const registerAnswer = (state, category, isCorrect) => {
  state.progress.total += 1;
  if (category && state.progress.category[category]) {
    state.progress.category[category].total += 1;
  }
  if (isCorrect) {
    state.progress.correct += 1;
    if (category && state.progress.category[category]) {
      state.progress.category[category].correct += 1;
    }
    state.progress.correctStreak += 1;
    addXP(state, 10);
  } else {
    state.progress.correctStreak = 0;
    addXP(state, 2);
  }
  updateStreak(state);
  checkBadges(state, category);
  saveState(state);
};

const speakText = (text) => {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
};

const loadVocab = async () => {
  const response = await fetch("data/vocab.json");
  return response.json();
};

const pickFrom = (items) => items[Math.floor(Math.random() * items.length)];

const shuffle = (array) => array.sort(() => Math.random() - 0.5);

const initNavigation = () => {
  const page = document.body.dataset.page;
  qsa(".tabbar a").forEach((link) => {
    if (link.dataset.tab === page) {
      link.classList.add("is-active");
    }
  });
};

const initHome = (state, vocab) => {
  const streak = qs("#home-streak");
  const xp = qs("#home-xp");
  const level = qs("#home-level");
  const homeCardEn = qs("#home-card-en");
  const homeCardJa = qs("#home-card-ja");

  if (streak) streak.textContent = state.progress.streak;
  if (xp) xp.textContent = state.progress.xp;
  if (level) level.textContent = `Lv. ${Math.floor(state.progress.xp / 100) + 1}`;

  const lastCard = vocab.find((item) => item.id === state.cards.lastCardId) || pickFrom(vocab);
  if (homeCardEn) homeCardEn.textContent = lastCard.en;
  if (homeCardJa) homeCardJa.textContent = lastCard.ja;
};

const initCards = (state, vocab) => {
  const categorySelect = qs("#card-category-select");
  const levelSelect = qs("#card-level-select");
  const modeSelect = qs("#card-mode-select");
  const revealBtn = qs("#card-reveal");
  const cardFront = qs("#card-front");
  const cardBack = qs("#card-back");
  const cardExample = qs("#card-example");
  const cardCategory = qs("#card-category");
  const speakButton = qs("#card-speak");
  const favoriteBtn = qs("#card-favorite");

  let currentList = [...vocab];
  let currentIndex = 0;
  let revealed = false;

  const applyFilters = () => {
    const category = categorySelect.value;
    const level = levelSelect.value;
    currentList = vocab.filter((item) => {
      const matchCategory = category === "all" || item.category === category;
      const matchLevel = level === "all" || item.level === Number(level);
      return matchCategory && matchLevel;
    });
    const knownSet = state.cards.known;
    currentList.sort((a, b) => (knownSet[a.id] ? 1 : -1) - (knownSet[b.id] ? 1 : -1));
    currentIndex = 0;
    revealed = false;
    renderCard();
  };

  const renderCard = () => {
    if (currentList.length === 0) return;
    const item = currentList[currentIndex];
    state.cards.lastCardId = item.id;
    saveState(state);
    cardCategory.textContent = item.category.toUpperCase();
    cardFront.textContent = item.en;
    cardBack.textContent = item.ja;
    cardExample.textContent = item.example_en;

    const mode = modeSelect.value;
    if (mode === "en-ja") {
      cardFront.classList.remove("is-hidden");
      cardBack.classList.toggle("is-hidden", !revealed);
    } else if (mode === "ja-en") {
      cardBack.classList.remove("is-hidden");
      cardFront.classList.toggle("is-hidden", !revealed);
    } else {
      cardFront.classList.remove("is-hidden");
      cardBack.classList.remove("is-hidden");
    }

    if (favoriteBtn) {
      favoriteBtn.textContent = state.cards.favorites.includes(item.id) ? "★ お気に入り" : "☆ お気に入り";
    }
  };

  const nextCard = () => {
    if (currentList.length === 0) return;
    currentIndex = (currentIndex + 1) % currentList.length;
    revealed = false;
    renderCard();
  };

  const prevCard = () => {
    if (currentList.length === 0) return;
    currentIndex = (currentIndex - 1 + currentList.length) % currentList.length;
    revealed = false;
    renderCard();
  };

  qs("#card-next").addEventListener("click", nextCard);
  qs("#card-prev").addEventListener("click", prevCard);
  qs("#cards-shuffle").addEventListener("click", () => {
    currentList = shuffle(currentList);
    currentIndex = 0;
    revealed = false;
    renderCard();
  });

  revealBtn.addEventListener("click", () => {
    revealed = !revealed;
    renderCard();
  });

  qs("#flashcard").addEventListener("click", (event) => {
    if (event.target.tagName === "BUTTON") return;
    revealed = !revealed;
    renderCard();
  });

  qs("#flashcard").addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") nextCard();
    if (event.key === "ArrowLeft") prevCard();
    if (event.key === " ") {
      event.preventDefault();
      revealed = !revealed;
      renderCard();
    }
  });

  qs("#card-known").addEventListener("click", () => {
    const item = currentList[currentIndex];
    state.cards.known[item.id] = true;
    registerAnswer(state, item.category, true);
    nextCard();
  });

  qs("#card-unknown").addEventListener("click", () => {
    const item = currentList[currentIndex];
    state.cards.known[item.id] = false;
    registerAnswer(state, item.category, false);
    nextCard();
  });

  favoriteBtn.addEventListener("click", () => {
    const item = currentList[currentIndex];
    if (state.cards.favorites.includes(item.id)) {
      state.cards.favorites = state.cards.favorites.filter((id) => id !== item.id);
    } else {
      state.cards.favorites.push(item.id);
    }
    saveState(state);
    renderCard();
  });

  if (speakButton) {
    speakButton.addEventListener("click", () => {
      if (!state.settings.speech) return;
      const item = currentList[currentIndex];
      speakText(item.en);
    });
  }

  categorySelect.addEventListener("change", applyFilters);
  levelSelect.addEventListener("change", applyFilters);
  modeSelect.addEventListener("change", () => {
    revealed = false;
    renderCard();
  });

  modeSelect.value = state.settings.cardMode;
  applyFilters();
};

const initQuiz = (state, vocab) => {
  const setup = qs("#quiz-setup");
  const panel = qs("#quiz-panel");
  const resultModal = qs("#quiz-result");
  const questionEl = qs("#quiz-question");
  const optionsEl = qs("#quiz-options");
  const progressEl = qs("#quiz-progress");
  const timerEl = qs("#quiz-timer");
  const resultScore = qs("#result-score");
  const resultCorrect = qs("#result-correct");
  const resultTime = qs("#result-time");
  const resultWrongList = qs("#result-wrong-list");
  const speakBtn = qs("#quiz-speak");

  let questions = [];
  let current = 0;
  let correct = 0;
  let startTime = 0;
  let timer = null;
  let wrongList = [];
  let mode = "ten";
  let direction = state.settings.quizDirection;
  let category = "all";

  const buildQuestions = () => {
    const filtered = vocab.filter((item) => category === "all" || item.category === category);
    const pool = shuffle([...filtered]);
    if (mode === "ten") {
      return pool.slice(0, 10);
    }
    if (mode === "survival") {
      return pool;
    }
    return pool;
  };

  const getPrompt = (item) => (direction === "en-ja" ? item.en : item.ja);
  const getAnswer = (item) => (direction === "en-ja" ? item.ja : item.en);

  const renderQuestion = () => {
    if (!questions[current]) return endQuiz();
    const item = questions[current];
    const options = [getAnswer(item)];
    const pool = shuffle(vocab.filter((v) => v.id !== item.id));
    while (options.length < 4 && pool.length) {
      const option = getAnswer(pool.pop());
      if (!options.includes(option)) options.push(option);
    }
    shuffle(options);
    questionEl.textContent = getPrompt(item);
    optionsEl.innerHTML = "";
    options.forEach((option) => {
      const button = document.createElement("button");
      button.className = "button ghost";
      button.textContent = option;
      button.addEventListener("click", () => handleAnswer(option, item));
      optionsEl.appendChild(button);
    });
    progressEl.textContent = `Question ${current + 1}`;
  };

  const handleAnswer = (answer, item) => {
    const isCorrect = answer === getAnswer(item);
    if (isCorrect) correct += 1;
    else wrongList.push(item);
    registerAnswer(state, item.category, isCorrect);
    current += 1;
    if (mode === "survival" && !isCorrect) return endQuiz();
    if (mode === "time" && timerEl.textContent === "0s") return endQuiz();
    renderQuestion();
  };

  const startTimer = () => {
    let remaining = 60;
    timerEl.textContent = `${remaining}s`;
    timer = setInterval(() => {
      remaining -= 1;
      timerEl.textContent = `${remaining}s`;
      if (remaining <= 0) {
        clearInterval(timer);
        endQuiz();
      }
    }, 1000);
  };

  const startQuiz = () => {
    mode = qs("#quiz-mode").value;
    direction = qs("#quiz-direction").value;
    category = qs("#quiz-category").value;
    questions = buildQuestions();
    current = 0;
    correct = 0;
    wrongList = [];
    startTime = Date.now();
    setup.classList.add("is-hidden");
    panel.classList.remove("is-hidden");
    resultModal.classList.add("is-hidden");
    timerEl.textContent = mode === "time" ? "60s" : "--";
    if (timer) clearInterval(timer);
    if (mode === "time") startTimer();
    renderQuestion();
  };

  const endQuiz = () => {
    if (timer) clearInterval(timer);
    const total = Math.max(1, current);
    const accuracy = Math.round((correct / total) * 100);
    const avgTime = Math.round((Date.now() - startTime) / total / 1000);
    resultScore.textContent = `${accuracy}%`;
    resultCorrect.textContent = `${correct}/${total}`;
    resultTime.textContent = `${avgTime}s`;
    resultWrongList.innerHTML = "";
    wrongList.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = `${item.en} / ${item.ja}`;
      resultWrongList.appendChild(li);
    });
    resultModal.classList.remove("is-hidden");
  };

  qs("#quiz-start").addEventListener("click", startQuiz);
  qs("#quiz-reset").addEventListener("click", () => {
    setup.classList.remove("is-hidden");
    panel.classList.add("is-hidden");
    resultModal.classList.add("is-hidden");
  });

  qs("#result-retry").addEventListener("click", startQuiz);
  qs("#result-review").addEventListener("click", () => {
    if (!wrongList.length) return;
    questions = wrongList;
    current = 0;
    correct = 0;
    wrongList = [];
    startTime = Date.now();
    setup.classList.add("is-hidden");
    panel.classList.remove("is-hidden");
    resultModal.classList.add("is-hidden");
    renderQuestion();
  });

  qs("#quiz-skip").addEventListener("click", () => {
    current += 1;
    renderQuestion();
  });

  speakBtn.addEventListener("click", () => {
    if (!state.settings.speech) return;
    const item = questions[current];
    if (item) speakText(item.en);
  });

  qs("#quiz-direction").value = state.settings.quizDirection;
};

const initProgress = (state) => {
  const accuracy = state.progress.total
    ? Math.round((state.progress.correct / state.progress.total) * 100)
    : 0;
  qs("#progress-accuracy").textContent = `${accuracy}%`;
  qs("#progress-total").textContent = state.progress.total;
  qs("#progress-correct").textContent = state.progress.correct;
  qs("#progress-streak").textContent = `${state.progress.streak}日`;

  const level = Math.floor(state.progress.xp / 100) + 1;
  const xpInLevel = state.progress.xp % 100;
  qs("#progress-level").textContent = `Lv. ${level}`;
  qs("#progress-xp-text").textContent = `${xpInLevel} / 100 XP`;
  qs("#progress-xp-bar").style.width = `${xpInLevel}%`;

  const updateCategory = (key) => {
    const total = state.progress.category[key].total;
    const correct = state.progress.category[key].correct;
    const rate = total ? Math.round((correct / total) * 100) : 0;
    qs(`#progress-${key}`).textContent = `${rate}%`;
    qs(`#progress-${key}-bar`).style.width = `${rate}%`;
  };

  updateCategory("daily");
  updateCategory("business");
  updateCategory("it");

  const badgeContainer = qs("#progress-badges");
  badgeContainer.innerHTML = "";
  badgeCatalog.forEach((badge) => {
    const div = document.createElement("div");
    div.className = "badge";
    div.textContent = badge.label;
    if (!state.progress.badges.includes(badge.id)) {
      div.style.opacity = "0.4";
    }
    badgeContainer.appendChild(div);
  });

  const ranking = qs("#progress-ranking");
  const name = state.settings.name || "You";
  const sample = [
    { name: "AI Haru", score: 320 },
    { name: "AI Luna", score: 260 },
    { name: "AI Kai", score: 180 },
  ];
  const userScore = state.progress.xp;
  const list = [...sample, { name, score: userScore }].sort((a, b) => b.score - a.score);
  ranking.innerHTML = "";
  list.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = `${entry.name} - ${entry.score} XP`;
    ranking.appendChild(li);
  });
};

const initSettings = (state) => {
  const nameInput = qs("#settings-name");
  const themeSelect = qs("#settings-theme");
  const cardMode = qs("#settings-card-mode");
  const quizDirection = qs("#settings-quiz-direction");
  const speechToggle = qs("#settings-speech");
  const badgeToggle = qs("#settings-badges");

  nameInput.value = state.settings.name;
  themeSelect.value = state.settings.theme;
  cardMode.value = state.settings.cardMode;
  quizDirection.value = state.settings.quizDirection;
  speechToggle.checked = state.settings.speech;
  badgeToggle.checked = state.settings.badgeNotifications;

  qs("#settings-save").addEventListener("click", () => {
    state.settings.name = nameInput.value.trim();
    state.settings.theme = themeSelect.value;
    state.settings.cardMode = cardMode.value;
    state.settings.quizDirection = quizDirection.value;
    state.settings.speech = speechToggle.checked;
    state.settings.badgeNotifications = badgeToggle.checked;
    applyTheme(state.settings.theme);
    saveState(state);
  });

  qs("#settings-reset").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  });
};

const initApp = async () => {
  initNavigation();
  const state = loadState();
  applyTheme(state.settings.theme);
  const vocab = await loadVocab();
  const page = document.body.dataset.page;

  if (page === "home") initHome(state, vocab);
  if (page === "cards") initCards(state, vocab);
  if (page === "quiz") initQuiz(state, vocab);
  if (page === "progress") initProgress(state);
  if (page === "settings") initSettings(state);
};

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});
