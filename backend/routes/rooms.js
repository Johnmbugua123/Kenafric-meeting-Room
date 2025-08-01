const express = require('express');
const { body, validationResult } = require('express-validator');
const { getOne, getMany, insert, update, deleteRecord } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const roomValidation = [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Room name is required'),
  body('location').trim().isLength({ min: 1, max: 100 }).withMessage('Location is required'),
  body('capacity').isInt({ min: 1, max: 100 }).withMessage('Capacity must be between 1-100'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description too long'),
  body('features').optional().isArray().withMessage('Features must be an array')
];

// Get all active rooms
router.get('/', authenticateToken, async (req, res) => {
  try {
    const rooms = await getMany(
      'SELECT id, name, location, capacity, description, features, created_at FROM meeting_rooms WHERE is_active = true ORDER BY name'
    );

    // Parse JSON features
    const roomsWithFeatures = rooms.map(room => ({
      ...room,
      features: room.features ? JSON.parse(room.features) : []
    }));

    res.json({ rooms: roomsWithFeatures });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Get room by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const room = await getOne(
      'SELECT id, name, location, capacity, description, features, is_active, created_at FROM meeting_rooms WHERE id = ?',
      [id]
    );

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Parse JSON features
    room.features = room.features ? JSON.parse(room.features) : [];

    res.json({ room });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Get room availability for a specific date
router.get('/:id/availability', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter required' });
    }

    // Verify room exists
    const room = await getOne('SELECT id, name FROM meeting_rooms WHERE id = ? AND is_active = true', [id]);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Get bookings for the specified date
    const bookings = await getMany(
      `SELECT id, title, start_time, end_time, 
              CONCAT(u.first_name, ' ', u.last_name) as booked_by
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       WHERE b.room_id = ? 
       AND DATE(b.start_time) = ? 
       AND b.status = 'confirmed'
       ORDER BY b.start_time`,
      [id, date]
    );

    res.json({
      room,
      date,
      bookings: bookings.map(booking => ({
        id: booking.id,
        title: booking.title,
        start_time: booking.start_time,
        end_time: booking.end_time,
        booked_by: booking.booked_by
      }))
    });

  } catch (error) {
    console.error('Get room availability error:', error);
    res.status(500).json({ error: 'Failed to fetch room availability' });
  }
});

// Create new room (Admin only)
router.post('/', authenticateToken, requireAdmin, roomValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, location, capacity, description, features } = req.body;

    // Check if room name already exists
    const existingRoom = await getOne(
      'SELECT id FROM meeting_rooms WHERE name = ? AND is_active = true',
      [name]
    );

    if (existingRoom) {
      return res.status(400).json({ error: 'Room with this name already exists' });
    }

    // Insert new room
    const roomId = await insert(
      'INSERT INTO meeting_rooms (name, location, capacity, description, features) VALUES (?, ?, ?, ?, ?)',
      [name, location, capacity, description || null, JSON.stringify(features || [])]
    );

    // Get created room
    const newRoom = await getOne(
      'SELECT id, name, location, capacity, description, features, created_at FROM meeting_rooms WHERE id = ?',
      [roomId]
    );

    // Parse JSON features
    newRoom.features = newRoom.features ? JSON.parse(newRoom.features) : [];

    res.status(201).json({
      message: 'Room created successfully',
      room: newRoom
    });

  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Update room (Admin only)
router.put('/:id', authenticateToken, requireAdmin, roomValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, location, capacity, description, features } = req.body;

    // Check if room exists
    const existingRoom = await getOne('SELECT id FROM meeting_rooms WHERE id = ?', [id]);
    if (!existingRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if name is taken by another room
    const nameConflict = await getOne(
      'SELECT id FROM meeting_rooms WHERE name = ? AND id != ? AND is_active = true',
      [name, id]
    );

    if (nameConflict) {
      return res.status(400).json({ error: 'Room name already exists' });
    }

    // Update room
    await update(
      'UPDATE meeting_rooms SET name = ?, location = ?, capacity = ?, description = ?, features = ? WHERE id = ?',
      [name, location, capacity, description || null, JSON.stringify(features || []), id]
    );

    // Get updated room
    const updatedRoom = await getOne(
      'SELECT id, name, location, capacity, description, features, created_at FROM meeting_rooms WHERE id = ?',
      [id]
    );

    // Parse JSON features
    updatedRoom.features = updatedRoom.features ? JSON.parse(updatedRoom.features) : [];

    res.json({
      message: 'Room updated successfully',
      room: updatedRoom
    });

  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// Soft delete room (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if room exists
    const room = await getOne('SELECT id, name FROM meeting_rooms WHERE id = ?', [id]);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check for future bookings
    const futureBookings = await getOne(
      'SELECT COUNT(*) as count FROM bookings WHERE room_id = ? AND start_time > NOW() AND status = "confirmed"',
      [id]
    );

    if (futureBookings.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete room with future bookings',
        future_bookings: futureBookings.count
      });
    }

    // Soft delete the room
    await update('UPDATE meeting_rooms SET is_active = false WHERE id = ?', [id]);

    res.json({ 
      message: 'Room deleted successfully',
      room_name: room.name
    });

  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// Get room statistics (Admin only)
router.get('/:id/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    // Verify room exists
    const room = await getOne('SELECT id, name FROM meeting_rooms WHERE id = ?', [id]);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
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
       WHERE room_id = ? ${dateFilter}`,
      params
    );

    // Get top users
    const topUsers = await getMany(
      `SELECT 
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.department,
        COUNT(*) as booking_count
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       WHERE b.room_id = ? ${dateFilter} AND b.status = 'confirmed'
       GROUP BY b.user_id
       ORDER BY booking_count DESC
       LIMIT 5`,
      params
    );

    res.json({
      room,
      period: { start_date, end_date },
      statistics: {
        ...stats,
        avg_duration_hours: parseFloat(stats.avg_duration_hours || 0).toFixed(2)
      },
      top_users: topUsers
    });

  } catch (error) {
    console.error('Get room stats error:', error);
    res.status(500).json({ error: 'Failed to fetch room statistics' });
  }
});

module.exports = router;