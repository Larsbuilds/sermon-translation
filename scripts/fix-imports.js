#!/usr/bin/env node

/**
 * This script fixes TypeScript import statements for ESM compatibility
 * It adds .js extensions to relative imports that don't have extensions
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all TypeScript files in the src directory
const srcDir = path.resolve(__dirname, '../src');
const files = execSync(`find ${srcDir} -type f -name "*.ts"`)
  .toString()
  .trim()
  .split('\n');

// Regular expression to match relative imports without extensions
const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+[^;]+|[^;{]*)\s+from\s+['"](\.[^'"]*)['"]/g;

// Process each file
files.forEach(file => {
  if (!fs.existsSync(file)) return;
  
  const content = fs.readFileSync(file, 'utf8');
  let updated = content;
  let match;
  
  // Reset regex state
  importRegex.lastIndex = 0;
  
  // Process all imports in the file
  while ((match = importRegex.exec(content)) !== null) {
    const [fullImport, importPath] = match;
    
    // Skip if it already has an extension
    if (importPath.endsWith('.js') || importPath.endsWith('.ts')) {
      continue;
    }
    
    // Add .js extension (this will be the final extension when TS is compiled)
    const newImportPath = `${importPath}.js`;
    const newFullImport = fullImport.replace(`"${importPath}"`, `"${newImportPath}"`)
                                    .replace(`'${importPath}'`, `'${newImportPath}'`);
    
    // Replace the import in the updated content
    updated = updated.replace(fullImport, newFullImport);
  }
  
  // Write changes back to the file if there were any
  if (updated !== content) {
    console.log(`Fixing imports in ${file}`);
    fs.writeFileSync(file, updated, 'utf8');
  }
});

console.log('Import statements fixed for ESM compatibility.'); 