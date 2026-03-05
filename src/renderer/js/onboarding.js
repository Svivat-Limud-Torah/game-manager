// ==================== First-Run Onboarding (Informational Guide) ====================

const ONBOARDING_STEPS = [
    {
        id: 'welcome',
        icon: '👋',
        title: 'ברוכים הבאים ל-ZmanKef! 🎉',
        body: () => `
            <p class="ob-lead">מערכת חכמה שהופכת את זמן המסך של הילדים ל<strong>הזדמנות ללמידה</strong>.</p>
            <div class="ob-highlight-box">
                <p>במקום להילחם על כיבוי המחשב — <strong>הילדים ירוויחו את הזמן</strong> בעצמם על ידי מענה על שאלות, ביצוע משימות ולמידה.</p>
            </div>
            <div class="ob-how-grid">
                <div class="ob-how-card">
                    <span class="ob-how-icon">📖</span>
                    <span>הילד עונה על <strong>שאלות</strong> ומרוויח מטבעות</span>
                </div>
                <div class="ob-how-card">
                    <span class="ob-how-icon">💰</span>
                    <span>עם המטבעות הוא <strong>קונה זמן מחשב</strong></span>
                </div>
                <div class="ob-how-card">
                    <span class="ob-how-icon">🎮</span>
                    <span>רק משחקים ש<strong>אתם אישרתם</strong> זמינים</span>
                </div>
                <div class="ob-how-card">
                    <span class="ob-how-icon">📊</span>
                    <span><strong>אתם שולטים</strong> בהכל מלוח ההורה</span>
                </div>
            </div>
            <p class="ob-muted">בואו נסביר איך להתחיל — ייקח כדקה.</p>
        `
    },
    {
        id: 'add-children',
        icon: '➕',
        title: 'הוספת ילדים 👦👧',
        body: () => `
            <p class="ob-lead">הצעד הראשון — צרו חשבונות לילדים שלכם:</p>
            <div class="ob-steps-mini">
                <div class="ob-step-mini">
                    <span class="ob-step-num">1</span>
                    <span>לחצו על <strong>"👨‍👧‍👦 לוח הורה"</strong> בתפריט הצד</span>
                </div>
                <div class="ob-step-mini">
                    <span class="ob-step-num">2</span>
                    <span>בכרטיסיית <strong>"📊 סקירה"</strong> — לחצו על הכפתור <strong>"✚ הוסף ילד"</strong></span>
                </div>
                <div class="ob-step-mini">
                    <span class="ob-step-num">3</span>
                    <span>הכניסו <strong>שם</strong>, <strong>שם משתמש</strong> ו<strong>סיסמה</strong> לכל ילד ולחצו "צור חשבון"</span>
                </div>
            </div>
            <div class="ob-tip-box">
                <span class="ob-tip-icon">💡</span>
                <span>כל ילד מקבל חשבון נפרד עם הזמן, המטבעות וההיסטוריה שלו. ניתן להוסיף ילדים בכל עת.</span>
            </div>
        `
    },
    {
        id: 'how-it-works',
        icon: '🔄',
        title: 'איך זה עובד ביום-יום 📅',
        body: () => `
            <p class="ob-lead">כך נראה יום רגיל של ילד עם ZmanKef:</p>
            <div class="ob-steps-flow">
                <div class="ob-flow-item">
                    <div class="ob-flow-num">1</div>
                    <div class="ob-flow-text">הילד <strong>מתחבר</strong> ומקבל זמן חינם (לפי הגדרות הקושי שתקבעו)</div>
                </div>
                <div class="ob-flow-arrow">↓</div>
                <div class="ob-flow-item">
                    <div class="ob-flow-num">2</div>
                    <div class="ob-flow-text"><strong>הטיימר רץ</strong> — הילד רואה כמה זמן נשאר לו</div>
                </div>
                <div class="ob-flow-arrow">↓</div>
                <div class="ob-flow-item">
                    <div class="ob-flow-num">3</div>
                    <div class="ob-flow-text">כשהזמן נגמר — <strong>המחשב ננעל</strong>. הילד יכול רק ללמוד</div>
                </div>
                <div class="ob-flow-arrow">↓</div>
                <div class="ob-flow-item">
                    <div class="ob-flow-num">4</div>
                    <div class="ob-flow-text">הילד <strong>עונה על שאלות</strong> → צובר מטבעות → <strong>קונה דקות נוספות</strong></div>
                </div>
            </div>
        `
    },
    {
        id: 'parent-dashboard',
        icon: '📋',
        title: 'מה תמצאו בלוח ההורה 🎛️',
        body: () => `
            <p class="ob-lead">לחצו על <strong>"👨‍👧‍👦 לוח הורה"</strong> בתפריט הצד. שם תמצאו:</p>
            <div class="ob-feature-list">
                <div class="ob-feature-row">
                    <span class="ob-feat-icon">👦</span>
                    <div><strong>הוספת ילדים</strong> — יצירת חשבונות חדשים</div>
                </div>
                <div class="ob-feature-row">
                    <span class="ob-feat-icon">📋</span>
                    <div><strong>משימות</strong> — תנו משימות בית עם פרס מטבעות (למשל: "סדר את החדר" = 50 מטבעות)</div>
                </div>
                <div class="ob-feature-row">
                    <span class="ob-feat-icon">📖</span>
                    <div><strong>שאלות</strong> — הוסיפו שאלות משלכם או השתמשו בבנק השאלות המובנה</div>
                </div>
                <div class="ob-feature-row">
                    <span class="ob-feat-icon">🎮</span>
                    <div><strong>משחקים</strong> — הגדירו אילו משחקים מותרים ובאיזה מחיר במטבעות</div>
                </div>
                <div class="ob-feature-row">
                    <span class="ob-feat-icon">⚙️</span>
                    <div><strong>הגדרות</strong> — רמת קושי, קוד PIN, שעות פעילות ועוד</div>
                </div>
            </div>
        `
    },
    {
        id: 'sync',
        icon: '🔄',
        title: 'גיבוי ענן — מחשב שני 💻',
        body: () => `
            <p class="ob-lead">רוצים שהכל יהיה שמור גם אם תפתחו מחשב אחר? הנה איך:</p>
            <div class="ob-steps-mini">
                <div class="ob-step-mini">
                    <span class="ob-step-num">1</span>
                    <span>במחשב הראשי: לכו ל<strong>"לוח הורה" → "🔄 סנכרון"</strong> → לחצו <strong>"צור משפחה"</strong></span>
                </div>
                <div class="ob-step-mini">
                    <span class="ob-step-num">2</span>
                    <span>תקבלו <strong>קוד משפחה</strong> — שמרו אותו (או העתיקו אותו)</span>
                </div>
                <div class="ob-step-mini">
                    <span class="ob-step-num">3</span>
                    <span>במחשב השני: התקינו את האפליקציה → כניסה כמנהל → <strong>"סנכרון" → "הזן קוד משפחה"</strong> → כל הנתונים יורדו אוטומטית</span>
                </div>
            </div>
            <div class="ob-tip-box">
                <span class="ob-tip-icon">⚡</span>
                <span>לאחר החיבור הראשוני — הנתונים מסתנכרנים <strong>בזמן אמת</strong> בין כל המכשירים, גם בלי לעשות כלום.</span>
            </div>
        `
    },
    {
        id: 'finish',
        icon: '🚀',
        title: '🎉 הכל מוכן — בהצלחה!',
        body: () => `
            <p class="ob-lead">הנה רשימת ההתחלה המהירה שלכם:</p>
            <div class="ob-steps-mini">
                <div class="ob-step-mini">
                    <span class="ob-step-num">✓</span>
                    <span>לחצו <strong>"לוח הורה" → "✚ הוסף ילד"</strong> וצרו חשבון לכל ילד</span>
                </div>
                <div class="ob-step-mini">
                    <span class="ob-step-num">✓</span>
                    <span>הגדירו רמת קושי מ<strong>לוח הורה → הגדרות</strong></span>
                </div>
                <div class="ob-step-mini">
                    <span class="ob-step-num">✓</span>
                    <span>הוסיפו משחקים מ<strong>לוח הורה → משחקים</strong></span>
                </div>
                <div class="ob-step-mini">
                    <span class="ob-step-num">✓</span>
                    <span>תנו לילדים להתחבר ולהתחיל! 🎮</span>
                </div>
            </div>
            <div class="ob-tip-box" style="margin-top: 16px;">
                <span class="ob-tip-icon">❓</span>
                <span>תמיד תוכלו לפתוח מדריך זה שוב דרך <strong>"❓ עזרה"</strong> בתפריט הצד.</span>
            </div>
        `
    }
];

