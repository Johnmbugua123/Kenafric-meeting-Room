const express = require('express');
const { getOne, getMany } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get system dashboard statistics
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get overall statistics
    const totalUsers = await getOne('SELECT COUNT(*) as count FROM users WHERE is_active = true');
    const totalRooms = await getOne('SELECT COUNT(*) as count FROM meeting_rooms WHERE is_active = true');
    const totalBookings = await getOne('SELECT COUNT(*) as count FROM bookings WHERE status = "confirmed"');
    const todayBookings = await getOne(
      'SELECT COUNT(*) as count FROM bookings WHERE DATE(start_time) = CURDATE() AND status = "confirmed"'
    );

    // Get booking trends (last 7 days)
    const bookingTrends = await getMany(
      `SELECT DATE(start_time) as date, COUNT(*) as bookings
       FROM bookings 
       WHERE start_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       AND status = 'confirmed'
       GROUP BY DATE(start_time)
       ORDER BY date`
    );

    // Get room utilization
    const roomUtilization = await getMany(
      `SELECT r.name, r.capacity, COUNT(b.id) as total_bookings,
              AVG(TIMESTAMPDIFF(HOUR, b.start_time, b.end_time)) as avg_duration
       FROM meeting_rooms r
       LEFT JOIN bookings b ON r.id = b.room_id 
         AND b.start_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         AND b.status = 'confirmed'
       WHERE r.is_active = true
       GROUP BY r.id
       ORDER BY total_bookings DESC`
    );

    // Get department usage
    const departmentUsage = await getMany(
      `SELECT u.department, COUNT(b.id) as bookings
       FROM users u
       LEFT JOIN bookings b ON u.id = b.user_id 
         AND b.start_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         AND b.status = 'confirmed'
       WHERE u.is_active = true
       GROUP BY u.department
       ORDER BY bookings DESC
       LIMIT 10`
    );

    // Get top users
    const topUsers = await getMany(
      `SELECT CONCAT(u.first_name, ' ', u.last_name) as name, 
              u.department, COUNT(b.id) as bookings
       FROM users u
       LEFT JOIN bookings b ON u.id = b.user_id 
         AND b.start_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         AND b.status = 'confirmed'
       WHERE u.is_active = true
       GROUP BY u.id
       HAVING bookings > 0
       ORDER BY bookings DESC
       LIMIT 10`
    );

    res.json({
      summary: {
        total_users: totalUsers.count,
        total_rooms: totalRooms.count,
        total_bookings: totalBookings.count,
        today_bookings: todayBookings.count
      },
      booking_trends: bookingTrends,
      room_utilization: roomUtilization.map(room => ({
        ...room,
        avg_duration: parseFloat(room.avg_duration || 0).toFixed(2)
      })),
      department_usage: departmentUsage,
      top_users: topUsers
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Generate detailed reports
router.get('/reports/usage', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { start_date, end_date, room_id, department } = req.query;

    let dateFilter = '';
    let roomFilter = '';
    let departmentFilter = '';
    const params = [];

    if (start_date && end_date) {
      dateFilter = 'AND DATE(b.start_time) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    } else {
      // Default to last 30 days
      dateFilter = 'AND b.start_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    }

    if (room_id) {
      roomFilter = 'AND b.room_id = ?';
      params.push(room_id);
    }

    if (department) {
      departmentFilter = 'AND u.department = ?';
      params.push(department);
    }

    // Detailed booking report
    const detailedReport = await getMany(
      `SELECT b.id, b.title, b.start_time, b.end_time, b.status,
              TIMESTAMPDIFF(HOUR, b.start_time, b.end_time) as duration_hours,
              r.name as room_name, r.location,
              CONCAT(u.first_name, ' ', u.last_name) as user_name,
              u.department, u.employee_id
       FROM bookings b
       JOIN meeting_rooms r ON b.room_id = r.id
       JOIN users u ON b.user_id = u.id
       WHERE 1=1 ${dateFilter} ${roomFilter} ${departmentFilter}
       ORDER BY b.start_time DESC`,
      params
    );

    // Summary statistics
    const summary = await getOne(
      `SELECT 
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_bookings,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
        AVG(TIMESTAMPDIFF(HOUR, start_time, end_time)) as avg_duration,
        SUM(TIMESTAMPDIFF(HOUR, start_time, end_time)) as total_hours
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       WHERE 1=1 ${dateFilter} ${roomFilter} ${departmentFilter}`,
      params
    );

    res.json({
      period: { start_date, end_date },
      filters: { room_id, department },
      summary: {
        ...summary,
        avg_duration: parseFloat(summary.avg_duration || 0).toFixed(2),
        total_hours: parseInt(summary.total_hours || 0)
      },
      bookings: detailedReport
    });

  } catch (error) {
    console.error('Usage report error:', error);
    res.status(500).json({ error: 'Failed to generate usage report' });
  }
});

// Get room efficiency report
router.get('/reports/efficiency', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const params = [];

    if (start_date && end_date) {
      dateFilter = 'AND DATE(b.start_time) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    } else {
      dateFilter = 'AND b.start_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    }

    const efficiency = await getMany(
      `SELECT 
        r.id, r.name, r.location, r.capacity,
        COUNT(b.id) as total_bookings,
        SUM(TIMESTAMPDIFF(HOUR, b.start_time, b.end_time)) as total_hours_booked,
        AVG(TIMESTAMPDIFF(HOUR, b.start_time, b.end_time)) as avg_booking_duration,
        COUNT(DISTINCT DATE(b.start_time)) as days_used,
        (COUNT(b.id) / NULLIF(COUNT(DISTINCT DATE(b.start_time)), 0)) as avg_bookings_per_day
       FROM meeting_rooms r
       LEFT JOIN bookings b ON r.id = b.room_id 
         AND b.status = 'confirmed' ${dateFilter}
       WHERE r.is_active = true
       GROUP BY r.id
       ORDER BY total_bookings DESC`,
      params
    );

    // Calculate efficiency metrics
    const efficiencyWithMetrics = efficiency.map(room => {
      const utilization = room.days_used ? (room.total_hours_booked / (room.days_used * 8)) * 100 : 0; // Assuming 8-hour workday
      
      return {
        ...room,
        avg_booking_duration: parseFloat(room.avg_booking_duration || 0).toFixed(2),
        avg_bookings_per_day: parseFloat(room.avg_bookings_per_day || 0).toFixed(2),
        utilization_percentage: Math.min(utilization, 100).toFixed(2),
        efficiency_score: room.total_bookings > 0 ? 
          Math.min((room.total_bookings * parseFloat(room.avg_booking_duration || 0)) / room.capacity, 100).toFixed(2) : 
          '0.00'
      };
    });

    res.json({
      period: { start_date, end_date },
      rooms: efficiencyWithMetrics
    });

  } catch (error) {
    console.error('Efficiency report error:', error);
    res.status(500).json({ error: 'Failed to generate efficiency report' });
  }
});

