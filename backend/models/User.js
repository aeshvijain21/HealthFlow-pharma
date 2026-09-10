const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName:  { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true, minlength: 6 },

  // Role: patient | doctor | admin
  role: { type: String, enum: ['patient', 'doctor', 'admin'], default: 'patient' },

  // Patient-specific fields
  age:    { type: Number },
  gender: { type: String, enum: ['Male', 'Female', 'Other', ''] },
  phone:  { type: String },
  address:{ type: String },

  // Medications list (for patients, set by doctor/admin)
  medications: [{
    name:      { type: String },
    dosage:    { type: String },
    frequency: { type: String },
    startDate: { type: Date }
  }],

  // Doctor-specific: patients assigned to this doctor
  assignedPatients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Patient-specific: assigned doctor
  assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Account status
  isActive: { type: Boolean, default: true },

  // Doctor specialty (for doctor role)
  specialty: { type: String, default: '' },

  // Profile picture URL
  avatar: { type: String, default: '' },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
