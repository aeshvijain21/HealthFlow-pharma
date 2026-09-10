const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  // Who submitted (patient themselves or doctor on behalf)
  patient:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // could be doctor
  submittedByRole: { type: String, enum: ['patient', 'doctor'], default: 'patient' },

  // Core symptom data
  description: { type: String, required: true },
  severity:    { type: Number, required: true, min: 1, max: 10 },
  symptomDate: { type: Date, required: true },

  // Medications taken at time of report
  medications: [{ type: String }],

  // Patient notes
  notes: { type: String, default: '' },

  // Follow-up reference
  followUpOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null },

  // AI-generated analysis
  aiAdvice: { type: String, default: '' },

  // Doctor clinical notes (added separately)
  clinicalNotes: [{
    doctor:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note:      { type: String },
    createdAt: { type: Date, default: Date.now }
  }],

  // Report status
  status: {
    type: String,
    enum: ['submitted', 'reviewed', 'closed'],
    default: 'submitted'
  },

  // Drugs dispensed by doctor during physical visit
  dispensedDrugs: [{
    name:      { type: String },
    dosage:    { type: String },
    quantity:  { type: String },
    notes:     { type: String },
    dispensedAt: { type: Date, default: Date.now }
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-update updatedAt
reportSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Report', reportSchema);