// ── State ──
let _obStep = 0;
let _obOverlay = null;
let _obPill = null;

// ── Public API ──
function showOnboarding() {
    _obStep = 0;
    _buildOverlay();
    _renderStep();
}

// ── Minimize / Restore ──
function _minimizeOnboarding() {
    if (!_obOverlay) return;
    _obOverlay.classList.add('ob-minimized');

    if (!_obPill) {
        const step = ONBOARDING_STEPS[_obStep];
        const pill = document.createElement('button');
        pill.className = 'ob-pill';
        pill.innerHTML = `
            <span class="ob-pill-icon">${step.icon}</span>
            <span class="ob-pill-text">
                <span class="ob-pill-label">מדריך פתיחה</span>
                <span class="ob-pill-step">${_obStep + 1} / ${ONBOARDING_STEPS.length}</span>
            </span>
            <span class="ob-pill-arrow">▲</span>
        `;
        pill.onclick = _restoreOnboarding;
        document.body.appendChild(pill);
        _obPill = pill;
        requestAnimationFrame(() => pill.classList.add('ob-pill-visible'));
    }
}

function _restoreOnboarding() {
    if (_obPill) {
        _obPill.classList.remove('ob-pill-visible');
        setTimeout(() => { _obPill?.remove(); _obPill = null; }, 250);
    }
    if (_obOverlay) _obOverlay.classList.remove('ob-minimized');
}

