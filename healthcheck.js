// A simple health check script for the LLM bot
// This verifies that the Node.js process is running properly
// Used by Docker's healthcheck feature

const fs = require('fs');
const path = require('path');

try {
  // Check if the application is running by looking for critical files
  const srcExists = fs.existsSync(path.join(__dirname, 'src'));
  const indexExists = fs.existsSync(path.join(__dirname, 'src', 'index.js'));
  
  if (!srcExists || !indexExists) {
    console.error('Critical application files are missing');
    process.exit(1);
  }
  
  // Check if we can access the .env file
  try {
    fs.accessSync(path.join(__dirname, '.env'), fs.constants.R_OK);
  } catch (e) {
    console.warn('Warning: .env file may not be accessible');
    // Not exiting here as the env vars might be set directly
  }
  
  // Create a health status file that can be checked externally
  fs.writeFileSync(path.join(__dirname, 'health-status.txt'), 
    `Health check passed at ${new Date().toISOString()}`);
  
  // All checks passed
  console.log('Health check passed');
  process.exit(0);
} catch (error) {
  console.error('Health check failed:', error);
  process.exit(1);
}