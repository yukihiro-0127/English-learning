const flashcards = [
  {
    tag: "Daily",
    term: "Nice to meet you.",
    meaning: "はじめまして。",
    hint: "シーン: 自己紹介",
  },
  {
    tag: "Business",
    term: "Let's align on the agenda.",
    meaning: "議題をすり合わせましょう。",
    hint: "シーン: 会議の始まり",
  },
  {
    tag: "IT",
    term: "We need to deploy before the deadline.",
    meaning: "締め切り前にデプロイが必要です。",
    hint: "シーン: 開発スケジュール",
  },
];

const planButton = document.getElementById("start-plan");
const shuffleButton = document.getElementById("shuffle-card");
const planSection = document.getElementById("plan");
const cardTag = document.getElementById("card-tag");
const cardTerm = document.getElementById("card-term");
const cardMeaning = document.getElementById("card-meaning");
const cardHint = document.getElementById("card-hint");
const ctaResult = document.getElementById("cta-result");

let cardIndex = 0;

const updateCard = () => {
  const { tag, term, meaning, hint } = flashcards[cardIndex];
  cardTag.textContent = tag;
  cardTerm.textContent = term;
  cardMeaning.textContent = meaning;
  cardHint.textContent = hint;
};

planButton.addEventListener("click", () => {
  planSection.scrollIntoView({ behavior: "smooth" });
});

shuffleButton.addEventListener("click", () => {
  cardIndex = (cardIndex + 1) % flashcards.length;
  updateCard();
});

const topics = {
  vocab: "語彙を増やすなら、IT用語のミニ辞書を作ってみよう。",
  speaking: "録音ボタンを付けて、音読のチェックができるよ。",
  log: "毎日の学習時間を入力するシンプルなログ画面を作ろう。",
};

const optionButtons = document.querySelectorAll("[data-topic]");
optionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const topic = button.dataset.topic;
    ctaResult.textContent = topics[topic];
  });
});
