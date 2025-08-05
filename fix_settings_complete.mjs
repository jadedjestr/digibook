import fs from 'fs';

const filePath = 'src/pages/Settings.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace the problematic section
content = content.replace(
  `  };
  };

    try {
      const data = await dbHelpers.exportData();`,
  `  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const data = await dbHelpers.exportData();`
);

fs.writeFileSync(filePath, content);
console.log('✅ Settings.jsx completely fixed!');
