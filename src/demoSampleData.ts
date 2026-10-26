import { kgbvSchools } from './data/kgbvSchools';
import { trainerProfiles, TRAINER_AVAILABILITY_KEY, TRAINER_PROFILES_KEY, type TrainerAvailability, type TrainerProfile } from './trainerStore';

const samplePrefix = 'DEMO-SAMPLE-';
const school = kgbvSchools.find(item => item.state === 'Andhra Pradesh') ?? kgbvSchools[0];
const projectId = `${samplePrefix}PROJECT-001`;
const planId = `${samplePrefix}PLAN-001`;
const associationId = `${samplePrefix}ASSOCIATION-001`;
const pastBatchId = `${samplePrefix}BATCH-PAST`;
const upcomingBatchId = `${samplePrefix}BATCH-UPCOMING`;
const demoTraineeId = `${samplePrefix}TRAINEE-007`;
const pendingTraineeId = `${samplePrefix}TRAINEE-008`;

function rows(key: string): Record<string, any>[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
}

function addSamples(key: string, samples: Record<string, any>[]) {
  const current = rows(key);
  const ids = new Set(current.map(item => String(item.id ?? item.traineeId ?? '')));
  const additions = samples.filter(item => !ids.has(String(item.id ?? item.traineeId ?? '')));
  if (additions.length) localStorage.setItem(key, JSON.stringify([...current, ...additions]));
}

function sampleTrainer(): TrainerProfile {
  const profiles = trainerProfiles();
  const linked = profiles.find(item => item.userId?.toLowerCase() === 'demo6');
  if (linked) {
    const generic = linked.name === 'Demo6' && !linked.email && !linked.phone && !linked.languages.length && !linked.competencies.length;
    if (generic) {
      const enriched = { ...linked, name: 'Ananya Rao', category: 'Employee' as const, email: 'ananya.rao@example.org', phone: '+91 90000 10006', languages: ['English', 'Telugu'], competencies: ['Digital pedagogy', 'Classroom technology'], certifications: 'Certified Teacher Trainer', experienceYears: 8, state: school.state, district: school.district, serviceArea: school.school, active: true };
      localStorage.setItem(TRAINER_PROFILES_KEY, JSON.stringify(profiles.map(item => item.id === linked.id ? enriched : item)));
      return enriched;
    }
    return linked;
  }
  const trainer: TrainerProfile = { id: `${samplePrefix}TRAINER-006`, trainerCode: 'TR-DEMO-006', userId: 'Demo6', name: 'Ananya Rao', category: 'Employee', email: 'ananya.rao@example.org', phone: '+91 90000 10006', languages: ['English', 'Telugu'], competencies: ['Digital pedagogy', 'Classroom technology'], certifications: 'Certified Teacher Trainer', experienceYears: 8, state: school.state, district: school.district, serviceArea: school.school, active: true };
  addSamples(TRAINER_PROFILES_KEY, [trainer as unknown as Record<string, any>]);
  return trainer;
}

