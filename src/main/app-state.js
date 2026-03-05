/** Shared mutable application state — accessible by all modules. */
module.exports = {
    mainWindow: null,
    lockWindow: null,
    blurHandler: null,
    gameGuardInterval: null,
    recentlyBlocked: new Set(),
    dicebearCache: {}
};
