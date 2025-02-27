// A process manager script that provides additional reliability
// beyond what Docker's restart policy offers
// This wraps the main application and restarts it if it crashes

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create log streams
const date = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(logsDir, `app-${date}.log`);
const errorLogFile = path.join(logsDir, `error-${date}.log`);
const outStream = fs.createWriteStream(logFile, { flags: 'a' });
const errorStream = fs.createWriteStream(errorLogFile, { flags: 'a' });

// Log function
function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}\n`;
  outStream.write(formattedMessage);
  console.log(message);
}

// Error log function
function errorLog(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ERROR: ${message}\n`;
  errorStream.write(formattedMessage);
  console.error(message);
}

// Function to start the application
function startApp() {
  log('Starting application...');
  
  // Path to the main application file
  const appPath = path.join(__dirname, 'src', 'index.js');
  
  // Spawn the application as a child process
  const app = spawn('node', [appPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });
  
  // Handle application output
  app.stdout.on('data', (data) => {
    outStream.write(data);
    process.stdout.write(data);
  });
  
  app.stderr.on('data', (data) => {
    errorStream.write(data);
    process.stderr.write(data);
  });
  
  // Handle application exit
  app.on('exit', (code, signal) => {
    if (code !== 0) {
      errorLog(`Application crashed with code ${code} and signal ${signal}`);
      errorLog('Restarting application in 5 seconds...');
      
      // Restart the application after a delay
      setTimeout(() => {
        startApp();
      }, 5000);
    } else {
      log('Application exited normally');
      process.exit(0);
    }
  });
  
  // Handle errors in spawning the process
  app.on('error', (err) => {
    errorLog(`Failed to start application: ${err.message}`);
    errorLog('Retrying in 5 seconds...');
    
    setTimeout(() => {
      startApp();
    }, 5000);
  });
  
  // Set up process event handlers
  process.on('SIGINT', () => {
    log('Received SIGINT. Shutting down gracefully...');
    app.kill('SIGINT');
    
    // Allow some time for graceful shutdown
    setTimeout(() => {
      log('Forcing shutdown...');
      process.exit(0);
    }, 5000);
  });
  
  process.on('SIGTERM', () => {
    log('Received SIGTERM. Shutting down gracefully...');
    app.kill('SIGTERM');
    
    // Allow some time for graceful shutdown
    setTimeout(() => {
      log('Forcing shutdown...');
      process.exit(0);
    }, 5000);
  });
  
  return app;
}

// Start the application
log('Process manager starting...');
startApp();