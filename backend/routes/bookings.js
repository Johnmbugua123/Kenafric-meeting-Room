const express = require('express');
const { body, validationResult } = require('express-validator');
const moment = require('moment');
const { getOne, getMany, insert, update, deleteRecord } = require('../config/database');
const { authenticateToken, requireManager } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const bookingValidation = [
  body('room_id').isInt({ min: 1 }).withMessage('Valid room ID required'),
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required (max 200 chars)'),
  body('start_time').isISO8601().withMessage('Valid start time required (ISO 8601)'),
  body('end_time').isISO8601().withMessage('Valid end time required (ISO 8601)'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description too long'),
  body('participants').optional().isArray().withMessage('Participants must be an array')
];

// Helper function to check time conflicts
const checkTimeConflict = async (roomId, startTime, endTime, excludeBookingId = null) => {
  let query = `
    SELECT id, title, start_time, end_time 
    FROM bookings 
    WHERE room_id = ? 
    AND status = 'confirmed'
    AND (
      (start_time < ? AND end_time > ?) OR
      (start_time < ? AND end_time > ?) OR
      (start_time >= ? AND end_time <= ?)
    )
  `;
  
  const params = [roomId, endTime, startTime, startTime, endTime, startTime, endTime];
  
  if (excludeBookingId) {
    query += ' AND id != ?';
    params.push(excludeBookingId);
  }

  const conflicts = await getMany(query, params);
  return conflicts;
};

// Helper function to validate booking time
const validateBookingTime = (startTime, endTime) => {
  const start = moment(startTime);
  const end = moment(endTime);
  const now = moment();

  // Check if start time is in the past
  if (start.isBefore(now)) {
    return { valid: false, error: 'Cannot book in the past' };
  }

  // Check if end time is after start time
  if (end.isSameOrBefore(start)) {
    return { valid: false, error: 'End time must be after start time' };
  }

  // Check booking duration (max 4 hours by default)
  const duration = end.diff(start, 'hours');
  if (duration > 4) {
    return { valid: false, error: 'Maximum booking duration is 4 hours' };
  }

  // Check advance booking limit (max 30 days by default)
  const advanceDays = start.diff(now, 'days');
  if (advanceDays > 30) {
    return { valid: false, error: 'Cannot book more than 30 days in advance' };
  }

  return { valid: true };
};

// Get all bookings (with filters)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { room_id, date, user_id, status, department } = req.query;
    let query = `
      SELECT b.id, b.title, b.description, b.start_time, b.end_time, b.status,
             b.participants, b.is_recurring, b.created_at,
             r.name as room_name, r.location as room_location,
             CONCAT(u.first_name, ' ', u.last_name) as booked_by,
             u.department as user_department
      FROM bookings b
      JOIN meeting_rooms r ON b.room_id = r.id
      JOIN users u ON b.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];

    if (room_id) {
      query += ' AND b.room_id = ?';
      params.push(room_id);
    }

    if (date) {
      query += ' AND DATE(b.start_time) = ?';
      params.push(date);
    }

    if (user_id) {
      query += ' AND b.user_id = ?';
      params.push(user_id);
    }

    if (status) {
      query += ' AND b.status = ?';
      params.push(status);
    }

    if (department) {
      query += ' AND u.department = ?';
      params.push(department);
    }

    // Regular users can only see their own bookings unless they're managers/admins
    if (req.user.role === 'staff') {
      query += ' AND b.user_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY b.start_time DESC LIMIT 100';

    const bookings = await getMany(query, params);

    // Parse JSON participants
    const bookingsWithParticipants = bookings.map(booking => ({
      ...booking,
      participants: booking.participants ? JSON.parse(booking.participants) : []
    }));

    res.json({ bookings: bookingsWithParticipants });

  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get booking by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await getOne(
      `SELECT b.*, 
              r.name as room_name, r.location as room_location,
              CONCAT(u.first_name, ' ', u.last_name) as booked_by,
              u.email as booker_email, u.department as user_department
       FROM bookings b
       JOIN meeting_rooms r ON b.room_id = r.id
       JOIN users u ON b.user_id = u.id
       WHERE b.id = ?`,
      [id]
    );

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if user can access this booking
    if (req.user.role === 'staff' && booking.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Parse JSON fields
    booking.participants = booking.participants ? JSON.parse(booking.participants) : [];
    booking.recurrence_pattern = booking.recurrence_pattern ? JSON.parse(booking.recurrence_pattern) : null;

    res.json({ booking });

  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// Create new booking
router.post('/', authenticateToken, bookingValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { room_id, title, description, start_time, end_time, participants, is_recurring, recurrence_pattern } = req.body;

    // Validate booking time
    const timeValidation = validateBookingTime(start_time, end_time);
    if (!timeValidation.valid) {
      return res.status(400).json({ error: timeValidation.error });
    }

    // Check if room exists and is active
    const room = await getOne('SELECT id, name FROM meeting_rooms WHERE id = ? AND is_active = true', [room_id]);
    if (!room) {
      return res.status(404).json({ error: 'Room not found or inactive' });
    }

    // Check for time conflicts
    const conflicts = await checkTimeConflict(room_id, start_time, end_time);
    if (conflicts.length > 0) {
      return res.status(409).json({ 
        error: 'Time slot already booked',
        conflicts: conflicts
      });
    }

    // Create the booking
    const bookingId = await insert(
      `INSERT INTO bookings (room_id, user_id, title, description, start_time, end_time, participants, is_recurring, recurrence_pattern)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        room_id, 
        req.user.id, 
        title, 
        description || null, 
        start_time, 
        end_time,
        JSON.stringify(participants || []),
        is_recurring || false,
        recurrence_pattern ? JSON.stringify(recurrence_pattern) : null
      ]
    );

    // Get created booking with details
    const newBooking = await getOne(
      `SELECT b.*, r.name as room_name, r.location as room_location
       FROM bookings b
       JOIN meeting_rooms r ON b.room_id = r.id
       WHERE b.id = ?`,
      [bookingId]
    );

    // Parse JSON fields
    newBooking.participants = newBooking.participants ? JSON.parse(newBooking.participants) : [];
    newBooking.recurrence_pattern = newBooking.recurrence_pattern ? JSON.parse(newBooking.recurrence_pattern) : null;

    res.status(201).json({
      message: 'Booking created successfully',
      booking: newBooking
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Update booking
router.put('/:id', authenticateToken, bookingValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { room_id, title, description, start_time, end_time, participants } = req.body;

    // Get existing booking
    const existingBooking = await getOne('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!existingBooking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check permissions
    if (req.user.role === 'staff' && existingBooking.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if booking can be modified (not in the past)
    if (moment(existingBooking.start_time).isBefore(moment())) {
      return res.status(400).json({ error: 'Cannot modify past bookings' });
    }

    // Validate new booking time
    const timeValidation = validateBookingTime(start_time, end_time);
    if (!timeValidation.valid) {
      return res.status(400).json({ error: timeValidation.error });
    }

    // Check if room exists and is active
    const room = await getOne('SELECT id, name FROM meeting_rooms WHERE id = ? AND is_active = true', [room_id]);
    if (!room) {
      return res.status(404).json({ error: 'Room not found or inactive' });
    }

    // Check for time conflicts (excluding current booking)
    const conflicts = await checkTimeConflict(room_id, start_time, end_time, id);
    if (conflicts.length > 0) {
      return res.status(409).json({ 
        error: 'Time slot already booked',
        conflicts: conflicts
      });
    }

    // Update the booking
    await update(
      `UPDATE bookings 
       SET room_id = ?, title = ?, description = ?, start_time = ?, end_time = ?, participants = ?
       WHERE id = ?`,
      [room_id, title, description || null, start_time, end_time, JSON.stringify(participants || []), id]
    );

    // Get updated booking
    const updatedBooking = await getOne(
      `SELECT b.*, r.name as room_name, r.location as room_location
       FROM bookings b
       JOIN meeting_rooms r ON b.room_id = r.id
       WHERE b.id = ?`,
      [id]
    );

    // Parse JSON fields
    updatedBooking.participants = updatedBooking.participants ? JSON.parse(updatedBooking.participants) : [];

    res.json({
      message: 'Booking updated successfully',
      booking: updatedBooking
    });

  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// Cancel booking
router.patch('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get booking
    const booking = await getOne('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check permissions
    if (req.user.role === 'staff' && booking.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if already cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking already cancelled' });
    }

    // Update booking status
    await update('UPDATE bookings SET status = "cancelled" WHERE id = ?', [id]);

    res.json({ message: 'Booking cancelled successfully' });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// Delete booking (Admin/Manager only)
router.delete('/:id', authenticateToken, requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if booking exists
    const booking = await getOne('SELECT id, title FROM bookings WHERE id = ?', [id]);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Delete the booking
    await deleteRecord('DELETE FROM bookings WHERE id = ?', [id]);

    res.json({ 
      message: 'Booking deleted successfully',
      booking_title: booking.title
    });

  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// Get availability for multiple rooms on a specific date
router.get('/availability', authenticateToken, async (req, res) => {
  try {
    const { date, room_ids } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter required' });
    }

    let roomFilter = '';
    const params = [date];

    if (room_ids) {
      const roomIdArray = room_ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      if (roomIdArray.length > 0) {
        roomFilter = `AND r.id IN (${roomIdArray.map(() => '?').join(',')})`;
        params.push(...roomIdArray);
      }
    }

    // Get all active rooms with their bookings for the date
    const availability = await getMany(
      `SELECT r.id, r.name, r.location, r.capacity,
              b.id as booking_id, b.title, b.start_time, b.end_time,
              CONCAT(u.first_name, ' ', u.last_name) as booked_by
       FROM meeting_rooms r
       LEFT JOIN bookings b ON r.id = b.room_id 
         AND DATE(b.start_time) = ? 
         AND b.status = 'confirmed'
       LEFT JOIN users u ON b.user_id = u.id
       WHERE r.is_active = true ${roomFilter}
       ORDER BY r.name, b.start_time`,
      params
    );

    // Group by room
    const roomAvailability = {};
    availability.forEach(row => {
      if (!roomAvailability[row.id]) {
        roomAvailability[row.id] = {
          id: row.id,
          name: row.name,
          location: row.location,
          capacity: row.capacity,
          bookings: []
        };
      }

      if (row.booking_id) {
        roomAvailability[row.id].bookings.push({
          id: row.booking_id,
          title: row.title,
          start_time: row.start_time,
          end_time: row.end_time,
          booked_by: row.booked_by
        });
      }
    });

    res.json({
      date,
      rooms: Object.values(roomAvailability)
    });

  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Get upcoming bookings for current user
router.get('/my/upcoming', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const bookings = await getMany(
      `SELECT b.id, b.title, b.start_time, b.end_time, b.status,
              r.name as room_name, r.location as room_location
       FROM bookings b
       JOIN meeting_rooms r ON b.room_id = r.id
       WHERE b.user_id = ? 
       AND b.start_time > NOW()
       AND b.status = 'confirmed'
       ORDER BY b.start_time ASC
       LIMIT ?`,
      [req.user.id, parseInt(limit)]
    );

    res.json({ bookings });

  } catch (error) {
    console.error('Get upcoming bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming bookings' });
  }
});

module.exports = router;