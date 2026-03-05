const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'src/renderer/assets/items');
const files = fs.readdirSync(assetsDir);

// Create a mapping file for old name -> new name
const mapping = {};

files.forEach((file, index) => {
    const ext = path.extname(file).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) return;
    
    // Extract item ID from filename
    const nameWithoutExt = path.basename(file, ext);
    let itemId;
    
    if (nameWithoutExt.endsWith('+')) {
        // Game format: "display=name price id+"
        const match = nameWithoutExt.match(/^(.+)\s+\d+\s+.+\+$/);
        if (match) itemId = match[1].replace(/=/g, '_');
    } else if (nameWithoutExt.endsWith('-')) {
        // Item format: "item_id price display_name-"
        const match = nameWithoutExt.match(/^(.+)\s+\d+\s+.+-$/);
        if (match) itemId = match[1];
    }
    
    if (!itemId) {
        console.log('Could not parse:', file);
        return;
    }
    
    // Create simple filename: item_id.ext
    const newName = `${itemId}${ext}`;
    const oldPath = path.join(assetsDir, file);
    const newPath = path.join(assetsDir, newName);
    
    // Skip if already renamed
    if (file === newName) return;
    
    // Check if new name already exists
    if (fs.existsSync(newPath)) {
        console.log(`Skipping ${file} - ${newName} already exists`);
        return;
    }
    
    try {
        fs.renameSync(oldPath, newPath);
        mapping[file] = newName;
        console.log(`Renamed: ${file} -> ${newName}`);
    } catch (e) {
        console.error(`Failed to rename ${file}:`, e.message);
    }
});

console.log(`\n✅ Renamed ${Object.keys(mapping).length} files`);

// Now update the store with new image names
const Store = require('electron-store');
const store = new Store({ name: 'game-manager-data' });

const shopItems = store.get('shopItems');
if (shopItems && shopItems.items) {
    shopItems.items = shopItems.items.map(item => {
        if (item.image) {
            // Update image name to simple format
            const ext = path.extname(item.image).toLowerCase();
            item.image = `${item.id}${ext}`;
        }
        return item;
    });
    store.set('shopItems', shopItems);
    console.log('✅ Updated store with new image names');
}
