const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { getOne, getMany, insert, update } = require('../config/database');
const { authenticateToken, requireManager, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all users (Manager/Admin only)
router.get('/', authenticateToken, requireManager, async (req, res) => {
  try {
    const { department, role, status, search } = req.query;
    let query = `
      SELECT id, employee_id, email, first_name, last_name, department, role, 
             phone, is_active, created_at
      FROM users 
      WHERE 1=1
    `;
    const params = [];

    if (department) {
      query += ' AND department = ?';
      params.push(department);
    }

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    if (status === 'active') {
      query += ' AND is_active = true';
    } else if (status === 'inactive') {
      query += ' AND is_active = false';
    }

    if (search) {
      query += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR employee_id LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY first_name, last_name';

    const users = await getMany(query, params);
    res.json({ users });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID (Manager/Admin only)
router.get('/:id', authenticateToken, requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await getOne(
      'SELECT id, employee_id, email, first_name, last_name, department, role, phone, is_active, created_at FROM users WHERE id = ?',
      [id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user (Admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('employee_id').trim().isLength({ min: 3, max: 20 }).withMessage('Employee ID must be 3-20 characters'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('first_name').trim().isLength({ min: 1, max: 50 }).withMessage('First name required'),
  body('last_name').trim().isLength({ min: 1, max: 50 }).withMessage('Last name required'),
  body('department').trim().isLength({ min: 1, max: 50 }).withMessage('Department required'),
  body('role').isIn(['admin', 'manager', 'staff']).withMessage('Valid role required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { employee_id, email, password, first_name, last_name, department, role, phone } = req.body;

    // Check if user already exists
    const existingUser = await getOne(
      'SELECT id FROM users WHERE email = ? OR employee_id = ?',
      [email, employee_id]
    );

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or employee ID already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const userId = await insert(
      'INSERT INTO users (employee_id, email, password, first_name, last_name, department, role, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [employee_id, email, hashedPassword, first_name, last_name, department, role, phone]
    );

    // Get created user (without password)
    const newUser = await getOne(
      'SELECT id, employee_id, email, first_name, last_name, department, role, phone, is_active, created_at FROM users WHERE id = ?',
      [userId]
    );

    res.status(201).json({
      message: 'User created successfully',
      user: newUser
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (Admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('employee_id').optional().trim().isLength({ min: 3, max: 20 }),
  body('email').optional().isEmail(),
  body('first_name').optional().trim().isLength({ min: 1, max: 50 }),
  body('last_name').optional().trim().isLength({ min: 1, max: 50 }),
  body('department').optional().trim().isLength({ min: 1, max: 50 }),
  body('role').optional().isIn(['admin', 'manager', 'staff']),
  body('phone').optional().trim().isLength({ max: 20 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { employee_id, email, first_name, last_name, department, role, phone } = req.body;

    // Check if user exists
    const existingUser = await getOne('SELECT id FROM users WHERE id = ?', [id]);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check for conflicts if email or employee_id is being updated
    if (email || employee_id) {
      const conflictQuery = 'SELECT id FROM users WHERE (email = ? OR employee_id = ?) AND id != ?';
      const conflict = await getOne(conflictQuery, [email || '', employee_id || '', id]);
      
      if (conflict) {
        return res.status(400).json({ error: 'Email or employee ID already exists' });
      }
    }

    // Build update query dynamically
    const updateFields = {};
    const params = [];

    if (employee_id !== undefined) { updateFields.employee_id = employee_id; params.push(employee_id); }
    if (email !== undefined) { updateFields.email = email; params.push(email); }
    if (first_name !== undefined) { updateFields.first_name = first_name; params.push(first_name); }
    if (last_name !== undefined) { updateFields.last_name = last_name; params.push(last_name); }
    if (department !== undefined) { updateFields.department = department; params.push(department); }
    if (role !== undefined) { updateFields.role = role; params.push(role); }
    if (phone !== undefined) { updateFields.phone = phone; params.push(phone); }

    if (params.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClause = Object.keys(updateFields).map(field => `${field} = ?`).join(', ');
    params.push(id);

    await update(`UPDATE users SET ${setClause} WHERE id = ?`, params);

    // Get updated user
    const updatedUser = await getOne(
      'SELECT id, employee_id, email, first_name, last_name, department, role, phone, is_active, created_at FROM users WHERE id = ?',
      [id]
    );

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Reset user password (Admin only)
router.post('/:id/reset-password', authenticateToken, requireAdmin, [
  body('new_password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { new_password } = req.body;

    // Check if user exists
    const user = await getOne('SELECT id, first_name, last_name FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await update('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);

    res.json({ 
      message: 'Password reset successfully',
      user_name: `${user.first_name} ${user.last_name}`
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Activate/Deactivate user (Admin only)
router.patch('/:id/status', authenticateToken, requireAdmin, [
  body('is_active').isBoolean().withMessage('is_active must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { is_active } = req.body;

    // Check if user exists
    const user = await getOne('SELECT id, first_name, last_name, is_active FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from deactivating themselves
    if (parseInt(id) === req.user.id && !is_active) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    // Update status
    await update('UPDATE users SET is_active = ? WHERE id = ?', [is_active, id]);

    res.json({
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
      user_name: `${user.first_name} ${user.last_name}`,
      new_status: is_active
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Get user statistics (Manager/Admin only)
router.get('/:id/stats', authenticateToken, requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    // Check if user exists
    const user = await getOne(
      'SELECT id, first_name, last_name, department FROM users WHERE id = ?',
      [id]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let dateFilter = '';
    const params = [id];

    if (start_date && end_date) {
      dateFilter = 'AND DATE(start_time) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    } else if (start_date) {
      dateFilter = 'AND DATE(start_time) >= ?';
      params.push(start_date);
    } else if (end_date) {
      dateFilter = 'AND DATE(start_time) <= ?';
      params.push(end_date);
    }

    // Get booking statistics
    const stats = await getOne(
      `SELECT 
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_bookings,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
        AVG(TIMESTAMPDIFF(HOUR, start_time, end_time)) as avg_duration_hours
       FROM bookings 
       WHERE user_id = ? ${dateFilter}`,
      params
    );

    // Get favorite rooms
    const favoriteRooms = await getMany(
      `SELECT r.name, r.location, COUNT(*) as usage_count
       FROM bookings b
       JOIN meeting_rooms r ON b.room_id = r.id
       WHERE b.user_id = ? ${dateFilter} AND b.status = 'confirmed'
       GROUP BY b.room_id
       ORDER BY usage_count DESC
       LIMIT 5`,
      params
    );

    res.json({
      user: {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        department: user.department
      },
      period: { start_date, end_date },
      statistics: {
        ...stats,
        avg_duration_hours: parseFloat(stats.avg_duration_hours || 0).toFixed(2)
      },
      favorite_rooms: favoriteRooms
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

// Get departments list
router.get('/lookup/departments', authenticateToken, async (req, res) => {
  try {
    const departments = await getMany(
      'SELECT DISTINCT department FROM users WHERE is_active = true ORDER BY department'
    );

    res.json({ 
      departments: departments.map(d => d.department) 
    });

  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

module.exports = router;