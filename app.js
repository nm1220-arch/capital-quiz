const screenMain = document.getElementById('screenMain');
const screenQuiz = document.getElementById('screenQuiz');
const screenReview = document.getElementById('screenReview');
const screenDictionary = document.getElementById('screenDictionary');

const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const searchResult = document.getElementById('searchResult');
const navReviewBtn = document.getElementById('navReviewBtn');
const navDictionaryBtn = document.getElementById('navDictionaryBtn');
const btnSearch = document.getElementById('btnSearch');

const continentBtns = document.querySelectorAll('.continent-btn');
const backToMainFromQuiz = document.getElementById('backToMainFromQuiz');
const backToMainFromReview = document.getElementById('backToMainFromReview');
const backToMainFromDict = document.getElementById('backToMainFromDict');
const resetProgressBtn = document.getElementById('resetProgressBtn');

// Quiz Elements
const quizContinentName = document.getElementById('quizContinentName');
const quizCountryName = document.getElementById('quizCountryName');
const quizForm = document.getElementById('quizForm');
const quizInput = document.getElementById('quizInput');
const quizFeedback = document.getElementById('quizFeedback');
const quizProgressText = document.getElementById('quizProgressText');

// Modal Elements
const questionModal = document.getElementById('questionModal');
const modalContinentName = document.getElementById('modalContinentName');
const modalMaxCount = document.getElementById('modalMaxCount');
const modalInputCount = document.getElementById('modalInputCount');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalStartBtn = document.getElementById('modalStartBtn');

// Review Elements
const reviewList = document.getElementById('reviewList');
const emptyReview = document.getElementById('emptyReview');
const clearReviewBtn = document.getElementById('clearReviewBtn');

// Dictionary Elements
const dictionaryList = document.getElementById('dictionaryList');

// State
let currentQuizQueue = [];
let currentQuestionIndex = 0;
let currentContinentStr = "";
let selectedContinentData = [];
let incorrectNotes = JSON.parse(localStorage.getItem('capitalQuizReview')) || [];
if (!Array.isArray(incorrectNotes)) incorrectNotes = [];

let correctAnswersHard = JSON.parse(localStorage.getItem('capitalQuizCorrectHard'));
let correctAnswersEasy = JSON.parse(localStorage.getItem('capitalQuizCorrectEasy')) || [];

if (!correctAnswersHard) {
  let oldData = JSON.parse(localStorage.getItem('capitalQuizCorrect'));
  correctAnswersHard = Array.isArray(oldData) ? oldData : [];
  localStorage.setItem('capitalQuizCorrectHard', JSON.stringify(correctAnswersHard));
}
if (!Array.isArray(correctAnswersHard)) correctAnswersHard = [];
if (!Array.isArray(correctAnswersEasy)) correctAnswersEasy = [];

let currentQuizMode = 'easy'; // default

