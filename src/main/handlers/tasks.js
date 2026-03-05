const { store } = require('../store');
const { requireAdmin, pushNotification, logActivity, recordDailyStats } = require('../helpers');
const { addXP, checkAchievements, checkCustomAchievements } = require('../gamification');

function processRecurringTasks() {
    const tasks = store.get('tasks') || [];
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    let changed = false;
    for (const task of tasks) {
        if (!task.recurring || task.recurring === 'none') continue;
        if (task.status !== 'completed' && task.status !== 'rejected') continue;
        const doneDate = task.approvedAt || task.rejectedAt || task.completedAt;
        if (!doneDate) continue;
        const done = new Date(doneDate);
        let shouldRecreate = false;
        if (task.recurring === 'daily') {
            shouldRecreate = done.toISOString().split('T')[0] < today;
        } else if (task.recurring === 'weekly') {
            shouldRecreate = Math.floor((now - done) / 86400000) >= 7;
        }
        if (shouldRecreate && !task._recreated) {
            tasks.push({
                id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                title: task.title, description: task.description,
                reward: task.reward, assignedTo: task.assignedTo,
                approvalCode: task.approvalCode, priority: task.priority || 'normal',
                recurring: task.recurring, deadline: null, parentNote: null,
                status: 'pending', createdAt: new Date().toISOString(),
                completedBy: null, completedAt: null, approvedAt: null, rejectedAt: null
            });
            task._recreated = true;
            changed = true;
        }
    }
    if (changed) store.set('tasks', tasks);
}

function approveTaskLogic(tasks, index) {
    const task = tasks[index];
    const childUser = store.get(`users.${task.completedBy}`);
    if (childUser) {
        childUser.coins = (childUser.coins || 0) + task.reward;
        childUser.totalCoinsEarned = (childUser.totalCoinsEarned || 0) + task.reward;
        childUser.tasksCompletedCount = (childUser.tasksCompletedCount || 0) + 1;
        store.set(`users.${task.completedBy}`, childUser);
        addXP(task.completedBy, 25);
        checkAchievements(task.completedBy);
        checkCustomAchievements(task.completedBy);
    }
    task.status = 'completed';
    task.approvedAt = new Date().toISOString();
    return childUser;
}

