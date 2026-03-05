// ==================== Tasks ====================

function setupTaskActions() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadTasks(btn.dataset.filter);
        });
    });
}

async function loadTasks(filter = 'pending') {
    const username = currentUser?.username;
    if (!username) return;
    showSkeleton('tasks-grid', 4, 'list');

    if (currentUser.isParent && filter === 'awaiting_approval') {
        const badge = document.getElementById('tasks-badge');
        badge.classList.add('hidden');
    }

    let tasks;
    if (currentUser.isParent) {
        tasks = await window.api.tasks.getAll();
    } else {
        tasks = await window.api.tasks.getForUser(username);
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const filtered = tasks.filter(t => {
        if (filter === 'pending') return t.status === 'pending';
        if (filter === 'awaiting_approval') return t.status === 'awaiting_approval';
        if (filter === 'completed') return t.status === 'completed';
        if (filter === 'rejected') return t.status === 'rejected';
        return true;
    });

    const grid = document.getElementById('tasks-grid');
    const noTasks = document.getElementById('no-tasks');

    if (filtered.length === 0) {
        grid.innerHTML = '';
        if (noTasks) noTasks.classList.remove('hidden');
        return;
    }

    if (noTasks) noTasks.classList.add('hidden');

    grid.innerHTML = filtered.map(task => {
        const isExpired = task.deadline && task.deadline < todayStr && task.status === 'pending';
        const priorityClass = task.priority && task.priority !== 'normal' ? ` task-priority-${task.priority}` : '';
        const expiredClass = isExpired ? ' task-expired' : '';
        const priorityLabel = task.priority === 'urgent' ? '⭐⭐⭐ דחוף' : task.priority === 'important' ? '⭐⭐ חשוב' : '';
        const recurringLabel = task.recurring === 'daily' ? '🔄 יומית' : task.recurring === 'weekly' ? '🔄 שבועית' : '';
        return `
        <div class="task-card task-${task.status}${priorityClass}${expiredClass}">
            <div class="task-header">
                <span class="task-reward">💰 ${task.reward}</span>
                <span class="task-status-badge">${isExpired ? '⌛ פג תוקף' : getTaskStatusText(task.status)}</span>
            </div>
            <h4 class="task-title">${escapeHtml(task.title)}</h4>
            ${priorityLabel ? `<span class="task-priority-label">${priorityLabel}</span>` : ''}
            ${recurringLabel ? `<span class="task-recurring-label">${recurringLabel}</span>` : ''}
            ${task.deadline ? `<span class="task-deadline-label${isExpired ? ' expired' : ''}">📅 עד: ${task.deadline}</span>` : ''}
            ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}
            ${task.completedBy && currentUser.isParent ? `<p class="task-completed-by">👦 הושלם ע"י: <strong>${escapeHtml(task.completedBy)}</strong></p>` : ''}
            ${task.parentNote ? `<p class="task-parent-note">📝 הערת הורה: ${escapeHtml(task.parentNote)}</p>` : ''}
            <div class="task-footer">
                ${task.status === 'pending' && !currentUser.isParent && !isExpired ?
                    `<button class="btn btn-primary btn-small" onclick="completeTask('${task.id}')">✅ סיימתי!</button>` : ''}
                ${task.status === 'awaiting_approval' && !currentUser.isParent ?
                    `<button class="btn btn-primary btn-small" onclick="approveTaskWithPin('${task.id}')">🔑 אישור הורה</button>` : ''}
                ${task.status === 'awaiting_approval' && currentUser.isParent ?
                    `<button class="btn btn-primary btn-small" onclick="approveTaskDirect('${task.id}')">✅ אשר</button>
                     <button class="btn btn-danger btn-small" onclick="rejectTaskDirect('${task.id}')">❌ דחה</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

function getTaskStatusText(status) {
    switch (status) {
        case 'pending': return '⏳ ממתין';
        case 'awaiting_approval': return '🔍 ממתין לאישור';
        case 'completed': return '✅ הושלם';
        case 'rejected': return '❌ נדחה';
        default: return status;
    }
}

async function completeTask(taskId) {
    const result = await window.api.tasks.requestComplete(taskId);
    if (result.success) {
        playSound('task');
        showToast('המשימה סומנה כהושלמה! בקש מההורה לאשר 🔑', 'success');
        loadTasks('awaiting_approval');
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.filter-btn[data-filter="awaiting_approval"]').classList.add('active');
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function approveTaskWithPin(taskId) {
    const pin = await showPinModal('הזן את קוד ה-PIN של ההורה כדי לאשר את המשימה');
    if (!pin) return;
    const result = await window.api.tasks.approve({ taskId, pin });
    if (result.success) {
        currentUser.coins = result.newBalance || currentUser.coins;
        refreshUI();
        playSound('coins');
        showToast(`משימה אושרה! קיבלת ${result.task.reward} מטבעות 🎉`, 'success');
        loadTasks('completed');
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.filter-btn[data-filter="completed"]').classList.add('active');
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function approveTaskDirect(taskId) {
    const note = prompt('הערה (אופציונלי):');
    const result = await window.api.tasks.approveAdmin({ taskId, note: note || null });
    if (result.success) {
        showToast('משימה אושרה! ✅', 'success');
        loadAdminOverview();
        loadTasks('completed');
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function rejectTaskDirect(taskId) {
    const note = prompt('סיבה לדחייה:');
    if (note === null) return;
    const result = await window.api.tasks.rejectAdmin({ taskId, note: note || null });
    if (result.success) {
        showToast('משימה נדחתה ❌', 'success');
        loadAdminOverview();
        loadTasks('rejected');
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}
