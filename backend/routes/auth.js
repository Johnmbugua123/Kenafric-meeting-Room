const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { getOne, insert, update } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('employee_id').trim().isLength({ min: 3, max: 20 }).withMessage('Employee ID must be 3-20 characters'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('first_name').trim().isLength({ min: 1, max: 50 }).withMessage('First name required'),
  body('last_name').trim().isLength({ min: 1, max: 50 }).withMessage('Last name required'),
  body('department').trim().isLength({ min: 1, max: 50 }).withMessage('Department required')
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required')
];

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Register new user
router.post('/register', registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { employee_id, email, password, first_name, last_name, department, phone } = req.body;

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
      'INSERT INTO users (employee_id, email, password, first_name, last_name, department, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [employee_id, email, hashedPassword, first_name, last_name, department, phone]
    );

    // Get created user
    const newUser = await getOne(
      'SELECT id, employee_id, email, first_name, last_name, department, role FROM users WHERE id = ?',
      [userId]
    );

    // Generate token
    const token = generateToken(newUser);

    res.status(201).json({
      message: 'User registered successfully',
      user: newUser,
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await getOne(
      'SELECT id, employee_id, email, password, first_name, last_name, department, role, is_active FROM users WHERE email = ?',
      [email]
    );

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid credentials or inactive account' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Remove password from response
    delete user.password;

    // Generate token
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      user,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await getOne(
      'SELECT id, employee_id, email, first_name, last_name, department, role, phone, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({ user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, [
  body('first_name').optional().trim().isLength({ min: 1, max: 50 }),
  body('last_name').optional().trim().isLength({ min: 1, max: 50 }),
  body('department').optional().trim().isLength({ min: 1, max: 50 }),
  body('phone').optional().trim().isLength({ max: 20 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { first_name, last_name, department, phone } = req.body;
    const updateFields = {};
    const params = [];

    if (first_name) { updateFields.first_name = first_name; params.push(first_name); }
    if (last_name) { updateFields.last_name = last_name; params.push(last_name); }
    if (department) { updateFields.department = department; params.push(department); }
    if (phone !== undefined) { updateFields.phone = phone; params.push(phone); }

    if (params.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClause = Object.keys(updateFields).map(field => `${field} = ?`).join(', ');
    params.push(req.user.id);

    await update(`UPDATE users SET ${setClause} WHERE id = ?`, params);

    // Get updated user
    const updatedUser = await getOne(
      'SELECT id, employee_id, email, first_name, last_name, department, role, phone FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.put('/change-password', authenticateToken, [
  body('current_password').notEmpty().withMessage('Current password required'),
  body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { current_password, new_password } = req.body;

    // Get current password hash
    const user = await getOne('SELECT password FROM users WHERE id = ?', [req.user.id]);
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await update('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, req.user.id]);

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Verify token (for frontend authentication check)
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ 
    valid: true, 
    user: req.user 
  });
});

module.exports = router;