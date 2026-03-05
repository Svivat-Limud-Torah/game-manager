// ==================== Global Search ====================

const FEATURE_CATALOG = [
    // ---- Main sections ----
    {
        id: 'nav-dashboard', title: 'דף הבית', icon: '🏠',
        desc: 'סקירה מהירה של המצב שלך — מטבעות, זמן, רצף ודרגה',
        tags: ['בית', 'ראשי', 'סקירה', 'מצב', 'coins', 'דף'],
        category: 'ניווט', adminOnly: false,
        action: () => navigateTo('dashboard')
    },
    {
        id: 'nav-tasks', title: 'משימות', icon: '📋',
        desc: 'רשימת המשימות שלך שממתינות לביצוע',
        tags: ['משימות', 'רשימה', 'לעשות', 'task', 'ביצוע'],
        category: 'ניווט', adminOnly: false,
        action: () => navigateTo('tasks')
    },
    {
        id: 'nav-questions', title: 'שאלות הלכתיות', icon: '📖',
        desc: 'ענה על שאלות וקבל מטבעות ו-XP',
        tags: ['שאלות', 'לימוד', 'הלכה', 'ענה', 'quiz', 'חידון'],
        category: 'ניווט', adminOnly: false,
        action: () => navigateTo('questions')
    },
    {
        id: 'nav-shop', title: 'חנות', icon: '🛒',
        desc: 'קנה זמן מחשב, פריטים לעולם ומשחקים',
        tags: ['חנות', 'קנה', 'shop', 'זמן', 'קניות', 'פריטים'],
        category: 'ניווט', adminOnly: false,
        action: () => navigateTo('shop')
    },
    {
        id: 'nav-games', title: 'המשחקים שלי', icon: '🎮',
        desc: 'כל המשחקים שרכשת ואפשר לשחק',
        tags: ['משחקים', 'שחק', 'game', 'play'],
        category: 'ניווט', adminOnly: false,
        action: () => navigateTo('games')
    },
    {
        id: 'nav-leaderboard', title: 'לוח מובילים', icon: '🏆',
        desc: 'דירוג כל המשתמשים לפי XP, מטבעות ועוד',
        tags: ['מובילים', 'דירוג', 'leaderboard', 'תחרות', 'ראשון'],
        category: 'ניווט', adminOnly: false,
        action: () => navigateTo('leaderboard')
    },
    {
        id: 'nav-stats', title: 'סטטיסטיקות', icon: '📊',
        desc: 'גרפים והתקדמות שבועית שלך',
        tags: ['סטטיסטיקות', 'גרפים', 'התקדמות', 'stats', 'analysis'],
        category: 'ניווט', adminOnly: false,
        action: () => navigateTo('stats')
    },
    {
        id: 'nav-customize', title: 'התאמה אישית', icon: '🎨',
        desc: 'שנה אווטאר, ערכת נושא וצלילים',
        tags: ['עיצוב', 'אווטאר', 'theme', 'ערכה', 'צבעים', 'התאמה'],
        category: 'ניווט', adminOnly: false,
        action: () => navigateTo('customize')
    },
    {
        id: 'nav-help', title: 'עזרה', icon: '❓',
        desc: 'הדרכה מלאה על כל פיצ׳רי האפליקציה',
        tags: ['עזרה', 'הדרכה', 'help', 'מדריך', 'איך'],
        category: 'ניווט', adminOnly: false,
        action: () => navigateTo('help')
    },

    // ---- Questions sub-features ----
    {
        id: 'feat-review', title: 'מצב חזרה על שאלות', icon: '🔄',
        desc: 'חזור על שאלות שכבר ענית — מקבלים מטבעות נוספים',
        tags: ['חזרה', 'review', 'שוב', 'מטבעות נוספים'],
        category: 'שאלות', adminOnly: false,
        action: () => { navigateTo('questions'); setTimeout(() => document.getElementById('toggle-review-mode')?.click(), 200); }
    },
    {
        id: 'feat-zen', title: 'מצב ZEN', icon: '🧘',
        desc: 'שאלות ברצף ללא הסחות דעת — ריכוז מלא',
        tags: ['zen', 'ריכוז', 'שקט', 'מצב', 'ללא הסחה'],
        category: 'שאלות', adminOnly: false,
        action: () => { navigateTo('questions'); setTimeout(() => document.getElementById('zen-mode-btn')?.click(), 200); }
    },

    // ---- Shop sub-features ----
    {
        id: 'feat-buy-time', title: 'קנה זמן מחשב', icon: '⏱️',
        desc: 'השתמש במטבעות כדי לקנות דקות מחשב נוספות',
        tags: ['זמן', 'קנה', 'דקות', 'מחשב', 'time', 'שחרר'],
        category: 'חנות', adminOnly: false,
        action: () => { navigateTo('shop'); setTimeout(() => document.querySelector('.tab-btn[data-tab="time"]')?.click(), 200); }
    },
    {
        id: 'feat-buy-items', title: 'פריטים לעולם', icon: '🏰',
        desc: 'קנה בניינים, עצים, גדרות ועוד לעולם שלך',
        tags: ['פריטים', 'עולם', 'בניינים', 'עצים', 'items', 'world'],
        category: 'חנות', adminOnly: false,
        action: () => { navigateTo('shop'); setTimeout(() => document.querySelector('.tab-btn[data-tab="items"]')?.click(), 200); }
    },
    {
        id: 'feat-buy-games', title: 'קנה משחקים', icon: '🕹️',
        desc: 'רכוש משחקים ממאגר המשחקים בחנות',
        tags: ['משחקים', 'קנה', 'game', 'חנות'],
        category: 'חנות', adminOnly: false,
        action: () => { navigateTo('shop'); setTimeout(() => document.querySelector('.tab-btn[data-tab="games"]')?.click(), 200); }
    },

    // ---- Customize sub-features ----
    {
        id: 'feat-avatars', title: 'אווטארים', icon: '🐺',
        desc: 'בחר דמות שתייצג אותך — חינם, נדיר, אפי ואגדי',
        tags: ['אווטאר', 'דמות', 'avatar', 'זאב', 'חתול', 'דרקון'],
        category: 'התאמה אישית', adminOnly: false,
        action: () => { navigateTo('customize'); setTimeout(() => document.querySelector('[data-cust-tab="avatars"]')?.click(), 200); }
    },
    {
        id: 'feat-themes', title: 'ערכות נושא', icon: '🎨',
        desc: 'שנה את עיצוב האפליקציה — חושך, חלל, אש, ורוד ועוד',
        tags: ['ערכה', 'נושא', 'עיצוב', 'theme', 'צבע', 'חלל', 'אש', 'ורוד'],
        category: 'התאמה אישית', adminOnly: false,
        action: () => { navigateTo('customize'); setTimeout(() => document.querySelector('[data-cust-tab="themes"]')?.click(), 200); }
    },
    {
        id: 'feat-prefs', title: 'העדפות סאונד ואנימציות', icon: '🔊',
        desc: 'כבה/הדלק צלילים, אנימציות ועוצמת קול',
        tags: ['סאונד', 'צליל', 'אנימציה', 'sound', 'volume', 'עוצמה'],
        category: 'התאמה אישית', adminOnly: false,
        action: () => { navigateTo('customize'); setTimeout(() => document.querySelector('[data-cust-tab="preferences"]')?.click(), 200); }
    },

    // ---- Admin features ----
    {
        id: 'admin-overview', title: 'סקירת ילדים (הורה)', icon: '👨‍👧‍👦',
        desc: 'ראה את כל הילדים, המטבעות, הדרגות והמצב שלהם',
        tags: ['ילדים', 'הורה', 'סקירה', 'overview', 'admin'],
        category: 'לוח הורה', adminOnly: true,
        action: () => _adminTab('overview')
    },
    {
        id: 'admin-tasks', title: 'הוסף / נהל משימות', icon: '📋',
        desc: 'צור משימות חדשות לילדים ואשר ביצועים',
        tags: ['הוסף משימה', 'נהל', 'אשר', 'task', 'משימות הורה'],
        category: 'לוח הורה', adminOnly: true,
        action: () => _adminTab('tasks-manage')
    },
    {
        id: 'admin-questions', title: 'שאלות מותאמות', icon: '❓',
        desc: 'הוסף שאלות משלך לבסיס השאלות',
        tags: ['שאלות', 'הוסף שאלה', 'מותאם', 'custom questions'],
        category: 'לוח הורה', adminOnly: true,
        action: () => _adminTab('questions-manage')
    },
    {
        id: 'admin-messages', title: 'שלח הודעה לילד', icon: '📢',
        desc: 'שלח הודעות שיוצגו בדף הבית של הילד',
        tags: ['הודעה', 'שלח', 'message', 'תקשורת'],
        category: 'לוח הורה', adminOnly: true,
        action: () => _adminTab('messages-manage')
    },
    {
        id: 'admin-games', title: 'ניהול משחקים', icon: '🎮',
        desc: 'הוסף/הסר משחקים זמינים לרכישה',
        tags: ['משחקים', 'הורה', 'ניהול', 'games admin'],
        category: 'לוח הורה', adminOnly: true,
        action: () => _adminTab('games-manage')
    },
    {
        id: 'admin-rewards', title: 'אתגרים ופרסים', icon: '🎯',
        desc: 'צור אתגרים מותאמים אישית עם פרסי מטבעות',
        tags: ['אתגר', 'פרס', 'reward', 'challenge', 'קסטום'],
        category: 'לוח הורה', adminOnly: true,
        action: () => _adminTab('rewards-manage')
    },
    {
        id: 'admin-settings', title: 'הגדרות מערכת', icon: '⚙️',
        desc: 'זמן חינם, מחיר דקה, מטבעות לשאלה, PIN',
        tags: ['הגדרות', 'settings', 'זמן', 'מחיר', 'PIN', 'pin'],
        category: 'לוח הורה', adminOnly: true,
        action: () => _adminTab('settings-manage')
    },
    {
        id: 'admin-difficulty', title: 'רמת קושי', icon: '🎮',
        desc: 'בחר קל / בינוני / קשה כדי לכוון את הכלכלה',
        tags: ['קושי', 'קל', 'קשה', 'בינוני', 'difficulty', 'רמה'],
        category: 'לוח הורה', adminOnly: true,
        action: () => _adminTab('settings-manage')
    },
    {
        id: 'admin-sync', title: 'סנכרון בין מכשירים', icon: '🔄',
        desc: 'חבר מכשירים נוספים דרך Firebase',
        tags: ['סנכרון', 'sync', 'firebase', 'מכשיר', 'ענן'],
        category: 'לוח הורה', adminOnly: true,
        action: () => _adminTab('sync-manage')
    },
    {
        id: 'admin-set-time', title: 'הגדר זמן לילד', icon: '⏱️',
        desc: 'שנה ידנית את כמות הזמן של ילד מסוים',
        tags: ['זמן', 'הגדר', 'time', 'ילד', 'דקות'],
        category: 'לוח הורה', adminOnly: true,
        action: () => _adminTab('overview')
    },
    {
        id: 'admin-add-coins', title: 'הוסף מטבעות לילד', icon: '💰',
        desc: 'הוסף מטבעות ידנית לחשבון ילד',
        tags: ['מטבעות', 'הוסף', 'coins', 'ילד', 'bonus'],
        category: 'לוח הורה', adminOnly: true,
        action: () => _adminTab('overview')
    },
];

