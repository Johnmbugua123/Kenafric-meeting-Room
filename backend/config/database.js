const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kenafric_booking',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Execute query with error handling
const executeQuery = async (query, params = []) => {
  try {
    const [results] = await pool.execute(query, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error.message);
    throw error;
  }
};

// Get single record
const getOne = async (query, params = []) => {
  const results = await executeQuery(query, params);
  return results[0] || null;
};

// Get multiple records
const getMany = async (query, params = []) => {
  return await executeQuery(query, params);
};

// Insert record and return ID
const insert = async (query, params = []) => {
  const result = await executeQuery(query, params);
  return result.insertId;
};

// Update records
const update = async (query, params = []) => {
  const result = await executeQuery(query, params);
  return result.affectedRows;
};

// Delete records
const deleteRecord = async (query, params = []) => {
  const result = await executeQuery(query, params);
  return result.affectedRows;
};

module.exports = {
  pool,
  testConnection,
  executeQuery,
  getOne,
  getMany,
  insert,
  update,
  deleteRecord
};