function _closeOnboarding() {
    if (_obPill) { _obPill.remove(); _obPill = null; }
    if (_obOverlay) {
        _obOverlay.classList.add('ob-closing');
        setTimeout(() => { _obOverlay.remove(); _obOverlay = null; }, 300);
    }
    window.api.settings.set({ onboardingCompleted: true });
}

// ── Internal ──
function _buildOverlay() {
    document.querySelector('.ob-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'ob-overlay';
    overlay.innerHTML = `
        <div class="ob-container">
            <div class="ob-header">
                <div class="ob-progress-wrap">
                    <div class="ob-progress-bar">
                        <div class="ob-progress-fill" id="ob-progress-fill"></div>
                    </div>
                    <span class="ob-progress-text" id="ob-progress-text"></span>
                </div>
                <div class="ob-header-actions">
                    <button class="ob-minimize-btn" onclick="_minimizeOnboarding()" title="מזער — המשך לאחר מכן">⎯</button>
                    <button class="ob-close-btn" onclick="_closeOnboarding()" title="סגור">✕</button>
                </div>
            </div>
            <div class="ob-body" id="ob-body"></div>
            <div class="ob-footer">
                <div class="ob-nav-btns">
                    <button class="ob-btn ob-btn-prev" id="ob-prev-btn" onclick="_obPrev()">→ הקודם</button>
                    <button class="ob-btn ob-btn-next" id="ob-next-btn" onclick="_obNext()">הבא ←</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    _obOverlay = overlay;
    requestAnimationFrame(() => overlay.classList.add('ob-visible'));
}

function _renderStep() {
    const step = ONBOARDING_STEPS[_obStep];
    const total = ONBOARDING_STEPS.length;

    document.getElementById('ob-progress-fill').style.width = ((_obStep + 1) / total * 100).toFixed(0) + '%';
    document.getElementById('ob-progress-text').textContent = `${_obStep + 1} / ${total}`;

    if (_obPill) {
        _obPill.querySelector('.ob-pill-icon').textContent = step.icon;
        _obPill.querySelector('.ob-pill-step').textContent = `${_obStep + 1} / ${total}`;
    }

    const body = document.getElementById('ob-body');
    body.classList.add('ob-fade-out');
    setTimeout(() => {
        body.innerHTML = `
            <div class="ob-step-header">
                <span class="ob-step-icon">${step.icon}</span>
                <h2 class="ob-step-title">${step.title}</h2>
            </div>
            <div class="ob-step-content">${step.body()}</div>
        `;
        body.classList.remove('ob-fade-out');
        body.scrollTop = 0;
    }, 200);

    const prevBtn = document.getElementById('ob-prev-btn');
    const nextBtn = document.getElementById('ob-next-btn');

    prevBtn.classList.toggle('ob-btn-hidden', _obStep === 0);

    if (_obStep === total - 1) {
        nextBtn.textContent = '✅ הבנתי, בואו נתחיל!';
        nextBtn.classList.add('ob-btn-finish');
    } else {
        nextBtn.textContent = 'הבא ←';
        nextBtn.classList.remove('ob-btn-finish');
    }
}

function _obNext() {
    if (_obStep < ONBOARDING_STEPS.length - 1) {
        _obStep++;
        _renderStep();
    } else {
        _closeOnboarding();
    }
}

function _obPrev() {
    if (_obStep > 0) {
        _obStep--;
        _renderStep();
    }
}
