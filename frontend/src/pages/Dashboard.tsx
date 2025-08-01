import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  CircularProgress,
  Paper,
} from '@mui/material';
import {
  Add,
  EventNote,
  MeetingRoom,
  Today,
  Schedule,
  LocationOn,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import apiService from '../services/api';
import { Booking } from '../types';
import dayjs from 'dayjs';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayBookings: 0,
    thisWeekBookings: 0,
    totalRooms: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [bookingsResponse, roomsResponse] = await Promise.all([
        apiService.getUpcomingBookings(5),
        apiService.getRooms(),
      ]);

      setUpcomingBookings(bookingsResponse.bookings);
      setStats(prev => ({
        ...prev,
        totalRooms: roomsResponse.rooms.length,
      }));

      // Calculate today's and this week's bookings
      const today = dayjs();
      const startOfWeek = today.startOf('week');
      const endOfWeek = today.endOf('week');

      const todayCount = bookingsResponse.bookings.filter(booking =>
        dayjs(booking.start_time).isSame(today, 'day')
      ).length;

      const weekCount = bookingsResponse.bookings.filter(booking => {
        const bookingDate = dayjs(booking.start_time);
        return bookingDate.isAfter(startOfWeek) && bookingDate.isBefore(endOfWeek);
      }).length;

      setStats(prev => ({
        ...prev,
        todayBookings: todayCount,
        thisWeekBookings: weekCount,
      }));

    } catch (error: any) {
      showNotification(
        error.response?.data?.error || 'Failed to load dashboard data',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDateTime = (dateTime: string) => {
    return dayjs(dateTime).format('MMM DD, YYYY • HH:mm');
  };

  const formatTime = (dateTime: string) => {
    return dayjs(dateTime).format('HH:mm');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome back, {user?.first_name}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's your meeting room booking overview
        </Typography>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Today color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {stats.todayBookings}
                  </Typography>
                  <Typography color="text.secondary">
                    Today's Meetings
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <EventNote color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {stats.thisWeekBookings}
                  </Typography>
                  <Typography color="text.secondary">
                    This Week
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <MeetingRoom color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {stats.totalRooms}
                  </Typography>
                  <Typography color="text.secondary">
                    Available Rooms
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'primary.main', color: 'white' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h6" component="div">
                    Quick Book
                  </Typography>
                  <Typography variant="body2">
                    Reserve a room now
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<Add />}
                  onClick={() => navigate('/bookings/new')}
                  sx={{ ml: 2 }}
                >
                  Book Room
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Upcoming Meetings */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Upcoming Meetings</Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate('/bookings')}
              >
                View All
              </Button>
            </Box>
            {upcomingBookings.length === 0 ? (
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                py={4}
                color="text.secondary"
              >
                <EventNote sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                <Typography variant="body1" gutterBottom>
                  No upcoming meetings
                </Typography>
                <Typography variant="body2">
                  Book a room to get started
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => navigate('/bookings/new')}
                  sx={{ mt: 2 }}
                >
                  Book Room
                </Button>
              </Box>
            ) : (
              <List>
                {upcomingBookings.map((booking, index) => (
                  <ListItem
                    key={booking.id}
                    divider={index < upcomingBookings.length - 1}
                    sx={{
                      borderLeft: 3,
                      borderColor: 'primary.main',
                      borderStyle: 'solid',
                      pl: 2,
                      mb: 1,
                    }}
                  >
                    <ListItemIcon>
                      <Schedule color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle1" component="span">
                            {booking.title}
                          </Typography>
                          <Chip
                            label={booking.status}
                            size="small"
                            color={getStatusColor(booking.status) as any}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                            <LocationOn fontSize="small" />
                            <Typography variant="body2">
                              {booking.room_name} - {booking.room_location}
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {formatDateTime(booking.start_time)} - {formatTime(booking.end_time)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Box display="flex" flexDirection="column" gap={2}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<Add />}
                onClick={() => navigate('/bookings/new')}
              >
                Book a Room
              </Button>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<EventNote />}
                onClick={() => navigate('/bookings')}
              >
                View My Bookings
              </Button>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<MeetingRoom />}
                onClick={() => navigate('/rooms')}
              >
                Browse Rooms
              </Button>
            </Box>

            <Box mt={3}>
              <Typography variant="subtitle2" gutterBottom>
                Your Department
              </Typography>
              <Chip label={user?.department} variant="outlined" />
            </Box>

            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                Role
              </Typography>
              <Chip
                label={user?.role?.toUpperCase()}
                color="primary"
                variant="outlined"
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;