const fs = require('fs');
const path = require('path');
const Store = require('electron-store');

// Image mapping for items with special names or games
const manualImageMapping = {
    // Fix Olaf
    'אולף': 'avlf.png',
    
    // Games
    'פרוזה': 'prvzh.jpg',
    'פורזה הורייזון 5': 'prvzh.jpg',
    'הבדלים': 'mtzaathhbdlym_500_hbdlymjpg.jpg',
    'משחק ציור': 'mshchk_tzyvr_99999_mshchk_tzyvrpng.png',
    'דריפט': 'yryvtamdrypt_1000_dryptjpg.jpg',
    'איש הברזל': 'ayyrvn_mn_700_ayshhbrzljpg.jpg',
    'אנליסטד': 'mshchkyryvt_99999_anlystdjpg.jpg',
    
    // Items without matching images - will use emoji fallback
    'אספלט 9': null,
    'איש העטלף': null,
    'רד דד רידמשן 2': null,
    'איש העכביש': null,
};

// Files to update
const files = [
    path.join(__dirname, 'shop-items-data.json'),
    path.join(__dirname, 'src', 'shop-items-data.json')
];

for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
        console.log('Skipping (not found):', filePath);
        continue;
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Update items
    for (const item of data.items || []) {
        if (manualImageMapping[item.name] !== undefined) {
            if (manualImageMapping[item.name]) {
                item.image = manualImageMapping[item.name];
                console.log(`Fixed: ${item.name} -> ${item.image}`);
            } else {
                item.image = null;
                console.log(`No image for: ${item.name}`);
            }
        }
    }
    
    // Update games
    for (const game of data.games || []) {
        if (manualImageMapping[game.name] !== undefined) {
            if (manualImageMapping[game.name]) {
                game.image = manualImageMapping[game.name];
                console.log(`Fixed game: ${game.name} -> ${game.image}`);
            } else {
                game.image = null;
                console.log(`No image for game: ${game.name}`);
            }
        }
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log('Updated:', filePath);
}

// Update electron store
const store = new Store({ name: 'game-manager-data' });
const shopItems = store.get('shopItems', {});

// Update items in store
for (const item of shopItems.items || []) {
    if (manualImageMapping[item.name] !== undefined) {
        item.image = manualImageMapping[item.name];
    }
}

// Update games in store
for (const game of shopItems.games || []) {
    if (manualImageMapping[game.name] !== undefined) {
        game.image = manualImageMapping[game.name];
    }
}

store.set('shopItems', shopItems);
console.log('\n✅ Updated electron store');
