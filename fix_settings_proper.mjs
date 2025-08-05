import fs from 'fs';

const filePath = 'src/pages/Settings.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find the line with the missing function and add it properly
const lines = content.split('\n');
const newLines = [];

for (let i = 0; i < lines.length; i++) {
  newLines.push(lines[i]);
  
  // After the handleExportJSON function ends, add the handleExportCSV function
  if (lines[i].includes('setIsExporting(false);') && lines[i+1] && lines[i+1].includes('setIsExporting(true);')) {
    newLines.push('  };');
    newLines.push('');
    newLines.push('  const handleExportCSV = async () => {');
  }
}

const newContent = newLines.join('\n');
fs.writeFileSync(filePath, newContent);
console.log('✅ Settings.jsx properly fixed!');
