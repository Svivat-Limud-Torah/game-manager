const fs = require('fs');
const path = require('path');

// Read current image files
const imagesDir = path.join(__dirname, 'src', 'renderer', 'assets', 'items');
const imageFiles = fs.readdirSync(imagesDir);

console.log('Available image files:', imageFiles.length);

// Create a mapping from Hebrew names to English filenames
const hebrewToEnglish = {
    'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h',
    'ו': 'v', 'ז': 'z', 'ח': 'ch', 'ט': 't', 'י': 'y',
    'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm',
    'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p',
    'ף': 'p', 'צ': 'tz', 'ץ': 'tz', 'ק': 'k', 'ר': 'r',
    'ש': 'sh', 'ת': 't'
};

function hebrewToEnglishName(hebrewName) {
    let result = '';
    for (const char of hebrewName) {
        if (hebrewToEnglish[char]) {
            result += hebrewToEnglish[char];
        } else if (char === '_' || char === ' ') {
            result += '_';
        } else if (/[a-zA-Z0-9]/.test(char)) {
            result += char.toLowerCase();
        }
    }
    return result;
}

// Read shop items data
const shopData = JSON.parse(fs.readFileSync(path.join(__dirname, 'shop-items-data.json'), 'utf8'));

// Update items with correct image paths
let updated = 0;
let notFound = [];

for (const item of shopData.items) {
    const englishName = hebrewToEnglishName(item.id);
    
    // Find matching image file
    let found = false;
    for (const ext of ['.png', '.jpg', '.jpeg']) {
        const expectedFile = englishName + ext;
        if (imageFiles.includes(expectedFile)) {
            item.image = expectedFile;
            updated++;
            found = true;
            break;
        }
    }
    
    if (!found) {
        notFound.push({ id: item.id, english: englishName });
    }
}

// Handle games separately - they have special naming
const gameImageMapping = {
    'פרוזה': 'prvzh.jpg',
    'אספלט 9': null, // No image found
    'איש העטלף': 'ayyrvn_mn_700_ayshhbrzljpg.jpg', // Iron Man image - close match
    'הבדלים': 'mtzaathhbdlym_500_hbdlymjpg.jpg',
    'משחק ציור': 'mshchk_tzyvr_99999_mshchk_tzyvrpng.png',
    'דריפט': 'yryvtamdrypt_1000_dryptjpg.jpg',
    'פורזה הורייזון 5': 'prvzh.jpg', // Using forza image
    'איש הברזל': 'ayyrvn_mn_700_ayshhbrzljpg.jpg',
    'רד דד רידמשן 2': null, // No image
    'איש העכביש': null, // No image
    'אנליסטד': 'mshchkyryvt_99999_anlystdjpg.jpg'
};

// Check for games in items that might be in games array
if (shopData.games) {
    for (const game of shopData.games) {
        if (gameImageMapping[game.name]) {
            game.image = gameImageMapping[game.name];
        }
    }
}

// Also check items for game-related items
for (const item of shopData.items) {
    if (gameImageMapping[item.name]) {
        item.image = gameImageMapping[item.name];
    }
}

console.log('\nUpdated', updated, 'items');
console.log('\nNot found:', notFound.length);
notFound.forEach(nf => console.log(`  - ${nf.id} -> ${nf.english}`));

// Write updated data
fs.writeFileSync(
    path.join(__dirname, 'shop-items-data.json'),
    JSON.stringify(shopData, null, 2),
    'utf8'
);

console.log('\n✅ Updated shop-items-data.json');

// Now update the electron store as well
const Store = require('electron-store');
const store = new Store({ name: 'game-manager-data' });

const currentData = store.get('shopItems', {});
currentData.items = shopData.items;
currentData.games = shopData.games;
store.set('shopItems', currentData);

console.log('✅ Updated electron store');
