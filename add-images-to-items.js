const fs = require('fs');
const path = require('path');

const mainJsPath = path.join(__dirname, 'src', 'main.js');
let content = fs.readFileSync(mainJsPath, 'utf8');

// Map of item IDs to their image files
const imageMapping = {
    // Buildings
    'בית_3': 'byt_3.png',
    'בית_4': 'byt_4.png',
    'בית_שווה': 'byt_shvvh.png',
    'מבנה_קפוא': 'mbnh_kpva.png',
    'תחנת_חשמל_קפואה': 'tchnt_chshml_kpvah.png',
    'תחנת_רוח': 'tchnt_rvch.png',
    // Nature
    'עץ': 'atz.png',
    'עץ_שלג_2': 'atz_shlg_2.png',
    'אבן': 'abn.png',
    'אבן_2': 'abn_2.png',
    'בול_עץ': 'bvl_atz.png',
    // Decorations
    'לפיד': 'lpyd.png',
    'לפיד_קרח': 'lpyd_krch.png',
    'מדורה': 'mdvrh.png',
    'אש_ירוקה': 'ash_yrvkh.png',
    'תאורה': 'tavrh.png',
    'תאורה_כתומה': 'tavrh_ktvmh.png',
    'מנורת_רחוב_2': 'mnvrt_rchvb_2.png',
    // Structures
    'גשר': 'gshr.png',
    'גדר': 'gdr.png',
    'קיר': 'kyr.png',
    'חומת_טירה': 'chvmt_tyrh.png',
    'חומת_טירה_2': 'chvmt_tyrh_2.png',
    // Market
    'שוק': 'shvk.png',
    'שוק_2': 'shvk_2.png',
    'שוק_3': 'shvk_3.png',
    'עגלה': 'aglh.png',
    'חבית': 'chbyt.png',
    'באר': 'bar.png',
    'באר_2': 'bar_2.png',
    // Special
    'אולף': 'avlf.png',
    'אלזה': 'alzh.png',
    'פויקה': 'pvykh.png',
    'כלי_נשק': 'kly_nshk.png',
    'דגל_הוגוורטס': 'dgl_hvgvvrts.jpg',
    'דגל_של_גריפינדור': 'dgl_shl_grypyndvr.jpg',
    // Photos
    'אליה': 'alyh.jpg',
    'צורי_ואליה': 'tzvry_valyh.jpg'
};

// Add image property to each item in the items array
for (const [itemId, imageFile] of Object.entries(imageMapping)) {
    // Match pattern: { id: 'itemId', ...anything... }
    const regex = new RegExp(`(\\{ id: '${itemId}', name: '[^']+', price: \\d+, icon: '[^']+')`, 'g');
    content = content.replace(regex, `$1, image: '${imageFile}'`);
}

// Also fix the broken unicode characters
content = content.replace(/icon: '�️'/g, "icon: '💨'");
content = content.replace(/icon: '�'/g, "icon: '🏰'");

fs.writeFileSync(mainJsPath, content, 'utf8');
console.log('✅ Updated main.js with image paths for all items');
