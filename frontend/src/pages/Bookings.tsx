import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Add } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const Bookings: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">My Bookings</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/bookings/new')}
        >
          New Booking
        </Button>
      </Box>
      <Typography>Bookings list functionality coming soon...</Typography>
    </Box>
  );
};

export default Bookings;