// ==================== Stats ====================

function setupStatsTabs() {
    document.querySelectorAll('.stats-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.stats-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`stats-${tab.dataset.stab}-tab`)?.classList.add('active');
            if (tab.dataset.stab === 'history') renderHistoryChart();
            if (tab.dataset.stab === 'activity') loadActivityLog();
            if (tab.dataset.stab === 'weekly') loadWeeklyReport();
        });
    });
    document.querySelectorAll('.metric-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.metric-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentHistoryMetric = btn.dataset.metric;
            statsHistoryData = null;
            renderHistoryChart();
        });
    });
}

async function loadStats() {
    statsHistoryData = null;
    if (historyChart) { historyChart.destroy(); historyChart = null; }
    const isParent = currentUser?.isParent || currentUser?.isAdmin;
    document.querySelectorAll('.stats-parent-only').forEach(el => {
        el.style.display = isParent ? '' : 'none';
    });
    document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.stats-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.stats-tab[data-stab="profile"]')?.classList.add('active');
    document.getElementById('stats-profile-tab')?.classList.add('active');
    await loadProfileStats();
}

async function loadProfileStats() {
    const u = currentUser;
    if (!u) return;
    if (u.isParent) {
        document.getElementById('accuracy-pct').textContent = '--';
        document.getElementById('accuracy-detail-text').textContent = 'צפה בדוח השבועי לסטטיסטיקות ילדים';
        ['stat-q-total','stat-q-correct','stat-coins-earned','stat-tasks-done','stat-streak-val','stat-level-val'].forEach(id => {
            const el = document.getElementById(id); if (el) el.textContent = '--';
        });
        return;
    }
    const total = u.questionsAnswered || 0;
    const correct = u.correctAnswers || 0;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const C = 314.16;
    const circle = document.getElementById('accuracy-circle');
    if (circle) {
        circle.style.strokeDasharray = C;
        circle.style.strokeDashoffset = C;
        requestAnimationFrame(() => setTimeout(() => {
            circle.style.strokeDashoffset = C * (1 - accuracy / 100);
        }, 80));
    }
    document.getElementById('accuracy-pct').textContent = `${accuracy}%`;
    document.getElementById('accuracy-detail-text').textContent = `${correct} נכון מתוך ${total}`;
    document.getElementById('stat-q-total').textContent = total;
    document.getElementById('stat-q-correct').textContent = correct;
    document.getElementById('stat-coins-earned').textContent = u.totalCoinsEarned || 0;
    document.getElementById('stat-tasks-done').textContent = u.tasksCompletedCount || 0;
    document.getElementById('stat-streak-val').textContent = u.streak || 0;
    document.getElementById('stat-level-val').textContent = u.level || 1;
    const ws = u.weeklyStats || {};
    document.getElementById('week-q').textContent = ws.questionsAnswered || 0;
    document.getElementById('week-c').textContent = ws.coinsEarned || 0;
    const achieved = u.unlockedAchievements || [];
    document.getElementById('achieve-count').textContent = achieved.length;
    const grid = document.getElementById('stats-achieve-grid');
    if (grid) {
        if (!achievementsDefs) achievementsDefs = await window.api.gamification.getAchievementsDefs();
        const earned = (achievementsDefs || []).filter(a => achieved.includes(a.id));
        grid.innerHTML = earned.length
            ? earned.map(a => `<div class="achieve-badge" title="${a.description || ''}"><span class="achieve-icon">${a.icon}</span><span class="achieve-name">${a.name}</span></div>`).join('')
            : '<p class="no-data">עדיין אין הישגים — דף לענות שאלות! 💪</p>';
    }
}

