// Database Fix Script for Version Conflicts
// Run this in the browser console to fix database version issues

console.log('🔧 Starting database fix...');

async function fixDatabase() {
  try {
    // Step 1: Clear localStorage to remove any corrupted data
    console.log('Step 1: Clearing localStorage...');
    const keysToKeep = ['digibook_encrypted_pin', 'digibook_device_key'];
    const keysToRemove = Object.keys(localStorage).filter(key => 
      key.startsWith('digibook_') && !keysToKeep.includes(key)
    );
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`Removed: ${key}`);
    });
    
    // Step 2: Delete and recreate the database
    console.log('Step 2: Resetting database...');
    
    // Import the database helpers
    const { dbHelpers } = await import('./src/db/database-clean.js');
    
    // Reset the database
    await dbHelpers.resetDatabase();
    
    // Step 3: Initialize default data
    console.log('Step 3: Initializing default data...');
    await dbHelpers.initializeDefaultCategories();
    
    console.log('✅ Database fix completed successfully!');
    console.log('🔄 Please refresh the page to continue.');
    
    return true;
  } catch (error) {
    console.error('❌ Database fix failed:', error);
    console.log('🔄 Please refresh the page and try again.');
    return false;
  }
}

// Run the fix
fixDatabase().then(success => {
  if (success) {
    console.log('🎉 Database is now ready for testing!');
  } else {
    console.log('💥 Database fix failed. Please check the errors above.');
  }
});

// Alternative: Manual database clear (if the above fails)
function manualDatabaseClear() {
  console.log('🧹 Manual database clear...');
  
  // Clear all localStorage except PIN and device key
  const keysToKeep = ['digibook_encrypted_pin', 'digibook_device_key'];
  const allKeys = Object.keys(localStorage);
  
  allKeys.forEach(key => {
    if (!keysToKeep.includes(key)) {
      localStorage.removeItem(key);
      console.log(`Cleared: ${key}`);
    }
  });
  
  console.log('✅ Manual clear completed. Please refresh the page.');
}

// Export functions for manual use
window.fixDatabase = fixDatabase;
window.manualDatabaseClear = manualDatabaseClear;

console.log('📋 Available commands:');
console.log('- fixDatabase() - Full database reset');
console.log('- manualDatabaseClear() - Clear localStorage only');