// Update Progress UI
function updateProgressUI() {
  const continents = ['asia', 'europe', 'africa', 'north-america', 'south-america', 'oceania'];
  const continentNames = {
    'asia': '아시아', 'europe': '유럽', 'africa': '아프리카', 
    'north-america': '북아메리카', 'south-america': '남아메리카', 'oceania': '오세아니아'
  };

  continents.forEach(cont => {
    const totalCountries = quizData.filter(d => d.continent === cont).length;
    if(totalCountries === 0) return;
    
    const easyCount = quizData.filter(d => d.continent === cont && correctAnswersEasy.includes(d.country)).length;
    const hardCount = quizData.filter(d => d.continent === cont && correctAnswersHard.includes(d.country)).length;
    
    const easyPercentage = Math.floor((easyCount / totalCountries) * 100);
    const hardPercentage = Math.floor((hardCount / totalCountries) * 100);
    
    // Easy UI
    const easyFill = document.getElementById(`progress-easy-${cont}`);
    const easyText = document.getElementById(`progress-text-easy-${cont}`);
    if(easyFill) {
      easyFill.style.width = `${easyPercentage}%`;
      if(easyPercentage === 100) easyFill.classList.add('completed');
      else easyFill.classList.remove('completed');
    }
    if(easyText) easyText.innerText = `${easyPercentage}%`;

    // Hard UI
    const hardFill = document.getElementById(`progress-hard-${cont}`);
    const hardText = document.getElementById(`progress-text-hard-${cont}`);
    if(hardFill) {
      hardFill.style.width = `${hardPercentage}%`;
      if(hardPercentage === 100) hardFill.classList.add('completed');
      else hardFill.classList.remove('completed');
    }
    if(hardText) hardText.innerText = `${hardPercentage}%`;

    // Badge Title Update
    const badgeEl = document.getElementById(`badge-${cont}`);
    if(badgeEl) {
      if(hardPercentage === 100) {
        badgeEl.innerHTML = `👑 신 <br> <span style="font-size: 0.9rem">${continentNames[cont]}</span>`;
      } else if (easyPercentage === 100) {
        badgeEl.innerHTML = `🏆 고수 <br> <span style="font-size: 0.9rem">${continentNames[cont]}</span>`;
      } else {
        badgeEl.innerText = continentNames[cont];
      }
    }
  });
}
// Initial call
updateProgressUI();

// Levenshtein Distance for Fuzzy Matching (한국어 글자 단위)
function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(matrix[i][j - 1] + 1, // insertion
                   matrix[i - 1][j] + 1) // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function checkAnswerSingle(input, target) {
  const cleanInput = input.replace(/\s+/g, '').toLowerCase();
  const cleanTarget = target.replace(/\s+/g, '').toLowerCase();
  
  if (cleanInput === cleanTarget) return { isCorrect: true, type: 'exact' };
  
  // 부분 일치 로직 (한쪽이 다른 쪽을 포함하는 경우)
  if (cleanTarget.includes(cleanInput) && cleanInput.length >= 2) return { isCorrect: true, type: 'fuzzy' };
  if (cleanInput.includes(cleanTarget) && cleanTarget.length >= 2) return { isCorrect: true, type: 'fuzzy' };
  
  const dist = levenshteinDistance(cleanInput, cleanTarget);
  // 정답 길이가 3글자 이상이면 1글자 틀린것 허용, 5글자 이상이면 2글자 틀린것 허용
  let allowedDist = 0;
  if (cleanTarget.length >= 5) allowedDist = 2;
  else if (cleanTarget.length >= 3) allowedDist = 1;

  if (dist <= allowedDist) {
    return { isCorrect: true, type: 'fuzzy' };
  }
  return { isCorrect: false, type: 'incorrect' };
}

function checkAnswerFuzzy(input, target, aliases = []) {
  // 메인 타겟 확인
  let result = checkAnswerSingle(input, target);
  if (result.isCorrect) return result;
  
  // 별칭(aliases) 목록 확인
  if (aliases && aliases.length > 0) {
    for (let alias of aliases) {
      let aliasResult = checkAnswerSingle(input, alias);
      if (aliasResult.isCorrect) return aliasResult;
    }
  }
  
  return { isCorrect: false, type: 'incorrect' };
}

// Navigation
function showScreen(screen) {
  screenMain.classList.remove('active');
  screenQuiz.classList.remove('active');
  screenReview.classList.remove('active');
  screenDictionary.classList.remove('active');
  
  screenMain.classList.add('hidden');
  screenQuiz.classList.add('hidden');
  screenReview.classList.add('hidden');
  screenDictionary.classList.add('hidden');
  
  screen.classList.remove('hidden');
  // Trigger reflow for animation
  void screen.offsetWidth;
  screen.classList.add('active');
}

navReviewBtn.addEventListener('click', () => {
  renderReviewList();
  showScreen(screenReview);
});
navDictionaryBtn.addEventListener('click', () => {
  renderDictionaryList();
  showScreen(screenDictionary);
});
backToMainFromQuiz.addEventListener('click', () => showScreen(screenMain));
backToMainFromReview.addEventListener('click', () => showScreen(screenMain));
backToMainFromDict.addEventListener('click', () => showScreen(screenMain));

