const { store } = require('../store');
const firebaseSync = require('../firebase-sync');

module.exports = function registerSyncHandlers(ipcMain) {
    // Get sync status
    ipcMain.handle('sync:getStatus', () => {
        return {
            syncEnabled: store.get('syncEnabled') || false,
            familyId: firebaseSync.getFamilyId(),
            isOnline: firebaseSync.getIsOnline()
        };
    });

    // Create a new family (parent action on first machine)
    ipcMain.handle('sync:setupFamily', async () => {
        const currentUser = store.get('currentUser');
        if (!currentUser) return { success: false, error: 'לא מחובר' };
        const user = store.get(`users.${currentUser}`);
        if (!user?.isParent && !user?.isAdmin) return { success: false, error: 'רק הורה יכול ליצור משפחה' };
        return await firebaseSync.setupFamily(currentUser);
    });

    // Connect to existing family (second machine)
    ipcMain.handle('sync:connectFamily', async (event, familyId) => {
        if (!familyId || typeof familyId !== 'string') return { success: false, error: 'קוד משפחה לא תקין' };
        return await firebaseSync.connectToFamily(familyId);
    });

    // Disconnect sync
    ipcMain.handle('sync:disconnect', () => {
        firebaseSync.disconnectSync();
        return { success: true };
    });

    // Force pull from Firebase
    ipcMain.handle('sync:pullNow', async () => {
        await firebaseSync.pullFullSync();
        return { success: true };
    });

    // Force push to Firebase
    ipcMain.handle('sync:pushNow', async () => {
        await firebaseSync.pushFullSync();
        return { success: true };
    });

    // Get online statuses of all family members
    ipcMain.handle('sync:getOnlineStatuses', async () => {
        return await firebaseSync.getOnlineStatuses();
    });
};
