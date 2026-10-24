const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../node_modules/whatsapp-web.js/src/util/Injected/Utils.js');

if (fs.existsSync(targetPath)) {
  let content = fs.readFileSync(targetPath, 'utf8');
  if (!content.includes('delete message.__x_id;')) {
    content = content.replace(
      '// Bot\'s won\'t reply if canonicalUrl is set (linking)',
      'delete message.__x_id;\n\n        // Bot\'s won\'t reply if canonicalUrl is set (linking)'
    );
    fs.writeFileSync(targetPath, content, 'utf8');
    console.log('[patch-wwebjs] Successfully applied delete message.__x_id patch');
  } else {
    console.log('[patch-wwebjs] Patch already present');
  }
} else {
  console.log('[patch-wwebjs] whatsapp-web.js not found, skipping');
}
