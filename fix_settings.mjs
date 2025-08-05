import fs from 'fs';

const filePath = 'src/pages/Settings.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add the missing function declaration
content = content.replace(
  '  };',
  '  };\n\n  const handleExportCSV = async () => {'
);

fs.writeFileSync(filePath, content);
console.log('✅ Settings.jsx fixed!');
