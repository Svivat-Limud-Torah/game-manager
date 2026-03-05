const firebase = require('./src/firebase');

async function addAdmin() {
    console.log('Adding admin user to Firebase...');
    
    const adminUser = {
        username: 'admin',
        password: 'admin123',
        displayName: 'מנהל',
        coins: 0,
        remainingTime: 2100,
        lastLoginDate: null,
        isPro: true,
        isAdmin: true,
        ownedGames: [],
        ownedItems: [],
        questionsAnswered: 0,
        correctAnswers: 0,
        challengesCompleted: [],
        currentWeek: 1,
        answeredQuestionsInWeek: [],
        completedWeeks: []
    };
    
    try {
        const result = await firebase.saveUser('admin', adminUser);
        console.log('✅ Admin user saved to Firebase:', result);
    } catch (e) {
        console.error('❌ Error saving admin:', e.message);
    }
    
    process.exit(0);
}

addAdmin();
