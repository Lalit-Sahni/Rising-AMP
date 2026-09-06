const fs = require('fs');
const path = require('path');

// Bundle analysis script
function analyzeBundle() {
  const buildPath = path.join(__dirname, '..', 'build', 'static', 'js');
  
  if (!fs.existsSync(buildPath)) {
    console.log('❌ Build directory not found. Run "npm run build" first.');
    return;
  }

  const files = fs.readdirSync(buildPath);
  const jsFiles = files.filter(file => file.endsWith('.js'));
  
  console.log('📊 Bundle Analysis Report');
  console.log('========================\n');
  
  let totalSize = 0;
  const fileSizes = [];
  
  jsFiles.forEach(file => {
    const filePath = path.join(buildPath, file);
    const stats = fs.statSync(filePath);
    const sizeInKB = (stats.size / 1024).toFixed(2);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    fileSizes.push({
      name: file,
      size: stats.size,
      sizeKB: sizeInKB,
      sizeMB: sizeInMB
    });
    
    totalSize += stats.size;
  });
  
  // Sort by size (largest first)
  fileSizes.sort((a, b) => b.size - a.size);
  
  console.log('📁 Bundle Files:');
  fileSizes.forEach(file => {
    const icon = file.size > 500 * 1024 ? '🔴' : file.size > 200 * 1024 ? '🟡' : '🟢';
    console.log(`${icon} ${file.name}: ${file.sizeKB} KB (${file.sizeMB} MB)`);
  });
  
  console.log('\n📈 Summary:');
  console.log(`Total Bundle Size: ${(totalSize / 1024).toFixed(2)} KB (${(totalSize / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`Number of Files: ${jsFiles.length}`);
  
  // Recommendations
  console.log('\n💡 Optimization Recommendations:');
  
  const largeFiles = fileSizes.filter(file => file.size > 500 * 1024);
  if (largeFiles.length > 0) {
    console.log('🔴 Large files detected:');
    largeFiles.forEach(file => {
      console.log(`   - ${file.name} (${file.sizeKB} KB)`);
    });
    console.log('   Consider: Code splitting, lazy loading, or removing unused dependencies');
  }
  
  if (jsFiles.length > 5) {
    console.log('🟡 Many bundle files detected:');
    console.log('   Consider: Consolidating chunks or adjusting splitChunks configuration');
  }
  
  if (totalSize > 2 * 1024 * 1024) { // 2MB
    console.log('🔴 Bundle size is large (>2MB):');
    console.log('   Consider: Tree shaking, removing unused code, or implementing lazy loading');
  } else if (totalSize > 1 * 1024 * 1024) { // 1MB
    console.log('🟡 Bundle size is moderate (>1MB):');
    console.log('   Consider: Code splitting for better initial load performance');
  } else {
    console.log('🟢 Bundle size is good (<1MB)');
  }
  
  // Check for common optimization opportunities
  console.log('\n🔍 Additional Checks:');
  
  // Check if vendor bundle is too large
  const vendorFile = fileSizes.find(file => file.name.includes('vendors'));
  if (vendorFile && vendorFile.size > 1 * 1024 * 1024) {
    console.log('🟡 Vendor bundle is large:');
    console.log('   Consider: Splitting vendor chunks or using dynamic imports');
  }
  
  // Check for duplicate dependencies
  console.log('   Run "npm ls" to check for duplicate dependencies');
  console.log('   Consider: Using "npm dedupe" to remove duplicates');
  
  console.log('\n✅ Analysis complete!');
}

// Run analysis
analyzeBundle(); 