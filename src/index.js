require('dotenv').config();

const express = require('express');
const cors = require('cors');

const bookingRoutes = require('./routes/bookingRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const eventRoutes = require('./routes/eventRoutes');

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://bookingapp-frontend-git-main-dev-shubham10s-projects.vercel.app"
  ],
  credentials: true
})); 

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api', eventRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', bookingRoutes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Booking backend listening on port ${PORT}`);
});