export function seedDemoSampleData() {
  if (typeof window === 'undefined') return;
  const trainer = sampleTrainer();
  const plan = { id: planId, code: 'TP-DEMO-001', name: 'Digital Teaching Foundations', type: 'Hybrid', description: 'Sample program for practical digital teaching and classroom technology.', days: 3, beneficiaries: ['Teacher'], resources: [], learningResourceIds: ['video', 'manual', 'guide'], resourceAssignments: [{ id: `${samplePrefix}RESOURCE-001`, resource: 'Teacher training manual', fromDay: 1, toDay: 3, throughProjectEnd: false }, { id: `${samplePrefix}RESOURCE-002`, resource: 'Pre-assessment', fromDay: 1, toDay: 1, throughProjectEnd: false }, { id: `${samplePrefix}RESOURCE-003`, resource: 'Feedback form', fromDay: 3, toDay: 3, throughProjectEnd: false }], status: 'Active', createdAt: '2026-01-10T09:00:00.000Z' };
  const project = { id: projectId, odooId: 'DEMO-ODOO-001', odooReference: 'DEMO-TT-2026', name: 'Digital Teaching Improvement Project', code: 'PRJ-DEMO-001', sponsor: 'Schoolnet India', startDate: '2026-01-01', endDate: '2026-12-31', description: 'Sample project connecting trainer development to school based teacher training.', states: [school.state], assignedUsers: ['Demo2', 'Demo3', 'Demo4', 'Demo5'], status: 'Active', phases: [{ id: `${samplePrefix}PHASE-01`, name: 'Planning and school onboarding', sequence: 1, startDate: '2026-01-01', endDate: '2026-03-31', status: 'Completed' }, { id: `${samplePrefix}PHASE-02`, name: 'Teacher training delivery', sequence: 2, startDate: '2026-04-01', endDate: '2026-12-31', status: 'In Progress' }], trainingPlans: [plan.name], selectedTrainingPlanIds: [planId], batchImportPolicy: 'valid-rows' };
  const association = { id: associationId, projectId, trainingPlanId: planId, status: 'Active', createdAt: '2026-01-10T09:00:00.000Z', updatedAt: '2026-01-10T09:00:00.000Z' };
  const commonBatch = { projectId, projectName: project.name, projectPlanAssociationId: associationId, name: school.school, phaseId: `${samplePrefix}PHASE-02`, trainingCycle: '2026 Cycle 1', deliveryMode: 'Hybrid', schoolUdiseVenue: school.udise, schoolName: school.school, state: school.state, district: school.district, location: school.school, trainingPlanCode: plan.code, trainingPlanName: plan.name, trainingDuration: 3, trainingStartTime: '09:30', trainingEndTime: '15:30', trainerCode: trainer.userId ?? trainer.trainerCode, trainerProfileCode: trainer.trainerCode, trainerName: trainer.name, createdAt: '2026-01-10T09:00:00.000Z', createdBy: 'Demo2', registrationCapacity: 30, registrationWindowBeforeDays: 14, registrationWindowAfterDays: 0, attendanceCount: 3, assessmentCount: 1 };
  const batches = [
    { ...commonBatch, id: pastBatchId, batchCode: 'BATCH-DEMO-PAST', uniqueId: 'BATCH-DEMO-PAST', trainingStartDate: '2026-09-14', trainingDates: ['2026-09-14', '2026-09-15', '2026-09-16'], trainingEndAuto: '2026-09-16', openRegistration: false, status: 'Completed' },
    { ...commonBatch, id: upcomingBatchId, batchCode: 'BATCH-DEMO-NOV', uniqueId: 'BATCH-DEMO-NOV', trainingCycle: '2026 Cycle 2', trainingStartDate: '2026-11-10', trainingDates: ['2026-11-10', '2026-11-11', '2026-11-12'], trainingEndAuto: '2026-11-12', openRegistration: true, status: 'Scheduled', attendanceCount: 0, assessmentCount: 0 },
  ];
  const trainee = { id: demoTraineeId, traineeId: demoTraineeId, userId: 'Demo7', name: 'Sample Trainee', email: 'demo7.trainee@example.org', phone: '+91 90000 10007', category: 'Teacher', schoolUdise: school.udise, schoolName: school.school, projectId, state: school.state, district: school.district, consentProvided: true, createdAt: '2026-01-10T09:00:00.000Z', createdBy: 'Demo2' };
  const pendingTrainee = { id: pendingTraineeId, traineeId: pendingTraineeId, name: 'Sample Teacher Two', email: 'teacher.two@example.org', phone: '+91 90000 10008', category: 'Teacher', schoolUdise: school.udise, schoolName: school.school, projectId, state: school.state, district: school.district, consentProvided: true, createdAt: '2026-10-20T09:00:00.000Z', createdBy: 'Demo6' };
  const registrations = [
    { id: `${samplePrefix}REG-COMPLETE`, batchId: pastBatchId, batchCode: 'BATCH-DEMO-PAST', projectId, traineeId: demoTraineeId, userId: 'Demo7', traineeName: trainee.name, name: trainee.name, email: trainee.email, phone: trainee.phone, category: 'Teacher', consentProvided: true, status: 'Approved', registrationStatus: 'Approved', approvalStatus: 'Approved', approved: true, completed: true, source: 'Sample data', submittedAt: '2026-08-01T09:00:00.000Z', submittedBy: 'Demo7', reviewedBy: 'Demo6', reviewedAt: '2026-08-02T09:00:00.000Z' },
    { id: `${samplePrefix}REG-APPROVED`, batchId: upcomingBatchId, batchCode: 'BATCH-DEMO-NOV', projectId, traineeId: demoTraineeId, userId: 'Demo7', traineeName: trainee.name, name: trainee.name, email: trainee.email, phone: trainee.phone, category: 'Teacher', consentProvided: true, status: 'Approved', registrationStatus: 'Approved', approvalStatus: 'Approved', approved: true, source: 'Sample data', submittedAt: '2026-10-12T09:00:00.000Z', submittedBy: 'Demo7', reviewedBy: 'Demo6', reviewedAt: '2026-10-13T09:00:00.000Z' },
    { id: `${samplePrefix}REG-PENDING`, batchId: upcomingBatchId, batchCode: 'BATCH-DEMO-NOV', projectId, traineeId: pendingTraineeId, traineeName: pendingTrainee.name, name: pendingTrainee.name, email: pendingTrainee.email, phone: pendingTrainee.phone, category: 'Teacher', consentProvided: true, status: 'Pending', registrationStatus: 'Pending', approvalStatus: 'Pending', approved: false, source: 'Sample data', submittedAt: '2026-10-20T09:00:00.000Z', submittedBy: 'Demo7' },
  ];

  addSamples('teacher-training-projects', [project]);
  addSamples('teacher-training-plans', [plan]);
  addSamples('teacher-training-project-plan-associations', [association]);
  addSamples('teacher-training-batch-plan-uses', batches);
  addSamples('teacher-training-trainees', [trainee, pendingTrainee]);
  addSamples('teacher-training-registrations', registrations);
  addSamples('teacher-training-attendance-records', ['2026-09-14', '2026-09-15', '2026-09-16'].map((trainingDate, index) => ({ id: `${samplePrefix}ATTENDANCE-${index + 1}`, projectId, batchId: pastBatchId, batchCode: 'BATCH-DEMO-PAST', trainingDate, traineeId: demoTraineeId, userId: 'Demo7', traineeName: trainee.name, status: index === 2 ? 'Absent' : 'Present', markedBy: 'Demo6', markedAt: `${trainingDate}T10:00:00.000Z` })));
  addSamples('teacher-training-assessment-records', [{ id: `${samplePrefix}ASSESSMENT-001`, projectId, batchId: pastBatchId, batchCode: 'BATCH-DEMO-PAST', traineeId: demoTraineeId, userId: 'Demo7', traineeName: trainee.name, name: 'Digital teaching post-assessment', status: 'Passed', completed: true, score: 86, submittedAt: '2026-09-16T12:00:00.000Z' }, { id: `${samplePrefix}ASSESSMENT-002`, projectId, batchId: upcomingBatchId, batchCode: 'BATCH-DEMO-NOV', traineeId: demoTraineeId, userId: 'Demo7', traineeName: trainee.name, name: 'Digital teaching pre-assessment', status: 'Pending', completed: false }]);
  addSamples('teacher-training-feedback-records', [{ id: `${samplePrefix}FEEDBACK-001`, projectId, batchId: pastBatchId, batchCode: 'BATCH-DEMO-PAST', traineeId: demoTraineeId, userId: 'Demo7', traineeName: trainee.name, status: 'Submitted', submitted: true, submittedAt: '2026-09-16T13:00:00.000Z' }]);
  addSamples('teacher-training-certificates', [{ id: `${samplePrefix}CERTIFICATE-001`, projectId, batchId: pastBatchId, batchCode: 'BATCH-DEMO-PAST', traineeId: demoTraineeId, userId: 'Demo7', traineeName: trainee.name, issued: true, status: 'Issued', issuedAt: '2026-09-20T09:00:00.000Z', certificateNumber: 'CERT-DEMO-0007' }]);
  addSamples('teacher-training-eligible-teachers', [{ id: `${samplePrefix}ELIGIBLE-TEACHERS`, schoolUdise: school.udise, projectId, eligible: true, participantType: 'teacher', count: 24 }]);
  addSamples('teacher-training-eligible-students', [{ id: `${samplePrefix}ELIGIBLE-STUDENTS`, schoolUdise: school.udise, projectId, eligible: true, participantType: 'student', count: 120 }]);
  addSamples('teacher-training-school-assignments', [{ id: `${samplePrefix}SCHOOL-ASSIGNMENT`, userId: 'Demo5', schoolUdise: school.udise, projectId }]);

  const availability: TrainerAvailability[] = ['2026-11-10', '2026-11-11', '2026-11-12'].map((date, index) => ({ id: `${samplePrefix}AVAILABILITY-${index + 1}`, trainerCode: trainer.userId ?? trainer.trainerCode, date, startTime: '09:00', endTime: '16:00', status: 'Available', remarks: 'Sample batch availability', createdBy: 'Demo6', updatedAt: '2026-10-01T09:00:00.000Z' }));
  addSamples(TRAINER_AVAILABILITY_KEY, availability as unknown as Record<string, any>[]);
  addSamples('teacher-training-holidays', [
    { id: `${samplePrefix}HOLIDAY-NATIONAL`, name: 'Children’s Day', date: '2026-11-14', scope: 'National', state: '', district: '', school: '', active: true, note: 'Sample national holiday' },
    { id: `${samplePrefix}HOLIDAY-STATE`, name: 'Andhra Pradesh Formation Day', date: '2026-11-01', scope: 'State', state: 'Andhra Pradesh', district: '', school: '', active: true, note: 'Sample state holiday' },
  ]);
}
