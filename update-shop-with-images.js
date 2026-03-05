// Script to update shop items in store with images from JSON file
const Store = require('electron-store');
const fs = require('fs');
const path = require('path');

const store = new Store({ name: 'game-manager-data' });

// Load items from JSON
const shopDataPath = path.join(__dirname, 'src', 'shop-items-data.json');
const shopData = JSON.parse(fs.readFileSync(shopDataPath, 'utf8'));

// Games list with images
const games = [
    { id: 'spiderman', name: 'איש העכביש', price: 500, image: 'איירון_מן 700 איש=הברזל+.JPG', shortcutPath: 'C:\\Game-Data\\user1\\איש=העכביש.lnk', processName: 'Spider-Man.exe' },
    { id: 'batman', name: 'איש העטלף', price: 500, icon: '🦇', shortcutPath: 'C:\\Game-Data\\user1\\אישהעטלף.lnk', processName: 'BatmanAK.exe' },
    { id: 'ironman', name: 'איש הברזל', price: 700, image: 'איירון_מן 700 איש=הברזל+.JPG', shortcutPath: 'C:\\Game-Data\\user1\\איש=הברזל.lnk', processName: '' },
    { id: 'forza', name: 'פורזה הורייזון 5', price: 800, image: 'פרוזה 800 פרוזה+.jpg', shortcutPath: '', processName: 'ForzaHorizon5.exe' },
    { id: 'rdr2', name: 'רד דד רידמשן 2', price: 700, icon: '🤠', shortcutPath: '', processName: 'RDR2.exe' },
    { id: 'asphalt', name: 'אספלט 9', price: 300, icon: '🚗', shortcutPath: 'C:\\Game-Data\\user1\\אספלט.url', processName: 'Asphalt9_Steam_x64_rtl.exe' },
    { id: 'drift', name: 'דריפט', price: 1000, image: 'יריות=עם=דריפט 1000 דריפט+.JPG', shortcutPath: 'C:\\Game-Data\\user1\\דריפט.url', processName: '' },
    { id: 'differences', name: 'הבדלים', price: 500, image: 'מצא=את=ההבדלים 500 הבדלים+.JPG', shortcutPath: 'C:\\Game-Data\\user1\\הבדלים.lnk', processName: '' },
    { id: 'drawing', name: 'משחק ציור', price: 200, icon: '🎨', shortcutPath: 'C:\\Game-Data\\user1\\משחק_ציור.lnk', processName: 'Passpartout2.exe' },
    { id: 'unlisted', name: 'אנליסטד', price: 400, icon: '🎮', shortcutPath: 'C:\\Game-Data\\user1\\אנליסטד.lnk', processName: '' }
];

const shopItems = {
    games: games,
    items: shopData.items
};

// Save to store
store.set('shopItems', shopItems);

console.log('✅ Shop items updated with images!');
console.log(`   Games: ${shopItems.games.length}`);
console.log(`   Items: ${shopItems.items.length}`);

// Show sample item with image
const sampleWithImage = shopItems.items.find(i => i.image);
if (sampleWithImage) {
    console.log(`\n📷 Sample item with image:`);
    console.log(`   Name: ${sampleWithImage.name}`);
    console.log(`   Image: ${sampleWithImage.image}`);
}
