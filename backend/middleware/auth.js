const jwt = require('jsonwebtoken');
const { getOne } = require('../config/database');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user details from database
    const user = await getOne(
      'SELECT id, employee_id, email, first_name, last_name, department, role, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Check if user has required role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Check if user is admin
const requireAdmin = requireRole(['admin']);

// Check if user is admin or manager
const requireManager = requireRole(['admin', 'manager']);

// Check if user can access resource (own resource or higher role)
const requireOwnershipOrRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has required role
    if (roles.includes(req.user.role)) {
      return next();
    }

    // Check if user owns the resource (userId parameter)
    const resourceUserId = req.params.userId || req.body.userId;
    if (resourceUserId && parseInt(resourceUserId) === req.user.id) {
      return next();
    }

    return res.status(403).json({ error: 'Access denied' });
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireManager,
  requireOwnershipOrRole
};