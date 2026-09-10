const express = require('express');
const User = require('../models/User');
const Report = require('../models/Report');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const adminOnly = [authenticate, authorize('admin')];

// ─── Get all users (with optional role filter) ────────────────────────────
router.get('/users', ...adminOnly, async (req, res) => {
  try {
    const { role, page = 1, limit = 50, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName:  { $regex: search, $options: 'i' } },
        { email:     { $regex: search, $options: 'i' } }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .populate('assignedDoctor', 'firstName lastName specialty')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    res.json({ users, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Create doctor or admin account ───────────────────────────────────────
router.post('/users', ...adminOnly, async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, specialty, age, gender } = req.body;
    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ message: 'firstName, lastName, email, password, role are required.' });
    }
    if (!['doctor', 'admin', 'patient'].includes(role)) {
      return res.status(400).json({ message: 'role must be patient, doctor, or admin.' });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered.' });

    const user = await User.create({ firstName, lastName, email, password, role, specialty, age, gender });
    res.status(201).json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Toggle user active/inactive ─────────────────────────────────────────
router.patch('/users/:id/toggle-active', ...adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.isActive = !user.isActive;
    await user.save();
    res.json({ user, message: `Account ${user.isActive ? 'activated' : 'deactivated'}.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Update user medications ───────────────────────────────────────────────
router.patch('/users/:id/medications', ...adminOnly, async (req, res) => {
  try {
    const { medications } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { medications }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Assign patient to doctor ─────────────────────────────────────────────
router.post('/assign', ...adminOnly, async (req, res) => {
  try {
    const { patientId, doctorId } = req.body;
    if (!patientId || !doctorId) {
      return res.status(400).json({ message: 'patientId and doctorId are required.' });
    }

    const [patient, doctor] = await Promise.all([
      User.findById(patientId),
      User.findById(doctorId)
    ]);

    if (!patient || patient.role !== 'patient') return res.status(404).json({ message: 'Patient not found.' });
    if (!doctor || doctor.role !== 'doctor')   return res.status(404).json({ message: 'Doctor not found.' });

    // Remove from previous doctor if any
    if (patient.assignedDoctor) {
      await User.findByIdAndUpdate(patient.assignedDoctor, {
        $pull: { assignedPatients: patient._id }
      });
    }

    // Assign
    patient.assignedDoctor = doctorId;
    await patient.save();

    if (!doctor.assignedPatients.includes(patientId)) {
      doctor.assignedPatients.push(patientId);
      await doctor.save();
    }

    res.json({ message: `${patient.firstName} assigned to Dr. ${doctor.firstName} ${doctor.lastName}.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Unassign patient from doctor ─────────────────────────────────────────
router.post('/unassign', ...adminOnly, async (req, res) => {
  try {
    const { patientId } = req.body;
    const patient = await User.findById(patientId);
    if (!patient) return res.status(404).json({ message: 'Patient not found.' });

    if (patient.assignedDoctor) {
      await User.findByIdAndUpdate(patient.assignedDoctor, {
        $pull: { assignedPatients: patient._id }
      });
    }
    patient.assignedDoctor = null;
    await patient.save();

    res.json({ message: 'Patient unassigned successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Admin dashboard stats ─────────────────────────────────────────────────
router.get('/stats', ...adminOnly, async (req, res) => {
  try {
    const [
      totalPatients,
      totalDoctors,
      totalReports,
      adverseReports,
      recentReports
    ] = await Promise.all([
      User.countDocuments({ role: 'patient' }),
      User.countDocuments({ role: 'doctor' }),
      Report.countDocuments(),
      Report.countDocuments({ severity: { $gte: 7 } }),
      Report.find().sort({ createdAt: -1 }).limit(5)
        .populate('patient', 'firstName lastName')
        .populate('submittedBy', 'firstName lastName role')
    ]);

    // Unassigned patients
    const unassignedPatients = await User.countDocuments({ role: 'patient', assignedDoctor: null });

    res.json({ totalPatients, totalDoctors, totalReports, adverseReports, unassignedPatients, recentReports });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Export CSV for pharma company ────────────────────────────────────────
router.get('/export-csv', ...adminOnly, async (req, res) => {
  try {
    const { from, to, minSeverity } = req.query;
    const filter = {};
    if (from || to) {
      filter.symptomDate = {};
      if (from) filter.symptomDate.$gte = new Date(from);
      if (to)   filter.symptomDate.$lte = new Date(to);
    }
    if (minSeverity) filter.severity = { $gte: parseInt(minSeverity) };

    const reports = await Report.find(filter)
      .populate('patient', 'firstName lastName age gender')
      .populate('submittedBy', 'firstName lastName role')
      .sort({ createdAt: -1 });

    // Build CSV manually (no external dep needed)
    const headers = [
      'Report ID', 'Patient Name', 'Age', 'Gender',
      'Symptom Date', 'Submitted At', 'Severity', 'Description',
      'Medications', 'Notes', 'AI Advice', 'Status',
      'Submitted By', 'Submitted By Role', 'Clinical Notes Count'
    ];

    const escape = (v) => `"${String(v || '').replace(/"/g, '""')}"`;

    const rows = reports.map(r => [
      r._id,
      `${r.patient?.firstName || ''} ${r.patient?.lastName || ''}`,
      r.patient?.age || '',
      r.patient?.gender || '',
      r.symptomDate ? new Date(r.symptomDate).toISOString().split('T')[0] : '',
      new Date(r.createdAt).toISOString(),
      r.severity,
      escape(r.description),
      escape(r.medications.join('; ')),
      escape(r.notes),
      escape(r.aiAdvice),
      r.status,
      `${r.submittedBy?.firstName || ''} ${r.submittedBy?.lastName || ''}`,
      r.submittedByRole,
      r.clinicalNotes.length
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="healthflow_export_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Doctor: Update patient medications ───────────────────────────────────
router.patch('/patients/:id/medications', authenticate, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const { medications } = req.body;
    const patient = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'patient' },
      { medications },
      { new: true }
    );
    if (!patient) return res.status(404).json({ message: 'Patient not found.' });
    res.json({ patient });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