module.exports = function registerTaskHandlers(ipcMain) {
    ipcMain.handle('tasks:getAll', () => { processRecurringTasks(); return store.get('tasks') || []; });

    ipcMain.handle('tasks:getForUser', (event, username) => {
        processRecurringTasks();
        return (store.get('tasks') || []).filter(t => t.assignedTo === username || t.assignedTo === 'all');
    });

    ipcMain.handle('tasks:create', (event, taskData) => {
        const auth = requireAdmin('רק הורה יכול ליצור משימות');
        if (!auth.authorized) return auth.result;
        const tasks = store.get('tasks') || [];
        const newTask = {
            id: `task_${Date.now()}`, title: taskData.title,
            description: taskData.description || '', reward: taskData.reward || 50,
            assignedTo: taskData.assignedTo || 'all', approvalCode: taskData.approvalCode || '',
            priority: taskData.priority || 'normal', recurring: taskData.recurring || 'none',
            deadline: taskData.deadline || null, status: 'pending',
            createdAt: new Date().toISOString(), createdBy: auth.currentUser,
            completedAt: null, completedBy: null, approvedAt: null, parentNote: null
        };
        tasks.push(newTask);
        store.set('tasks', tasks);
        const users = store.get('users');
        Object.keys(users).forEach(uname => {
            if (users[uname].isParent || users[uname].isAdmin) return;
            if (newTask.assignedTo !== 'all' && newTask.assignedTo !== uname) return;
            pushNotification(uname, { type: 'task_new', title: '📋 משימה חדשה!', body: `"${newTask.title}" — ${newTask.reward} 💰`, icon: '📋' });
        });
        return { success: true, task: newTask };
    });

    ipcMain.handle('tasks:requestComplete', (event, taskId) => {
        const currentUser = store.get('currentUser');
        if (!currentUser) return { success: false, error: 'לא מחובר' };
        const tasks = store.get('tasks') || [];
        const index = tasks.findIndex(t => t.id === taskId);
        if (index === -1) return { success: false, error: 'משימה לא נמצאה' };
        if (tasks[index].status !== 'pending') return { success: false, error: 'המשימה כבר הושלמה או ממתינה לאישור' };
        tasks[index].status = 'awaiting_approval';
        tasks[index].completedBy = currentUser;
        tasks[index].completedAt = new Date().toISOString();
        store.set('tasks', tasks);
        return { success: true, task: tasks[index] };
    });

    ipcMain.handle('tasks:approve', (event, { taskId, pin }) => {
        const tasks = store.get('tasks') || [];
        const index = tasks.findIndex(t => t.id === taskId);
        if (index === -1) return { success: false, error: 'משימה לא נמצאה' };
        if (tasks[index].status !== 'awaiting_approval') return { success: false, error: 'המשימה לא ממתינה לאישור' };
        if (pin !== tasks[index].approvalCode) return { success: false, error: 'קוד אישור שגוי' };
        const childUser = approveTaskLogic(tasks, index);
        store.set('tasks', tasks);
        if (childUser) {
            logActivity(tasks[index].completedBy, 'task', `השלים משימה: "${tasks[index].title}" (+${tasks[index].reward} 💰)`, '📋');
            recordDailyStats(tasks[index].completedBy, { coins: tasks[index].reward });
            pushNotification(tasks[index].completedBy, { type: 'task_approved', title: '✅ משימה אושרה!', body: `"${tasks[index].title}" — +${tasks[index].reward} 💰`, icon: '✅' });
        }
        return { success: true, task: tasks[index], newBalance: childUser?.coins };
    });

    ipcMain.handle('tasks:approveAdmin', (event, { taskId, note }) => {
        const auth = requireAdmin('אין הרשאת הורה');
        if (!auth.authorized) return auth.result;
        const tasks = store.get('tasks') || [];
        const index = tasks.findIndex(t => t.id === taskId);
        if (index === -1) return { success: false, error: 'משימה לא נמצאה' };
        if (tasks[index].status !== 'awaiting_approval') return { success: false, error: 'המשימה לא ממתינה לאישור' };
        const childUser = approveTaskLogic(tasks, index);
        if (note) tasks[index].parentNote = note;
        store.set('tasks', tasks);
        if (childUser) {
            logActivity(tasks[index].completedBy, 'task', `השלים משימה: "${tasks[index].title}" (+${tasks[index].reward} 💰)`, '📋');
            recordDailyStats(tasks[index].completedBy, { coins: tasks[index].reward });
            pushNotification(tasks[index].completedBy, { type: 'task_approved', title: '✅ משימה אושרה!', body: `"${tasks[index].title}" — +${tasks[index].reward} 💰${note ? ' — ' + note : ''}`, icon: '✅' });
        }
        return { success: true, task: tasks[index], newBalance: childUser?.coins };
    });

    ipcMain.handle('tasks:rejectAdmin', (event, { taskId, note }) => {
        const auth = requireAdmin('אין הרשאת הורה');
        if (!auth.authorized) return auth.result;
        const tasks = store.get('tasks') || [];
        const index = tasks.findIndex(t => t.id === taskId);
        if (index === -1) return { success: false, error: 'משימה לא נמצאה' };
        if (tasks[index].status !== 'awaiting_approval') return { success: false, error: 'המשימה לא ממתינה לאישור' };
        tasks[index].status = 'rejected';
        tasks[index].rejectedAt = new Date().toISOString();
        if (note) tasks[index].parentNote = note;
        store.set('tasks', tasks);
        logActivity(tasks[index].completedBy, 'task', `משימה "${tasks[index].title}" נדחתה${note ? ': ' + note : ''}`, '❌');
        pushNotification(tasks[index].completedBy, { type: 'task_rejected', title: '❌ משימה נדחתה', body: `"${tasks[index].title}"${note ? ' — ' + note : ''}`, icon: '❌' });
        return { success: true, task: tasks[index] };
    });

    ipcMain.handle('tasks:delete', (event, taskId) => {
        const auth = requireAdmin('רק הורה יכול למחוק משימות');
        if (!auth.authorized) return auth.result;
        store.set('tasks', (store.get('tasks') || []).filter(t => t.id !== taskId));
        return { success: true };
    });

    ipcMain.handle('tasks:edit', (event, { taskId, data }) => {
        const auth = requireAdmin('רק הורה יכול לערוך משימות');
        if (!auth.authorized) return auth.result;
        const tasks = store.get('tasks') || [];
        const index = tasks.findIndex(t => t.id === taskId);
        if (index === -1) return { success: false, error: 'משימה לא נמצאה' };
        tasks[index] = { ...tasks[index], ...data };
        store.set('tasks', tasks);
        return { success: true, task: tasks[index] };
    });
};
