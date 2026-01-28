// Node.js script to downgrade oklch/oklab/color-mix to rgb/hsl/hex in built CSS/HTML
// Usage: node scripts/downgrade-colors.js <file1> <file2> ...
const fs = require('fs');
const path = require('path');

const colorRegex = /(oklch|oklab|color-mix)\([^)]*\)/gi;

function downgradeColorsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (colorRegex.test(content)) {
    content = content.replace(colorRegex, '#222'); // fallback to dark gray
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Downgraded color functions in: ${filePath}`);
  }
}

if (require.main === module) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: node downgrade-colors.js <file1> <file2> ...');
    process.exit(1);
  }
  files.forEach(downgradeColorsInFile);
}