// Navigate to admin + click a specific tab
function _adminTab(tabId) {
    navigateTo('admin');
    setTimeout(() => {
        const btn = document.querySelector(`[data-admin-tab="${tabId}"]`);
        if (btn) btn.click();
    }, 150);
}

// ---- Search state ----
let _searchQuery = '';

function loadSearch() {
    const input = document.getElementById('global-search-input');
    if (input) {
        input.value = '';
        _searchQuery = '';
    }
    _renderSearchResults('');
}

function onSearchInput(value) {
    _searchQuery = value;
    _renderSearchResults(value);
}

function _renderSearchResults(query) {
    const container = document.getElementById('search-results-container');
    if (!container) return;

    const isAdmin = currentUser?.isAdmin || currentUser?.isParent;
    const q = query.trim().toLowerCase();

    // Filter catalog
    const visible = FEATURE_CATALOG.filter(f => {
        if (f.adminOnly && !isAdmin) return false;
        if (!q) return true;
        return (
            f.title.toLowerCase().includes(q) ||
            f.desc.toLowerCase().includes(q) ||
            f.tags.some(t => t.toLowerCase().includes(q)) ||
            f.category.toLowerCase().includes(q)
        );
    });

    if (visible.length === 0) {
        container.innerHTML = `
            <div class="search-empty">
                <span class="search-empty-icon">🔍</span>
                <p>לא נמצאו תוצאות עבור "<strong>${escapeHtml(query)}</strong>"</p>
                <p class="search-empty-hint">נסה מילה אחרת או עיין ב<button class="link-btn" onclick="navigateTo('help')">עמוד העזרה</button></p>
            </div>`;
        return;
    }

    // Group by category
    const groups = {};
    visible.forEach(f => {
        if (!groups[f.category]) groups[f.category] = [];
        groups[f.category].push(f);
    });

    const ORDER = ['ניווט', 'שאלות', 'חנות', 'התאמה אישית', 'לוח הורה'];
    const sortedGroups = Object.keys(groups).sort((a, b) => {
        const ai = ORDER.indexOf(a), bi = ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });

    let html = '';
    for (const cat of sortedGroups) {
        html += `<div class="search-group">
            <div class="search-group-title">${cat}</div>
            <div class="search-group-items">`;
        for (const f of groups[cat]) {
            // Highlight matching text
            const title = q ? _highlight(f.title, q) : f.title;
            const desc  = q ? _highlight(f.desc, q)  : f.desc;
            html += `
                <button class="search-result-card" onclick="_searchLaunch('${f.id}')">
                    <span class="src-icon">${f.icon}</span>
                    <div class="src-text">
                        <span class="src-title">${title}</span>
                        <span class="src-desc">${desc}</span>
                    </div>
                    <span class="src-arrow">←</span>
                </button>`;
        }
        html += `</div></div>`;
    }

    container.innerHTML = html;
}

function _highlight(text, q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'),
        '<mark class="search-hl">$1</mark>');
}

function _searchLaunch(id) {
    const feature = FEATURE_CATALOG.find(f => f.id === id);
    if (!feature) return;
    playSound('click');
    feature.action();
    // Flash feedback
    const card = document.querySelector(`[onclick="_searchLaunch('${id}')"]`);
    if (card) {
        card.classList.add('search-card-fired');
        setTimeout(() => card?.classList.remove('search-card-fired'), 600);
    }
}

function clearSearch() {
    const input = document.getElementById('global-search-input');
    if (input) { input.value = ''; input.focus(); }
    _renderSearchResults('');
}