// Reset Progress Logic
resetProgressBtn.addEventListener('click', () => {
  if(confirm("진행도를 모두 초기화하시겠습니까?")) {
    correctAnswersEasy = [];
    correctAnswersHard = [];
    localStorage.setItem('capitalQuizCorrectEasy', JSON.stringify(correctAnswersEasy));
    localStorage.setItem('capitalQuizCorrectHard', JSON.stringify(correctAnswersHard));
    updateProgressUI();
  }
});

// Search functionality
function executeSearch(query) {
  if (!query) {
    searchResult.classList.add('hidden');
    return;
  }

  // Remove spaces to make search more robust
  const cleanQuery = query.replace(/\s+/g, '');
  const results = quizData.filter(d => 
    d.country.replace(/\s+/g, '').includes(cleanQuery) || 
    d.capital.replace(/\s+/g, '').includes(cleanQuery)
  );

  if (results.length > 0) {
    searchResult.innerHTML = results.map(r => 
      `<div style="padding: 0.5rem; border-bottom: 1px solid var(--glass-border);">
         <strong>${r.country}</strong> - ${r.capital}
       </div>`
    ).join('');
    searchResult.classList.remove('hidden');
  } else {
    searchResult.innerHTML = `<div style="padding: 0.5rem; color: var(--text-muted);">결과가 없습니다.</div>`;
    searchResult.classList.remove('hidden');
  }
}

btnSearch.addEventListener('click', () => {
  executeSearch(searchInput.value.trim().toLowerCase());
});

searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  executeSearch(searchInput.value.trim().toLowerCase());
});

document.addEventListener('click', (e) => {
  if (!searchForm.contains(e.target) && !searchResult.contains(e.target)) {
    searchResult.classList.add('hidden');
  }
});

// Quiz Logic
let selectedIncorrectData = [];

continentBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const continent = btn.getAttribute('data-continent');
    const cNames = {
      'asia': '아시아', 'europe': '유럽', 'africa': '아프리카', 
      'north-america': '북아메리카', 'south-america': '남아메리카', 'oceania': '오세아니아'
    };
    currentContinentStr = cNames[continent] || continent;
    
    selectedContinentData = quizData.filter(d => d.continent === continent);
    if(selectedContinentData.length === 0) {
      alert("해당 대륙의 데이터가 없습니다.");
      return;
    }
    
    function updateModalState() {
      const modeRadios = document.querySelectorAll('input[name="quizMode"]');
      let mode = 'easy';
      modeRadios.forEach(r => { if(r.checked) mode = r.value; });
      currentQuizMode = mode;
      
      const targetAnswers = mode === 'easy' ? correctAnswersEasy : correctAnswersHard;
      selectedIncorrectData = selectedContinentData.filter(d => !targetAnswers.includes(d.country));
      
      const retryBtn = document.getElementById('modalRetryIncorrectBtn');
      const incorrectCountSpan = document.getElementById('modalIncorrectCount');
      if (selectedIncorrectData.length > 0 && selectedIncorrectData.length < selectedContinentData.length) {
        retryBtn.style.display = 'block';
        incorrectCountSpan.innerText = selectedIncorrectData.length;
      } else {
        retryBtn.style.display = 'none';
      }
    }
    
    // 모드 라디오버튼 변경 시 즉시 업데이트
    const modeRadios = document.querySelectorAll('input[name="quizMode"]');
    modeRadios.forEach(r => {
      r.removeEventListener('change', updateModalState);
      r.addEventListener('change', updateModalState);
    });
    
    updateModalState();
    
    // 모달 표시
    modalContinentName.innerText = `${currentContinentStr} 퀴즈 설정`;
    modalMaxCount.innerText = `현재 이 대륙에는 최대 ${selectedContinentData.length}개의 나라가 있습니다.`;
    modalInputCount.max = selectedContinentData.length;
    modalInputCount.value = Math.min(5, selectedContinentData.length);
    
    questionModal.classList.remove('hidden');
  });
});

