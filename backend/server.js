require('dotenv').config();
console.log("GEMINI KEY:", process.env.GEMINI_API_KEY);
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes   = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const adminRoutes  = require('./routes/admin');
const aiRoutes     = require('./routes/ai');
const User = require('./models/User');
const app = express();

// ─── Security & Middleware ────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: 'Too many requests. Please try again later.'
});
app.use('/api', limiter);

// Stricter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many login attempts. Please try again in 15 minutes.'
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Database ─────────────────────────────────────────────────────────────
// ─── Create demo accounts ────────────────────────────────────────────────
async function createDemoAccounts() {
  try {
    // Create demo admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@healthflow.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@1234';

    const adminExists = await User.findOne({ email: adminEmail });

    if (!adminExists) {
      await User.create({
        firstName: 'Admin',
        lastName: 'HealthFlow',
        email: adminEmail,
        password: adminPassword,
        role: 'admin'
      });

      console.log(`✓ Demo admin created: ${adminEmail}`);
    } else {
      console.log('✓ Demo admin already exists');
    }

    // Create demo doctor
    const doctorExists = await User.findOne({
      email: 'doctor@healthflow.com'
    });

    if (!doctorExists) {
      await User.create({
        firstName: 'Dr. Priya',
        lastName: 'Sharma',
        email: 'doctor@healthflow.com',
        password: 'Doctor@1234',
        role: 'doctor',
        specialty: 'General Physician'
      });

      console.log('✓ Demo doctor created');
    } else {
      console.log('✓ Demo doctor already exists');
    }

    // Create demo patient
    const patientExists = await User.findOne({
      email: 'patient@healthflow.com'
    });

    if (!patientExists) {
      await User.create({
        firstName: 'Aesh',
        lastName: 'Vijain',
        email: 'patient@healthflow.com',
        password: 'Patient@1234',
        role: 'patient',
        age: 30,
        gender: 'Male',
        medications: [
          {
            name: 'Aspirin',
            dosage: '100mg',
            frequency: 'daily'
          },
          {
            name: 'Lisinopril',
            dosage: '10mg',
            frequency: 'twice daily'
          },
          {
            name: 'Metformin',
            dosage: '500mg',
            frequency: 'after meals'
          }
        ]
      });

      console.log('✓ Demo patient created');
    } else {
      console.log('✓ Demo patient already exists');
    }

  } catch (error) {
    console.error('✗ Error creating demo accounts:', error.message);
  }
}
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✓ MongoDB connected');

    // Create demo accounts if they don't already exist
    await createDemoAccounts();
  })
  .catch(err => {
    console.error('✗ MongoDB connection error:', err.message);
    process.exit(1);
  });

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin',   adminRoutes);
app.use('/api/ai',      aiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../frontend')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  });
}

// ─── Error handler ────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 HealthFlow API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Run "npm run seed" to create demo accounts\n`);
});
const path = require('path');

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});
