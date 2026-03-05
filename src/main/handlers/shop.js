const { store } = require('../store');
const { requireLogin, logActivity, addPurchaseHistory } = require('../helpers');
const { getDefaultShopItems } = require('../data/shop-items');

module.exports = function registerShopHandlers(ipcMain) {
    ipcMain.handle('shop:getItems', () => getDefaultShopItems());

    ipcMain.handle('shop:purchase', (event, itemId) => {
        const { loggedIn, currentUser, result } = requireLogin();
        if (!loggedIn) return result;
        const user = store.get(`users.${currentUser}`);
        const shopData = getDefaultShopItems();
        const item = shopData.items.find(i => i.id === itemId);
        if (!item) return { success: false, error: 'פריט לא נמצא' };
        if (user.ownedItems?.includes(itemId)) return { success: false, error: 'הפריט כבר בבעלותך' };
        if (user.coins < item.price) return { success: false, error: 'אין מספיק מטבעות' };
        user.coins -= item.price;
        user.ownedItems = user.ownedItems || [];
        user.ownedItems.push(itemId);
        store.set(`users.${currentUser}`, user);
        logActivity(currentUser, 'shop', `קנה "${item.name}"`, '🛒');
        addPurchaseHistory(currentUser, { type: 'item', name: item.name, price: item.price, icon: '🛒' });
        return { success: true, user };
    });

    ipcMain.handle('shop:getPurchaseHistory', () => {
        const { loggedIn, currentUser, result } = requireLogin();
        if (!loggedIn) return result;
        return store.get(`users.${currentUser}.purchaseHistory`) || [];
    });

    ipcMain.handle('shop:getSiblings', () => {
        const { loggedIn, currentUser, result } = requireLogin();
        if (!loggedIn) return result;
        const users = store.get('users') || {};
        return Object.values(users)
            .filter(u => !u.isParent && !u.isAdmin && u.username !== currentUser)
            .map(u => ({ username: u.username, displayName: u.displayName }));
    });

    ipcMain.handle('shop:giftCoins', (event, { toUsername, amount }) => {
        const { loggedIn, currentUser, result } = requireLogin();
        if (!loggedIn) return result;
        if (amount <= 0) return { success: false, error: 'סכום לא תקין' };
        const user = store.get(`users.${currentUser}`);
        if (user.coins < amount) return { success: false, error: 'אין מספיק מטבעות' };
        const target = store.get(`users.${toUsername}`);
        if (!target) return { success: false, error: 'משתמש לא נמצא' };
        user.coins -= amount;
        target.coins = (target.coins || 0) + amount;
        store.set(`users.${currentUser}`, user);
        store.set(`users.${toUsername}`, target);
        logActivity(currentUser, 'gift', `שלח ${amount} מטבעות ל${target.displayName}`, '🎁');
        logActivity(toUsername, 'gift', `קיבל ${amount} מטבעות מ${user.displayName}`, '🎁');
        return { success: true, user, targetUser: target };
    });
};
