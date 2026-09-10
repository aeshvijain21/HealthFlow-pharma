const express = require('express');
const Report = require('../models/Report');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ─── PATIENT: Submit own report ────────────────────────────────────────────
router.post('/', authenticate, authorize('patient'), async (req, res) => {
  try {
    const { description, severity, symptomDate, medications, notes, followUpOf } = req.body;
    if (!description || !severity || !symptomDate) {
      return res.status(400).json({ message: 'description, severity, and symptomDate are required.' });
    }

    const report = await Report.create({
      patient: req.user._id,
      submittedBy: req.user._id,
      submittedByRole: 'patient',
      description, severity, symptomDate,
      medications: medications || [],
      notes: notes || '',
      followUpOf: followUpOf || null,
      aiAdvice: req.body.aiAdvice || ''
    });

    await report.populate('patient', 'firstName lastName age gender');
    res.status(201).json({ report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PATIENT: Get own reports ──────────────────────────────────────────────
router.get('/my', authenticate, authorize('patient'), async (req, res) => {
  try {
    const reports = await Report.find({ patient: req.user._id })
      .populate('followUpOf', 'description symptomDate severity')
      .sort({ createdAt: -1 });
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── DOCTOR: Submit report on behalf of patient ────────────────────────────
router.post('/on-behalf', authenticate, authorize('doctor'), async (req, res) => {
  try {
    const { patientId, description, severity, symptomDate, medications, notes, dispensedDrugs, followUpOf } = req.body;
    if (!patientId || !description || !severity || !symptomDate) {
      return res.status(400).json({ message: 'patientId, description, severity, and symptomDate are required.' });
    }

    // Check the patient is assigned to this doctor
    const patient = await User.findById(patientId);
    if (!patient) return res.status(404).json({ message: 'Patient not found.' });

    const report = await Report.create({
      patient: patientId,
      submittedBy: req.user._id,
      submittedByRole: 'doctor',
      description, severity, symptomDate,
      medications: medications || [],
      notes: notes || '',
      followUpOf: followUpOf || null,
      dispensedDrugs: dispensedDrugs || [],
      aiAdvice: req.body.aiAdvice || ''
    });

    await report.populate([
      { path: 'patient', select: 'firstName lastName age gender' },
      { path: 'submittedBy', select: 'firstName lastName' }
    ]);
    res.status(201).json({ report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── DOCTOR: Get reports for assigned patients ─────────────────────────────
router.get('/assigned', authenticate, authorize('doctor'), async (req, res) => {
  try {
    const doctor = await User.findById(req.user._id);
    const reports = await Report.find({ patient: { $in: doctor.assignedPatients } })
      .populate('patient', 'firstName lastName age gender medications')
      .populate('submittedBy', 'firstName lastName role')
      .sort({ createdAt: -1 });
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── DOCTOR: Add clinical note to a report ────────────────────────────────
router.post('/:id/clinical-note', authenticate, authorize('doctor'), async (req, res) => {
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ message: 'Note text is required.' });

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      {
        $push: { clinicalNotes: { doctor: req.user._id, note } },
        status: 'reviewed'
      },
      { new: true }
    ).populate('clinicalNotes.doctor', 'firstName lastName');

    if (!report) return res.status(404).json({ message: 'Report not found.' });
    res.json({ report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── DOCTOR: Add dispensed drugs to report ────────────────────────────────
router.post('/:id/dispense-drugs', authenticate, authorize('doctor'), async (req, res) => {
  try {
    const { drugs } = req.body; // array of { name, dosage, quantity, notes }
    if (!drugs || !drugs.length) return res.status(400).json({ message: 'drugs array is required.' });

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { $push: { dispensedDrugs: { $each: drugs } } },
      { new: true }
    );

    if (!report) return res.status(404).json({ message: 'Report not found.' });
    res.json({ report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── DOCTOR/PATIENT: Get single report ────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('patient', 'firstName lastName age gender medications')
      .populate('submittedBy', 'firstName lastName role')
      .populate('clinicalNotes.doctor', 'firstName lastName specialty')
      .populate('followUpOf', 'description symptomDate severity');

    if (!report) return res.status(404).json({ message: 'Report not found.' });

    // Authorization check
    const isPatient = req.user.role === 'patient' && report.patient._id.toString() === req.user._id.toString();
    const isDoctor = req.user.role === 'doctor';
    const isAdmin = req.user.role === 'admin';

    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    res.json({ report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── ADMIN: Get all reports ────────────────────────────────────────────────
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, severity, status, patientId, from, to } = req.query;
    const filter = {};

    if (severity) filter.severity = { $gte: parseInt(severity) };
    if (status) filter.status = status;
    if (patientId) filter.patient = patientId;
    if (from || to) {
      filter.symptomDate = {};
      if (from) filter.symptomDate.$gte = new Date(from);
      if (to) filter.symptomDate.$lte = new Date(to);
    }

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .populate('patient', 'firstName lastName age gender')
        .populate('submittedBy', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      Report.countDocuments(filter)
    ]);

    res.json({ reports, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
