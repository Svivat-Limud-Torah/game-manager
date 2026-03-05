// Script to migrate all existing data to Firebase Firestore
const firebase = require('./src/firebase');

// The existing data from main.js
const existingUsers = {
    'dodo': {
        username: 'dodo',
        password: 'dodohagever',
        displayName: 'דודו',
        coins: 11380,
        remainingTime: 35 * 60,
        lastLoginDate: null,
        isPro: true,
        ownedGames: [],
        ownedItems: ['תאורה_כתומה', 'בול_עץ', 'שוק_2', 'תחנת_חשמל_קפואה', 'גדר', 'אולף', 'מבנה_קפוא', 'מנורת_רחוב_2', 'עץ'],
        questionsAnswered: 0,
        correctAnswers: 0,
        challengesCompleted: []
    },
    'naomi': {
        username: 'naomi',
        password: 'מיקוש111זגסבהזגבה',
        displayName: 'נעמי',
        coins: 13540,
        remainingTime: 35 * 60,
        lastLoginDate: null,
        isPro: true,
        ownedGames: [],
        ownedItems: ['אלזה', 'שוק_3', 'שוק_2', 'באר_2', 'שוק', 'לפיד', 'גדר', 'אוהל_5', 'תאורה_כתומה'],
        questionsAnswered: 0,
        correctAnswers: 0,
        challengesCompleted: []
    }
};

const shopItems = {
    games: [
        { id: 'spiderman', name: 'איש העכביש', price: 500, icon: '🕷️', shortcutPath: 'C:\\Game-Data\\user1\\איש=העכביש.lnk', processName: 'Spider-Man.exe' },
        { id: 'batman', name: 'איש העטלף', price: 500, icon: '🦇', shortcutPath: 'C:\\Game-Data\\user1\\אישהעטלף.lnk', processName: 'BatmanAK.exe' },
        { id: 'ironman', name: 'איש הברזל', price: 500, icon: '🤖', shortcutPath: 'C:\\Game-Data\\user1\\איש=הברזל.lnk', processName: '' },
        { id: 'forza', name: 'פורזה הורייזון 5', price: 600, icon: '🏎️', shortcutPath: '', processName: 'ForzaHorizon5.exe' },
        { id: 'rdr2', name: 'רד דד רידמשן 2', price: 700, icon: '🤠', shortcutPath: '', processName: 'RDR2.exe' },
        { id: 'asphalt', name: 'אספלט 9', price: 300, icon: '🚗', shortcutPath: 'C:\\Game-Data\\user1\\אספלט.url', processName: 'Asphalt9_Steam_x64_rtl.exe' },
        { id: 'drift', name: 'דריפט', price: 200, icon: '🏁', shortcutPath: 'C:\\Game-Data\\user1\\דריפט.url', processName: '' },
        { id: 'differences', name: 'הבדלים', price: 150, icon: '🔍', shortcutPath: 'C:\\Game-Data\\user1\\הבדלים.lnk', processName: '' },
        { id: 'drawing', name: 'משחק ציור', price: 200, icon: '🎨', shortcutPath: 'C:\\Game-Data\\user1\\משחק_ציור.lnk', processName: 'Passpartout2.exe' },
        { id: 'unlisted', name: 'אנליסטד', price: 400, icon: '🎮', shortcutPath: 'C:\\Game-Data\\user1\\אנליסטד.lnk', processName: '' }
    ],
    items: [
        { id: 'בית_3', name: 'בית 3', price: 80, icon: '🏠', category: 'buildings' },
        { id: 'בית_4', name: 'בית 4', price: 90, icon: '🏡', category: 'buildings' },
        { id: 'בית_שווה', name: 'בית שווה', price: 100, icon: '🏘️', category: 'buildings' },
        { id: 'מבנה_קפוא', name: 'מבנה קפוא', price: 120, icon: '🏔️', category: 'buildings' },
        { id: 'תחנת_חשמל_קפואה', name: 'תחנת חשמל קפואה', price: 150, icon: '⚡', category: 'buildings' },
        { id: 'תחנת_רוח', name: 'תחנת רוח', price: 100, icon: '🌀', category: 'buildings' },
        { id: 'עץ', name: 'עץ', price: 30, icon: '🌳', category: 'nature' },
        { id: 'עץ_שלג_2', name: 'עץ שלג', price: 40, icon: '🌲', category: 'nature' },
        { id: 'אבן', name: 'אבן', price: 20, icon: '🪨', category: 'nature' },
        { id: 'אבן_2', name: 'אבן 2', price: 25, icon: '🪨', category: 'nature' },
        { id: 'בול_עץ', name: 'בול עץ', price: 15, icon: '🪵', category: 'nature' },
        { id: 'לפיד', name: 'לפיד', price: 25, icon: '🔥', category: 'decorations' },
        { id: 'לפיד_קרח', name: 'לפיד קרח', price: 35, icon: '❄️', category: 'decorations' },
        { id: 'מדורה', name: 'מדורה', price: 40, icon: '🔥', category: 'decorations' },
        { id: 'אש_ירוקה', name: 'אש ירוקה', price: 50, icon: '💚', category: 'decorations' },
        { id: 'תאורה', name: 'תאורה', price: 30, icon: '💡', category: 'decorations' },
        { id: 'תאורה_כתומה', name: 'תאורה כתומה', price: 35, icon: '🟠', category: 'decorations' },
        { id: 'מנורת_רחוב_2', name: 'מנורת רחוב', price: 45, icon: '🏮', category: 'decorations' },
        { id: 'גשר', name: 'גשר', price: 60, icon: '🌉', category: 'structures' },
        { id: 'גדר', name: 'גדר', price: 25, icon: '🚧', category: 'structures' },
        { id: 'קיר', name: 'קיר', price: 30, icon: '🧱', category: 'structures' },
        { id: 'חומת_טירה', name: 'חומת טירה', price: 80, icon: '🏰', category: 'structures' },
        { id: 'חומת_טירה_2', name: 'חומת טירה 2', price: 85, icon: '🏰', category: 'structures' },
        { id: 'שוק', name: 'שוק', price: 70, icon: '🏪', category: 'market' },
        { id: 'שוק_2', name: 'שוק 2', price: 75, icon: '🛒', category: 'market' },
        { id: 'שוק_3', name: 'שוק 3', price: 80, icon: '🏬', category: 'market' },
        { id: 'עגלה', name: 'עגלה', price: 55, icon: '🛒', category: 'market' },
        { id: 'חבית', name: 'חבית', price: 20, icon: '🛢️', category: 'market' },
        { id: 'באר', name: 'באר', price: 45, icon: '🪣', category: 'market' },
        { id: 'באר_2', name: 'באר 2', price: 50, icon: '💧', category: 'market' },
        { id: 'אולף', name: 'אולף', price: 200, icon: '⛄', category: 'special' },
        { id: 'אלזה', name: 'אלזה', price: 300, icon: '👸', category: 'special' },
        { id: 'פויקה', name: 'פויקה', price: 150, icon: '🎭', category: 'special' },
        { id: 'כלי_נשק', name: 'כלי נשק', price: 100, icon: '⚔️', category: 'special' },
        { id: 'דגל_הוגוורטס', name: 'דגל הוגוורטס', price: 120, icon: '🏴', category: 'special' },
        { id: 'דגל_של_גריפינדור', name: 'דגל גריפינדור', price: 100, icon: '🦁', category: 'special' },
        { id: 'אליה', name: 'תמונה של אליה', price: 50, icon: '📷', category: 'photos' },
        { id: 'צורי_ואליה', name: 'תמונה של צורי ואליה', price: 60, icon: '📸', category: 'photos' },
        { id: 'אוהל_5', name: 'אוהל', price: 65, icon: '⛺', category: 'structures' }
    ]
};