// Get system settings
router.get('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await getMany(
      'SELECT setting_key, setting_value, description FROM system_settings ORDER BY setting_key'
    );

    const settingsObject = {};
    settings.forEach(setting => {
      settingsObject[setting.setting_key] = {
        value: setting.setting_value,
        description: setting.description
      };
    });

    res.json({ settings: settingsObject });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update system settings
router.put('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object required' });
    }

    const { update } = require('../config/database');

    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      await update(
        'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
        [value, key]
      );
    }

    res.json({ message: 'Settings updated successfully' });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get system health status
router.get('/health', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Check database connectivity
    const dbCheck = await getOne('SELECT 1 as status');
    
    // Get system metrics
    const systemMetrics = {
      database_status: dbCheck ? 'healthy' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    };

    res.json({
      status: 'healthy',
      metrics: systemMetrics
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Export data (bookings, users, rooms)
router.get('/export/:type', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const { start_date, end_date } = req.query;

    let data = [];
    let filename = '';

    switch (type) {
      case 'bookings':
        let dateFilter = '';
        const params = [];
        
        if (start_date && end_date) {
          dateFilter = 'WHERE DATE(b.start_time) BETWEEN ? AND ?';
          params.push(start_date, end_date);
        }

        data = await getMany(
          `SELECT b.id, b.title, b.description, b.start_time, b.end_time, b.status,
                  r.name as room_name, r.location,
                  CONCAT(u.first_name, ' ', u.last_name) as user_name,
                  u.employee_id, u.department, u.email
           FROM bookings b
           JOIN meeting_rooms r ON b.room_id = r.id
           JOIN users u ON b.user_id = u.id
           ${dateFilter}
           ORDER BY b.start_time DESC`,
          params
        );
        filename = `bookings_export_${new Date().toISOString().split('T')[0]}.json`;
        break;

      case 'users':
        data = await getMany(
          `SELECT id, employee_id, email, first_name, last_name, department, role,
                  phone, is_active, created_at
           FROM users
           ORDER BY first_name, last_name`
        );
        filename = `users_export_${new Date().toISOString().split('T')[0]}.json`;
        break;

      case 'rooms':
        data = await getMany(
          `SELECT id, name, location, capacity, description, features, is_active, created_at
           FROM meeting_rooms
           ORDER BY name`
        );
        // Parse JSON features for export
        data = data.map(room => ({
          ...room,
          features: room.features ? JSON.parse(room.features) : []
        }));
        filename = `rooms_export_${new Date().toISOString().split('T')[0]}.json`;
        break;

      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json({
      export_type: type,
      export_date: new Date().toISOString(),
      count: data.length,
      data: data
    });

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;