modalCancelBtn.addEventListener('click', () => {
  questionModal.classList.add('hidden');
});

modalStartBtn.addEventListener('click', () => {
  let num = parseInt(modalInputCount.value, 10);
  if(isNaN(num) || num < 1) num = 1;
  if(num > selectedContinentData.length) num = selectedContinentData.length;
  
  questionModal.classList.add('hidden');
  startQuiz(num, selectedContinentData);
});

document.getElementById('modalRetryIncorrectBtn').addEventListener('click', () => {
  questionModal.classList.add('hidden');
  startQuiz(selectedIncorrectData.length, selectedIncorrectData);
});

function startQuiz(numQuestions, dataToUse) {
  let shuffled = shuffleArray(dataToUse);
  currentQuizQueue = shuffled.slice(0, numQuestions);
  currentQuestionIndex = 0;
  
  quizContinentName.innerText = `${currentContinentStr} 퀴즈`;
  showScreen(screenQuiz);
  loadNextQuestion();
}

function loadNextQuestion() {
  const mcContainer = document.getElementById('quizMultipleChoice');
  
  if (currentQuestionIndex >= currentQuizQueue.length) {
    quizCountryName.innerText = "퀴즈 완료! 🎉";
    quizForm.style.display = 'none';
    if(mcContainer) mcContainer.classList.add('hidden');
    quizFeedback.innerText = "모든 문제를 풀었습니다.";
    quizFeedback.className = 'feedback correct';
    quizFeedback.classList.remove('hidden');
    return;
  }
  
  const q = currentQuizQueue[currentQuestionIndex];
  quizCountryName.innerText = q.country;
  quizFeedback.classList.add('hidden');
  quizProgressText.innerText = `${currentQuestionIndex + 1} / ${currentQuizQueue.length}`;
  
  if (currentQuizMode === 'hard') {
    if(mcContainer) mcContainer.classList.add('hidden');
    quizForm.style.display = 'flex';
    quizInput.value = '';
    quizInput.focus();
  } else {
    // Easy mode
    quizForm.style.display = 'none';
    if(mcContainer) {
      mcContainer.innerHTML = '';
      mcContainer.classList.remove('hidden');
      
      // Generate 4 random incorrect answers
      let options = [q.capital];
      let otherCapitals = quizData.filter(d => d.capital !== q.capital).map(d => d.capital);
      otherCapitals = shuffleArray(otherCapitals);
      for(let i=0; i<4; i++) {
        options.push(otherCapitals[i]);
      }
      options = shuffleArray(options);
      
      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn-search';
        btn.type = 'button';
        btn.style.width = '100%';
        btn.style.padding = '1rem';
        btn.style.fontSize = '1.1rem';
        btn.style.marginBottom = '0.5rem';
        btn.innerText = opt;
        btn.onclick = () => handleEasyAnswer(opt, q);
        mcContainer.appendChild(btn);
      });
    }
  }
}

function handleEasyAnswer(selectedOpt, currentQ) {
  quizFeedback.classList.remove('hidden');
  quizFeedback.className = 'feedback';
  
  // exact match for multiple choice
  if (selectedOpt === currentQ.capital) {
    quizFeedback.innerText = "정답입니다! 🎉";
    quizFeedback.classList.add('correct');
    
    if(!correctAnswersEasy.includes(currentQ.country)) {
      correctAnswersEasy.push(currentQ.country);
      localStorage.setItem('capitalQuizCorrectEasy', JSON.stringify(correctAnswersEasy));
      updateProgressUI();
    }
    
    setTimeout(() => {
      currentQuestionIndex++;
      loadNextQuestion();
    }, 1000);
  } else {
    quizFeedback.innerHTML = `틀렸습니다 😢<br>정답은 <strong>${currentQ.capital}</strong> 입니다.`;
    quizFeedback.classList.add('incorrect');
    
    // Add to review
    const exists = incorrectNotes.find(item => item.country === currentQ.country);
    if (!exists) {
      incorrectNotes.push(currentQ);
      localStorage.setItem('capitalQuizReview', JSON.stringify(incorrectNotes));
    }
  }
}

quizForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const userAnswer = quizInput.value;
  const currentQ = currentQuizQueue[currentQuestionIndex];
  
  const result = checkAnswerFuzzy(userAnswer, currentQ.capital, currentQ.aliases || []);
  
  quizFeedback.classList.remove('hidden');
  quizFeedback.className = 'feedback'; // reset
  
  if (result.isCorrect) {
    if (result.type === 'fuzzy') {
      quizFeedback.innerHTML = `정답입니다! 🎉<br><small>(입력: ${userAnswer} -> 인정됨. 정확한 수도는 <strong>${currentQ.capital}</strong>입니다)</small>`;
      quizFeedback.classList.add('fuzzy');
    } else {
      quizFeedback.innerText = "정답입니다! 🎉";
      quizFeedback.classList.add('correct');
    }
    
    // 진행도 저장
    if(!correctAnswersHard.includes(currentQ.country)) {
      correctAnswersHard.push(currentQ.country);
      localStorage.setItem('capitalQuizCorrectHard', JSON.stringify(correctAnswersHard));
      updateProgressUI();
    }
    
    // 다음 문제로 지연 이동
    setTimeout(() => {
      currentQuestionIndex++;
      loadNextQuestion();
    }, 1500);
    
  } else {
    quizFeedback.innerHTML = `틀렸습니다 😢<br>정답은 <strong>${currentQ.capital}</strong> 입니다.`;
    quizFeedback.classList.add('incorrect');
    
    // 오답노트에 추가
    addToReview(currentQ);
    
    // 다음 문제로 지연 이동
    setTimeout(() => {
      currentQuestionIndex++;
      loadNextQuestion();
    }, 2000);
  }
});

// Review Note Logic
function addToReview(q) {
  const exists = incorrectNotes.find(item => item.country === q.country);
  if (!exists) {
    incorrectNotes.push(q);
    saveReviewNotes();
  }
}

function removeReview(country) {
  incorrectNotes = incorrectNotes.filter(item => item.country !== country);
  saveReviewNotes();
  renderReviewList();
}

function saveReviewNotes() {
  localStorage.setItem('capitalQuizReview', JSON.stringify(incorrectNotes));
}

function renderReviewList() {
  if (incorrectNotes.length === 0) {
    reviewList.innerHTML = '';
    emptyReview.classList.remove('hidden');
    clearReviewBtn.classList.add('hidden');
  } else {
    emptyReview.classList.add('hidden');
    clearReviewBtn.classList.remove('hidden');
    
    reviewList.innerHTML = incorrectNotes.map(q => `
      <div class="review-item">
        <div class="review-info">
          <h3>${q.country}</h3>
          <p>정답: <span class="correct-ans">${q.capital}</span></p>
        </div>
        <button class="btn-remove-review" onclick="removeReview('${q.country}')">외웠어요!</button>
      </div>
    `).join('');
  }
}

clearReviewBtn.addEventListener('click', () => {
  if(confirm("오답노트를 모두 초기화하시겠습니까?")) {
    incorrectNotes = [];
    saveReviewNotes();
    renderReviewList();
  }
});

// Dictionary Logic
function renderDictionaryList() {
  const continents = {
    'asia': '아시아',
    'europe': '유럽',
    'africa': '아프리카',
    'north-america': '북아메리카',
    'south-america': '남아메리카',
    'oceania': '오세아니아'
  };
  
  let html = '';
  
  for (const [key, name] of Object.entries(continents)) {
    const data = quizData.filter(d => d.continent === key);
    if(data.length > 0) {
      html += `<div class="continent-header">${name} (${data.length}개국)</div>`;
      data.forEach(item => {
        html += `
          <div class="dict-item">
            <strong>${item.country}</strong>
            <span>수도: ${item.capital}</span>
          </div>
        `;
      });
    }
  }
  
  dictionaryList.innerHTML = html;
}

// Utility
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