// Load questions from the generated file
const questionsOutput = require('./questions-output.js');

async function migrateData() {
    console.log('🚀 Starting data migration to Firebase...\n');
    
    // 1. Migrate Users
    console.log('📦 Migrating users...');
    for (const [username, userData] of Object.entries(existingUsers)) {
        const result = await firebase.saveUser(username, userData);
        if (result.success) {
            console.log(`  ✅ User "${username}" migrated successfully`);
        } else {
            console.log(`  ❌ Failed to migrate user "${username}": ${result.error}`);
        }
    }
    
    // 2. Migrate Questions
    console.log('\n📚 Migrating questions...');
    // Get questions from the generated function
    const questions = [];
    // Parse the questions from questions-output.js
    const fs = require('fs');
    const content = fs.readFileSync('./questions-output.js', 'utf8');
    
    // Extract questions array using regex
    const questionsMatch = content.match(/const questions = \[([\s\S]*?)\];/);
    if (questionsMatch) {
        // Evaluate the questions array
        const questionsCode = `[${questionsMatch[1]}]`;
        try {
            const parsedQuestions = eval(questionsCode);
            console.log(`  Found ${parsedQuestions.length} questions to migrate`);
            
            const result = await firebase.saveAllQuestions(parsedQuestions);
            if (result.success) {
                console.log(`  ✅ ${result.count} questions migrated successfully`);
            } else {
                console.log(`  ❌ Failed to migrate questions: ${result.error}`);
            }
        } catch (e) {
            console.log(`  ❌ Error parsing questions: ${e.message}`);
        }
    }
    
    // 3. Migrate Shop Items
    console.log('\n🛒 Migrating shop items...');
    
    // Save games
    const gamesResult = await firebase.saveAllShopItems(
        shopItems.games.map(g => ({ ...g, type: 'game' }))
    );
    if (gamesResult.success) {
        console.log(`  ✅ ${shopItems.games.length} games migrated successfully`);
    }
    
    // Save other items
    const itemsResult = await firebase.saveAllShopItems(
        shopItems.items.map(i => ({ ...i, type: 'item' }))
    );
    if (itemsResult.success) {
        console.log(`  ✅ ${shopItems.items.length} items migrated successfully`);
    }
    
    // 4. Save settings
    console.log('\n⚙️ Migrating settings...');
    const settings = {
        dailyTimeLimit: 35 * 60,
        coinsPerCorrectAnswer: 10,
        coinsPerReviewAnswer: 15,
        softwaresToStop: [
            'ForzaHorizon5.exe', 'WhatsApp.exe', 'CitySample-Win64-Shipping.exe', 
            'ChillCorner.exe', 'steam.exe', 'The Savior From Above.exe', 
            'Spider-Man.exe', 'BatmanAK.exe', 'launcher.exe', 'enlisted.exe',
            'Asphalt9_Steam_x64_rtl.exe', 'SuchArt.exe', 'game.exe', 
            'Knightfall.exe', 'HiddenLands.exe', 'RDR2.exe', 'Passpartout2.exe'
        ]
    };
    
    const settingsResult = await firebase.saveSettings('gameSettings', settings);
    if (settingsResult.success) {
        console.log('  ✅ Settings migrated successfully');
    }
    
    console.log('\n✨ Migration complete!');
    console.log('\nYou can now view your data at:');
    console.log('https://console.firebase.google.com/project/game-data-f1f43/firestore');
    
    process.exit(0);
}

migrateData().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
});
