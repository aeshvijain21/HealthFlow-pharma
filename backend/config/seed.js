require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Create admin
  const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL || 'admin@healthflow.com' });
  if (!adminExists) {
    await User.create({
      firstName: 'Admin',
      lastName: 'HealthFlow',
      email: process.env.ADMIN_EMAIL || 'admin@healthflow.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@1234',
      role: 'admin'
    });
    console.log('✓ Admin created: admin@healthflow.com / Admin@1234');
  } else {
    console.log('Admin already exists');
  }

  // Create demo doctor
  const doctorExists = await User.findOne({ email: 'doctor@healthflow.com' });
  if (!doctorExists) {
    await User.create({
      firstName: 'Dr. Priya',
      lastName: 'Sharma',
      email: 'doctor@healthflow.com',
      password: 'Doctor@1234',
      role: 'doctor',
      specialty: 'General Physician'
    });
    console.log('✓ Doctor created: doctor@healthflow.com / Doctor@1234');
  }

  // Create demo patient
  const patientExists = await User.findOne({ email: 'patient@healthflow.com' });
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
        { name: 'Aspirin', dosage: '100mg', frequency: 'daily' },
        { name: 'Lisinopril', dosage: '10mg', frequency: 'twice daily' },
        { name: 'Metformin', dosage: '500mg', frequency: 'after meals' }
      ]
    });
    console.log('✓ Patient created: patient@healthflow.com / Patient@1234');
  }

  await mongoose.disconnect();
  console.log('\n🌱 Seed complete! Use the credentials above to log in.');
}

seed().catch(console.error);
