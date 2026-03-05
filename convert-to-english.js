const fs = require('fs');
const path = require('path');
const Store = require('electron-store');

const assetsDir = path.join(__dirname, 'src/renderer/assets/items');

// Hebrew to English transliteration map
const hebrewToEnglish = {
    'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z',
    'ח': 'ch', 'ט': 't', 'י': 'y', 'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm',
    'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p', 'ף': 'f',
    'צ': 'tz', 'ץ': 'tz', 'ק': 'k', 'ר': 'r', 'ש': 'sh', 'ת': 't',
    '_': '_', ' ': '_'
};

function transliterate(hebrewText) {
    let result = '';
    for (const char of hebrewText) {
        result += hebrewToEnglish[char] || char;
    }
    return result.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

const files = fs.readdirSync(assetsDir);
const mapping = {}; // old hebrew name -> new english name

files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) return;
    
    const nameWithoutExt = path.basename(file, ext);
    
    // Skip if already in English
    if (/^[a-z0-9_]+$/i.test(nameWithoutExt)) {
        console.log('Already English:', file);
        return;
    }
    
    const englishName = transliterate(nameWithoutExt);
    const newFileName = `${englishName}${ext}`;
    
    const oldPath = path.join(assetsDir, file);
    const newPath = path.join(assetsDir, newFileName);
    
    // Handle duplicates
    let finalNewPath = newPath;
    let counter = 1;
    while (fs.existsSync(finalNewPath)) {
        finalNewPath = path.join(assetsDir, `${englishName}_${counter}${ext}`);
        counter++;
    }
    
    const finalNewName = path.basename(finalNewPath);
    
    try {
        fs.renameSync(oldPath, finalNewPath);
        mapping[nameWithoutExt] = path.basename(finalNewPath, ext);
        console.log(`Renamed: ${file} -> ${finalNewName}`);
    } catch (e) {
        console.error(`Failed: ${file}`, e.message);
    }
});

console.log(`\n✅ Renamed ${Object.keys(mapping).length} files to English\n`);

// Update the store with new image names
const store = new Store({ name: 'game-manager-data' });
const shopItems = store.get('shopItems');

if (shopItems && shopItems.items) {
    let updated = 0;
    shopItems.items = shopItems.items.map(item => {
        if (item.image) {
            const oldNameWithoutExt = path.basename(item.image, path.extname(item.image));
            if (mapping[oldNameWithoutExt]) {
                const ext = path.extname(item.image);
                item.image = mapping[oldNameWithoutExt] + ext;
                updated++;
            }
        }
        return item;
    });
    store.set('shopItems', shopItems);
    console.log(`✅ Updated ${updated} items in store with English filenames`);
}

// Print sample
const updatedItems = store.get('shopItems.items');
console.log('\nSample updated items:');
console.log(JSON.stringify(updatedItems?.slice(0, 3), null, 2));
