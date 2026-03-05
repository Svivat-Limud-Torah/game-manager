// ==================== Dashboard ====================

async function loadDashboard() {
    refreshUI();
    try {
        const priceInfo = await window.api.time.getPrice();
        document.getElementById('coins-per-minute').textContent = priceInfo.coinsPerMinute;
        document.querySelectorAll('.time-option').forEach(btn => {
            const mins = parseInt(btn.dataset.minutes);
            const cost = mins * priceInfo.coinsPerMinute;
            btn.querySelector('small').textContent = `${cost} 💰`;
        });
    } catch (e) { /* ignore */ }

    if (currentUser && !currentUser.isParent) {
        const tasks = await window.api.tasks.getForUser(currentUser.username);
        const pending = tasks.filter(t => t.status === 'pending').length;
        const badge = document.getElementById('tasks-badge');
        badge.textContent = pending;
        badge.classList.toggle('hidden', pending === 0);
    } else if (currentUser && currentUser.isParent) {
        const tasks = await window.api.tasks.getAll();
        const awaiting = tasks.filter(t => t.status === 'awaiting_approval').length;
        const badge = document.getElementById('tasks-badge');
        badge.textContent = awaiting;
        badge.classList.toggle('hidden', awaiting === 0);
    }
    loadDashboardCharts();
}

async function loadDashboardCharts() {
    const chartsRow = document.getElementById('dashboard-charts-row');
    if (!chartsRow) return;
    if (currentUser?.isParent) {
        chartsRow.classList.add('hidden');
        return;
    }
    chartsRow.classList.remove('hidden');
    const username = currentUser?.username;
    if (!username) return;

    const TOOLTIP_STYLE = {
        backgroundColor: '#1a1a2e',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: '#eee',
        bodyColor: '#aaa',
        padding: 10
    };

    // Weekly Bar Chart
    try {
        const histData = await window.api.stats.getDailyHistory(username, 7);
        const weekLabels = histData.map(d => d.label);
        const weekValues = histData.map(d => d.questions || 0);
        const ctxWeekly = document.getElementById('dash-weekly-chart')?.getContext('2d');
        if (ctxWeekly) {
            if (dashWeeklyChart) { dashWeeklyChart.destroy(); dashWeeklyChart = null; }
            dashWeeklyChart = new Chart(ctxWeekly, {
                type: 'bar',
                data: {
                    labels: weekLabels,
                    datasets: [{
                        data: weekValues,
                        backgroundColor: weekValues.map((_, i) =>
                            i === weekValues.length - 1
                                ? 'rgba(108,92,231,0.9)'
                                : 'rgba(108,92,231,0.35)'
                        ),
                        borderRadius: 6,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, animation: { duration: 700 },
                    plugins: {
                        legend: { display: false },
                        tooltip: { ...TOOLTIP_STYLE, callbacks: { label: ctx => `${ctx.raw} שאלות` } }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#888', font: { size: 11 } } },
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888', precision: 0 } }
                    }
                }
            });
        }
    } catch (e) { /* ignore */ }

    // Tasks Doughnut
    try {
        const tasks = await window.api.tasks.getForUser(username);
        const completedCount  = tasks.filter(t => t.status === 'completed').length;
        const pendingCount    = tasks.filter(t => t.status === 'pending').length;
        const awaitingCount   = tasks.filter(t => t.status === 'awaiting_approval').length;
        const rejectedCount   = tasks.filter(t => t.status === 'rejected').length;
        const totalTasks = completedCount + pendingCount + awaitingCount + rejectedCount;
        const ctxTasks = document.getElementById('dash-tasks-chart')?.getContext('2d');
        const tasksCenter = document.getElementById('dash-tasks-center');
        const tasksLegend = document.getElementById('dash-tasks-legend');
        if (ctxTasks) {
            if (dashTasksChart) { dashTasksChart.destroy(); dashTasksChart = null; }
            if (totalTasks === 0) {
                dashTasksChart = new Chart(ctxTasks, {
                    type: 'doughnut',
                    data: { datasets: [{ data: [1], backgroundColor: ['rgba(255,255,255,0.06)'], borderWidth: 0 }] },
                    options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { tooltip: { enabled: false }, legend: { display: false } } }
                });
                if (tasksCenter) tasksCenter.innerHTML = '<span class="dash-donut-num">0</span><span class="dash-donut-sub">משימות</span>';
                if (tasksLegend) tasksLegend.innerHTML = '';
            } else {
                const TASK_COLORS = ['#00b894', '#6c5ce7', '#ffd700', '#e17055'];
                const TASK_LABELS = ['הושלמו', 'ממתינות', 'לאישור', 'נדחו'];
                const TASK_DATA   = [completedCount, pendingCount, awaitingCount, rejectedCount];
                dashTasksChart = new Chart(ctxTasks, {
                    type: 'doughnut',
                    data: {
                        labels: TASK_LABELS,
                        datasets: [{ data: TASK_DATA, backgroundColor: TASK_COLORS, borderWidth: 0, hoverOffset: 4 }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false, cutout: '72%',
                        plugins: { legend: { display: false }, tooltip: { ...TOOLTIP_STYLE } }
                    }
                });
                if (tasksCenter) tasksCenter.innerHTML = `<span class="dash-donut-num">${completedCount}</span><span class="dash-donut-sub">/ ${totalTasks}</span>`;
                if (tasksLegend) {
                    tasksLegend.innerHTML = TASK_LABELS.map((lbl, i) =>
                        TASK_DATA[i] > 0
                            ? `<span class="dash-legend-dot" style="background:${TASK_COLORS[i]}"></span><span class="dash-legend-lbl">${lbl} (${TASK_DATA[i]})</span>`
                            : ''
                    ).join('');
                }
            }
        }
    } catch (e) { /* ignore */ }

    // Accuracy Doughnut
    try {
        const correct  = currentUser.correctAnswers || 0;
        const total    = currentUser.questionsAnswered || 0;
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
        const accColor = accuracy >= 80 ? '#00b894' : accuracy >= 60 ? '#ffd700' : '#e17055';
        const ctxAcc = document.getElementById('dash-accuracy-chart')?.getContext('2d');
        const accCenter = document.getElementById('dash-accuracy-center');
        if (ctxAcc) {
            if (dashAccuracyChart) { dashAccuracyChart.destroy(); dashAccuracyChart = null; }
            dashAccuracyChart = new Chart(ctxAcc, {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: total > 0 ? [accuracy, 100 - accuracy] : [0, 100],
                        backgroundColor: [
                            total > 0 ? accColor : 'rgba(255,255,255,0.06)',
                            'rgba(255,255,255,0.06)'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '72%',
                    plugins: { legend: { display: false }, tooltip: { enabled: false } }
                }
            });
            if (accCenter) accCenter.innerHTML = `<span class="dash-donut-num" style="color:${total > 0 ? accColor : '#555'}">${accuracy}%</span><span class="dash-donut-sub">מתוך ${total}</span>`;
        }
    } catch (e) { /* ignore */ }
}
