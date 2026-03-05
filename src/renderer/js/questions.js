// ==================== Questions ====================

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function toggleZenMode() {
    const isZen = document.body.classList.toggle('zen-mode');
    const exitBtn = document.getElementById('zen-exit-btn');
    if (exitBtn) exitBtn.classList.toggle('hidden', !isZen);
}

function updateQuestionProgress() {
    const fill = document.getElementById('question-progress-fill');
    if (fill && questionsData.length > 0) {
        fill.style.width = ((currentQuestionIndex + 1) / questionsData.length * 100) + '%';
    }
}

function setupQuestionModes() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            isReviewMode = btn.dataset.mode === 'review';
            loadQuestions();
        });
    });
}

async function loadQuestions() {
    const raw = await window.api.questions.getAll();
    questionsData = shuffleArray(raw);
    currentQuestionIndex = 0;

    if (questionsData.length === 0) {
        document.getElementById('question-text').textContent = 'אין שאלות זמינות';
        return;
    }

    showQuestion(currentQuestionIndex);
}

function advanceQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex >= questionsData.length) {
        questionsData = shuffleArray(questionsData);
        currentQuestionIndex = 0;
    }
    showQuestion(currentQuestionIndex);
}

function showQuestion(index) {
    const q = questionsData[index];
    if (!q) return;

    document.getElementById('current-question-num').textContent = index + 1;
    document.getElementById('question-text').textContent = q.question;
    document.getElementById('question-explanation').classList.add('hidden');

    const badge = document.getElementById('question-review-badge');
    if (badge) badge.classList.add('hidden');

    updateQuestionProgress();

    const grid = document.getElementById('answers-grid');
    grid.innerHTML = q.options.map((opt, i) => `
        <button class="answer-btn" data-index="${i}" onclick="submitAnswer(${JSON.stringify(q.id)}, ${i})">
            ${escapeHtml(opt)}
        </button>
    `).join('');
}

async function submitAnswer(questionId, answerIndex) {
    const result = await window.api.questions.submitAnswer({
        questionId, answer: answerIndex, isReview: isReviewMode
    });
    if (!result.success) return;

    // Highlight answers
    const buttons = document.querySelectorAll('.answer-btn');
    buttons.forEach(btn => {
        btn.disabled = true;
        const idx = parseInt(btn.dataset.index);
        if (idx === result.correctAnswer) btn.classList.add('correct');
        if (idx === answerIndex && !result.isCorrect) btn.classList.add('wrong');
    });

    // Show explanation
    const q = questionsData.find(q => q.id === questionId);
    if (q?.explanation) {
        document.getElementById('explanation-content').textContent = q.explanation;
        document.getElementById('question-explanation').classList.remove('hidden');
    }

    // Show "no coins" badge for already-reviewed questions
    if (result.alreadyReviewedToday) {
        const badge = document.getElementById('question-review-badge');
        if (badge) badge.classList.remove('hidden');
    }

    // Update user state
    if (result.user) {
        currentUser = result.user;
        refreshUI();
    }

    if (result.isCorrect) {
        playSound('correct');
        if (result.alreadyReviewedToday) {
            showToast('תשובה נכונה! — שאלה זו כבר נחקרה היום 🔄', 'success');
        } else {
            const reward = isReviewMode ? 15 : 10;
            showToast(`תשובה נכונה! +${reward} 💰  +${result.xpGained || 0} XP`, 'success');
        }
        if (result.xpResult?.leveledUp) showLevelUp(result.xpResult.levelData);
        if (result.newAchievements?.length) {
            result.newAchievements.forEach((ach, i) => setTimeout(() => showAchievementToast(ach), (i + 1) * 1500));
        }
        if (result.newCustomAchievements?.length) {
            const offset = result.newAchievements?.length || 0;
            result.newCustomAchievements.forEach((ach, i) => setTimeout(() => showAchievementToast(ach, true), (offset + i + 1) * 1500));
        }
    } else {
        playSound('wrong');
        showToast('תשובה שגויה 😓', 'error');
        if (result.newAchievements?.length) {
            result.newAchievements.forEach((ach, i) => setTimeout(() => showAchievementToast(ach), (i + 1) * 1500));
        }
        if (result.newCustomAchievements?.length) {
            const offset = result.newAchievements?.length || 0;
            result.newCustomAchievements.forEach((ach, i) => setTimeout(() => showAchievementToast(ach, true), (offset + i + 1) * 1500));
        }
    }

    // Wait for Space or any Arrow key to advance to next question
    const advanceHandler = (e) => {
        if (e.code === 'Space' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
            e.preventDefault();
            document.removeEventListener('keydown', advanceHandler);
            advanceQuestion();
        }
    };
    document.addEventListener('keydown', advanceHandler);
}
