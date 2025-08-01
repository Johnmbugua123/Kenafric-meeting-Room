#!/usr/bin/env node

const axios = require('axios');
const chalk = require('chalk');

const BACKEND_URL = 'http://localhost:5000';
const FRONTEND_URL = 'http://localhost:3000';

async function testBackend() {
  console.log(chalk.blue('🔧 Testing Backend API...'));
  
  try {
    // Test health endpoint
    const healthResponse = await axios.get(`${BACKEND_URL}/api/health`);
    console.log(chalk.green('✅ Health check passed'));
    
    // Test login with default admin
    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'admin@kenafric.com',
      password: 'admin123'
    });
    
    if (loginResponse.data.token) {
      console.log(chalk.green('✅ Admin login successful'));
      
      const token = loginResponse.data.token;
      
      // Test authenticated endpoints
      const roomsResponse = await axios.get(`${BACKEND_URL}/api/rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (roomsResponse.data.rooms && roomsResponse.data.rooms.length > 0) {
        console.log(chalk.green(`✅ Rooms endpoint working (${roomsResponse.data.rooms.length} rooms found)`));
      } else {
        console.log(chalk.yellow('⚠️  No rooms found in database'));
      }
      
      // Test bookings endpoint
      const bookingsResponse = await axios.get(`${BACKEND_URL}/api/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log(chalk.green(`✅ Bookings endpoint working (${bookingsResponse.data.bookings.length} bookings found)`));
      
    } else {
      console.log(chalk.red('❌ Login failed - no token received'));
      return false;
    }
    
  } catch (error) {
    console.log(chalk.red('❌ Backend test failed:'), error.message);
    return false;
  }
  
  return true;
}

async function testFrontend() {
  console.log(chalk.blue('🌐 Testing Frontend...'));
  
  try {
    const response = await axios.get(FRONTEND_URL);
    
    if (response.status === 200) {
      console.log(chalk.green('✅ Frontend is accessible'));
      
      // Check if it's a React app by looking for typical patterns
      if (response.data.includes('React') || response.data.includes('root') || response.data.includes('noscript')) {
        console.log(chalk.green('✅ React app detected'));
      } else {
        console.log(chalk.yellow('⚠️  Frontend response doesn\'t look like a React app'));
      }
      
      return true;
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log(chalk.red('❌ Frontend not running - please start with "npm run frontend:dev"'));
    } else {
      console.log(chalk.red('❌ Frontend test failed:'), error.message);
    }
    return false;
  }
}

async function testDatabase() {
  console.log(chalk.blue('🗄️  Testing Database Connection...'));
  
  try {
    // Test database connection through backend
    const response = await axios.get(`${BACKEND_URL}/api/health`);
    
    if (response.data.status === 'OK') {
      console.log(chalk.green('✅ Database connection successful'));
      return true;
    } else {
      console.log(chalk.red('❌ Database health check failed'));
      return false;
    }
    
  } catch (error) {
    console.log(chalk.red('❌ Database test failed:'), error.message);
    return false;
  }
}

async function runTests() {
  console.log(chalk.bold.cyan('🚀 Kenafric Meeting Room Booking System - Health Check\n'));
  
  const backendOk = await testBackend();
  console.log('');
  
  const frontendOk = await testFrontend();
  console.log('');
  
  const dbOk = await testDatabase();
  console.log('');
  
  // Summary
  console.log(chalk.bold.cyan('📋 Test Summary:'));
  console.log(`Backend API: ${backendOk ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')}`);
  console.log(`Frontend: ${frontendOk ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')}`);
  console.log(`Database: ${dbOk ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')}`);
  
  if (backendOk && frontendOk && dbOk) {
    console.log(chalk.bold.green('\n🎉 All tests passed! System is ready to use.'));
    console.log(chalk.cyan('Frontend: http://localhost:3000'));
    console.log(chalk.cyan('Backend API: http://localhost:5000'));
    console.log(chalk.cyan('Default login: admin@kenafric.com / admin123'));
  } else {
    console.log(chalk.bold.red('\n❌ Some tests failed. Please check the issues above.'));
    
    if (!backendOk) {
      console.log(chalk.yellow('💡 To start backend: npm run backend:dev'));
    }
    if (!frontendOk) {
      console.log(chalk.yellow('💡 To start frontend: npm run frontend:dev'));
    }
    if (!dbOk) {
      console.log(chalk.yellow('💡 To initialize database: cd backend && npm run init-db'));
    }
  }
  
  process.exit(backendOk && frontendOk && dbOk ? 0 : 1);
}

// Install required packages if not present
async function installDependencies() {
  try {
    require('chalk');
  } catch (error) {
    console.log('Installing test dependencies...');
    const { execSync } = require('child_process');
    execSync('npm install chalk', { stdio: 'inherit' });
    console.log('Dependencies installed successfully!\n');
  }
}

if (require.main === module) {
  installDependencies().then(() => {
    runTests();
  }).catch(() => {
    runTests();
  });
}

module.exports = { testBackend, testFrontend, testDatabase };