async function renderHistoryChart() {
    const username = currentUser?.username;
    if (!username || currentUser?.isParent) return;
    if (!statsHistoryData) {
        statsHistoryData = await window.api.stats.getDailyHistory(username, 7);
    }
    const labels = statsHistoryData.map(d => d.label);
    const values = statsHistoryData.map(d => d[currentHistoryMetric] || 0);
    const COLORS = {
        questions: { border: '#6c5ce7', bg: 'rgba(108,92,231,0.2)' },
        correct:   { border: '#00b894', bg: 'rgba(0,184,148,0.2)' },
        coins:     { border: '#ffd700', bg: 'rgba(255,215,0,0.2)' }
    };
    const col = COLORS[currentHistoryMetric];
    const ctx = document.getElementById('history-chart')?.getContext('2d');
    if (!ctx) return;
    if (historyChart) {
        historyChart.data.labels = labels;
        historyChart.data.datasets[0].data = values;
        historyChart.data.datasets[0].borderColor = col.border;
        historyChart.data.datasets[0].backgroundColor = col.bg;
        historyChart.data.datasets[0].pointBackgroundColor = col.border;
        historyChart.update('active');
        return;
    }
    historyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: values,
                borderColor: col.border,
                backgroundColor: col.bg,
                borderWidth: 3,
                pointBackgroundColor: col.border,
                pointRadius: 6,
                pointHoverRadius: 8,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 800 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a2e',
                    borderColor: col.border,
                    borderWidth: 1,
                    titleColor: '#eee',
                    bodyColor: '#aaa',
                    padding: 12
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#aaa' } },
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#aaa', precision: 0 } }
            }
        }
    });
}

async function loadActivityLog() {
    if (!currentUser?.isParent && !currentUser?.isAdmin) return;
    const users = await window.api.users.getAll();
    const select = document.getElementById('activity-filter');
    if (select && select.children.length === 1) {
        Object.values(users).filter(u => !u.isParent).forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.username;
            opt.textContent = u.displayName || u.username;
            select.appendChild(opt);
        });
        select.onchange = () => renderActivityLog(select.value || undefined);
    }
    await renderActivityLog();
}

async function renderActivityLog(username) {
    const log = await window.api.stats.getActivityLog({ limit: 200, username });
    const list = document.getElementById('activity-list');
    if (!list) return;
    if (!log.length) {
        list.innerHTML = '<p class="no-data">אין פעילות עדיין — הפעולות יירשמו מכאן והלאה</p>';
        return;
    }
    list.innerHTML = log.map(entry => {
        const t = new Date(entry.timestamp);
        const timeStr = t.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        const dateStr = t.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
        return `<div class="log-entry log-${entry.type}">
            <span class="log-icon">${entry.icon}</span>
            <div class="log-body">
                <strong>${entry.displayName}</strong>
                <span>${entry.message}</span>
            </div>
            <span class="log-time">${dateStr} ${timeStr}</span>
        </div>`;
    }).join('');
}

async function loadWeeklyReport() {
    if (!currentUser?.isParent && !currentUser?.isAdmin) return;
    const report = await window.api.stats.getWeeklyReport();
    const container = document.getElementById('weekly-cards');
    const periodEl = document.getElementById('weekly-period-text');
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    if (periodEl) periodEl.textContent = `מ-${weekStart.toLocaleDateString('he-IL')} עד ${now.toLocaleDateString('he-IL')}`;
    if (!container) return;
    if (!report.length) {
        container.innerHTML = '<p class="no-data">אין ילדים רשומים</p>';
        return;
    }
    container.innerHTML = report.map(r => {
        const ac = r.accuracy >= 80 ? '#00b894' : r.accuracy >= 50 ? '#fdcb6e' : '#ff6b6b';
        return `<div class="weekly-card">
            <div class="weekly-card-top">
                <span class="weekly-avatar">${(r.displayName || '?').charAt(0)}</span>
                <div>
                    <div class="weekly-name">${r.displayName}</div>
                    <div class="weekly-meta">רמה ${r.level} · ${r.streak} 🔥</div>
                </div>
            </div>
            <div class="weekly-kpis">
                <div class="weekly-kpi"><span class="wkpi-val">${r.weekQuestions}</span><span>שאלות השבוע</span></div>
                <div class="weekly-kpi"><span class="wkpi-val">${r.weekCoins}</span><span>מטבעות השבוע</span></div>
                <div class="weekly-kpi"><span class="wkpi-val" style="color:${ac}">${r.accuracy}%</span><span>דיוק כולל</span></div>
                <div class="weekly-kpi"><span class="wkpi-val">${r.tasksCompleted}</span><span>משימות</span></div>
            </div>
            <div class="weekly-acc-bar-wrap"><div class="weekly-acc-bar" style="width:${r.accuracy}%;background:${ac}"></div></div>
        </div>`;
    }).join('');
}
