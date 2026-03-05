const fs = require('fs');
const path = require('path');

// Read all images from assets folder
const assetsDir = path.join(__dirname, 'src/renderer/assets/items');
const files = fs.readdirSync(assetsDir);

// Parse item info from filename: "item_id price display_name-.ext"
// or "display=name price id+.ext" for games
const items = [];
const games = [];

// Categories based on item names
const categoryMap = {
    'בית': 'buildings',
    'מגדל': 'buildings',
    'מבנה': 'buildings',
    'טירה': 'buildings',
    'טירת': 'buildings',
    'תחנת': 'buildings',
    'אוהל': 'buildings',
    'מאהל': 'buildings',
    'עץ': 'nature',
    'אבן': 'nature',
    'בול': 'nature',
    'קריסטל': 'nature',
    'פרח': 'nature',
    'לפיד': 'decorations',
    'מדורה': 'decorations',
    'אש': 'decorations',
    'תאורה': 'decorations',
    'מנורת': 'decorations',
    'דגל': 'decorations',
    'גדר': 'structures',
    'קיר': 'structures',
    'חומה': 'structures',
    'חומת': 'structures',
    'גשר': 'structures',
    'שער': 'structures',
    'עמוד': 'structures',
    'רצפה': 'structures',
    'שוק': 'market',
    'עגלה': 'market',
    'חבית': 'market',
    'באר': 'market',
    'קופסא': 'market',
    'תיבת': 'market',
    'שולחן': 'furniture',
    'כיסא': 'furniture',
    'ספסל': 'furniture',
    'כרכרה': 'furniture',
    'אולף': 'characters',
    'אלזה': 'characters',
    'הארי': 'characters',
    'האגריד': 'characters',
    'עידן': 'characters',
    'יוניקורן': 'characters',
    'חרב': 'weapons',
    'מגן': 'weapons',
    'חנית': 'weapons',
    'כלי_נשק': 'weapons',
    'מיינקראפט': 'minecraft',
    'קישוט': 'decorations',
    'שיבור': 'frozen',
    'מזרקה': 'frozen',
    'קפוא': 'frozen',
    'שלטי': 'decorations',
    'עשן': 'effects',
    'פויקה': 'effects'
};

function getCategory(itemId) {
    for (const [key, category] of Object.entries(categoryMap)) {
        if (itemId.includes(key)) {
            return category;
        }
    }
    return 'other';
}

files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) return;
    
    const nameWithoutExt = path.basename(file, ext);
    
    // Check if it's a game (has + at the end before extension)
    if (nameWithoutExt.endsWith('+')) {
        // Game format: "display=name price id+"
        // e.g., "איירון_מן 700 איש=הברזל+"
        const match = nameWithoutExt.match(/^(.+)\s+(\d+)\s+(.+)\+$/);
        if (match) {
            const displayName = match[3].replace(/=/g, ' ');
            const price = parseInt(match[2]);
            const id = match[1].replace(/=/g, '_').toLowerCase();
            games.push({
                id: id,
                name: displayName,
                price: price,
                image: file,
                category: 'games'
            });
        }
    } else if (nameWithoutExt.endsWith('-')) {
        // Item format: "item_id price display_name-"
        // e.g., "בית_3 20 בית_3-"
        const match = nameWithoutExt.match(/^(.+)\s+(\d+)\s+(.+)-$/);
        if (match) {
            const itemId = match[1];
            const price = parseInt(match[2]);
            const displayName = match[3].replace(/_/g, ' ');
            items.push({
                id: itemId,
                name: displayName,
                price: price,
                image: file,
                category: getCategory(itemId)
            });
        }
    }
});

// Sort items by category then by price
items.sort((a, b) => {
    if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
    }
    return a.price - b.price;
});

// Group by category
const categories = {};
items.forEach(item => {
    if (!categories[item.category]) {
        categories[item.category] = [];
    }
    categories[item.category].push(item);
});

console.log('\n========== SHOP ITEMS ==========\n');
console.log(`Total items found: ${items.length}`);
console.log(`Total games found: ${games.length}`);

console.log('\n--- Categories ---');
for (const [cat, catItems] of Object.entries(categories)) {
    console.log(`${cat}: ${catItems.length} items`);
}

// Generate JavaScript code for shop items
console.log('\n\n========== JAVASCRIPT CODE ==========\n');

console.log('const shopItems = {');
console.log('    games: [');
games.forEach((game, i) => {
    console.log(`        { id: '${game.id}', name: '${game.name}', price: ${game.price}, image: '${game.image}' }${i < games.length - 1 ? ',' : ''}`);
});
console.log('    ],');
console.log('    items: [');
items.forEach((item, i) => {
    console.log(`        { id: '${item.id}', name: '${item.name}', price: ${item.price}, image: '${item.image}', category: '${item.category}' }${i < items.length - 1 ? ',' : ''}`);
});
console.log('    ]');
console.log('};');

// Save to JSON file for easy import
const output = { games, items, categories: Object.keys(categories) };
fs.writeFileSync(path.join(__dirname, 'shop-items-data.json'), JSON.stringify(output, null, 2), 'utf8');
console.log('\n✅ Saved to shop-items-data.json');
