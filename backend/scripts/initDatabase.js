const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || ''
};

const DATABASE_NAME = process.env.DB_NAME || 'kenafric_booking';

async function initializeDatabase() {
  let connection;
  
  try {
    // Connect without specifying database
    connection = await mysql.createConnection(dbConfig);
    
    console.log('📦 Creating database and tables...');
    
    // Create database if it doesn't exist
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${DATABASE_NAME}`);
    await connection.execute(`USE ${DATABASE_NAME}`);
    
    // Users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        department VARCHAR(50) NOT NULL,
        role ENUM('admin', 'manager', 'staff') DEFAULT 'staff',
        phone VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Meeting rooms table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS meeting_rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(100) NOT NULL,
        capacity INT NOT NULL,
        description TEXT,
        features JSON,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Bookings table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        user_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        participants JSON,
        status ENUM('confirmed', 'cancelled', 'pending') DEFAULT 'confirmed',
        is_recurring BOOLEAN DEFAULT false,
        recurrence_pattern JSON,
        calendar_event_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES meeting_rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_room_time (room_id, start_time, end_time),
        INDEX idx_user_bookings (user_id, start_time)
      )
    `);
    
    // Booking notifications table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS booking_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        user_id INT NOT NULL,
        type ENUM('created', 'updated', 'cancelled', 'reminder') NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // System settings table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Database tables created successfully');
    
    // Insert default admin user
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await connection.execute(`
      INSERT IGNORE INTO users (employee_id, email, password, first_name, last_name, department, role) 
      VALUES ('ADM001', 'admin@kenafric.com', ?, 'System', 'Administrator', 'IT', 'admin')
    `, [hashedPassword]);
    
    // Insert sample meeting rooms
    await connection.execute(`
      INSERT IGNORE INTO meeting_rooms (name, location, capacity, description, features) VALUES
      ('Executive Boardroom', 'Executive Floor', 12, 'Premium boardroom with conference facilities', '["projector", "whiteboard", "conference_phone", "air_conditioning"]'),
      ('Conference Room A', 'Ground Floor', 8, 'Standard meeting room for departmental meetings', '["projector", "whiteboard", "air_conditioning"]'),
      ('Conference Room B', 'Ground Floor', 6, 'Small meeting room for team discussions', '["whiteboard", "air_conditioning"]'),
      ('Training Room', 'First Floor', 20, 'Large room for training sessions and presentations', '["projector", "sound_system", "whiteboard", "air_conditioning"]'),
      ('Innovation Hub', 'Second Floor', 10, 'Creative space for brainstorming sessions', '["smart_tv", "whiteboard", "standing_desks", "air_conditioning"]')
    `);
    
    // Insert default system settings
    await connection.execute(`
      INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES
      ('max_booking_duration', '4', 'Maximum booking duration in hours'),
      ('advance_booking_limit', '30', 'Maximum days in advance for booking'),
      ('email_notifications', 'true', 'Enable email notifications'),
      ('working_hours_start', '08:00', 'Office working hours start time'),
      ('working_hours_end', '18:00', 'Office working hours end time')
    `);
    
    console.log('✅ Sample data inserted successfully');
    console.log('🎉 Database initialization completed!');
    console.log(`📧 Default admin login: admin@kenafric.com / admin123`);
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run initialization
initializeDatabase();