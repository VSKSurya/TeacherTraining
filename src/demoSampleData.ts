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
const preAssessmentFormId = `${samplePrefix}FORM-PRE-001`;
const feedbackFormId = `${samplePrefix}FORM-FEEDBACK-001`;

function rows(key: string): Record<string, any>[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
}

function addSamples(key: string, samples: Record<string, any>[]) {
  const current = rows(key);
  const ids = new Set(current.map(item => String(item.id ?? item.traineeId ?? '')));
  const additions = samples.filter(item => !ids.has(String(item.id ?? item.traineeId ?? '')));
  if (additions.length) localStorage.setItem(key, JSON.stringify([...current, ...additions]));
}

function upsertSample(key: string, sample: Record<string, any>) {
  const current = rows(key);
  const index = current.findIndex(item => item.id === sample.id);
  if (index < 0) current.push(sample);
  else current[index] = { ...current[index], ...sample };
  localStorage.setItem(key, JSON.stringify(current));
}

function upsertSampleForm(form: Record<string, any>) {
  const current = rows('teacher-training-assessment-form-master');
  const index = current.findIndex(item => item.id === form.id);
  if (index < 0) current.push(form);
  else current[index] = { ...current[index], ...form };
  localStorage.setItem('teacher-training-assessment-form-master', JSON.stringify(current));
}

function cleanSampleLabels(value: unknown, field = ''): unknown {
  if (typeof value === 'string') {
    if (/id$/i.test(field)) return value;
    const cleaned = value.replace(/^Sample data$/i, 'Demo data').replace(/\bSample\s+/gi, '');
    return cleaned === value ? value : cleaned.trim();
  }
  if (Array.isArray(value)) return value.map(item => cleanSampleLabels(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cleanSampleLabels(item, key)]));
  return value;
}

function cleanSavedDemoLabels() {
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key) continue;
    let value: unknown;
    try { value = JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { continue; }
    if (!Array.isArray(value)) continue;
    let changed = false;
    const cleaned = value.map(row => {
      if (!row || typeof row !== 'object' || !String((row as Record<string, unknown>).id ?? '').startsWith(samplePrefix)) return row;
      const next = cleanSampleLabels(row) as Record<string, unknown>;
      if (JSON.stringify(next) !== JSON.stringify(row)) changed = true;
      return next;
    });
    if (changed) localStorage.setItem(key, JSON.stringify(cleaned));
  }
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
  const scaleOptions = ['1 - Strongly Disagree', '2 - Disagree', '3 - Neutral', '4 - Agree', '5 - Strongly Agree'];
  const feedbackPrompts = [
    'Name of the School', 'Name of the Teacher', 'Contact Number',
    'The objectives of the training were clearly defined.', 'The training content/topics were relevant.', 'Participation and interaction were encouraged.',
    'The smart classroom components—Teaching Device (K-Yan), its features, and the use of multimedia content—were covered during the training.',
    'The training content was well organised and easy to follow.', 'This training experience will be useful in my teaching.', 'The trainer was knowledgeable about the training topics.',
    'The trainer was well prepared.', 'I am comfortable using digital technology for teaching.', 'Teaching Device (K-Yan) is easy to integrate into classroom teaching.',
    "A smart classroom will benefit students' learning.", 'A smart classroom is effective in saving time during teaching.',
    'A smart classroom makes it easier to explain abstract or difficult concepts.', 'The multimedia content provided in the smart classroom solution is useful.',
    'Overall feedback about the smart classroom', 'Any suggestions for improvement?', 'Are there any other topics that should have been covered?',
  ];
  const feedbackQuestions = feedbackPrompts.map((prompt, index) => {
    const ratingQuestion = index >= 3 && index <= 16;
    const overallQuestion = index === 17;
    return { id: `${samplePrefix}FEEDBACK-Q-${String(index + 1).padStart(2, '0')}`, prompt, options: ratingQuestion ? scaleOptions : overallQuestion ? ['Excellent', 'Very Good', 'Good', 'Fair', 'Poor'] : [], points: 0, required: true };
  });
  const preQuestion = (number: string, prompt: string, options: string[] = []): { id: string; prompt: string; options: string[]; points: number; required: boolean; selection?: 'multiple' } => ({ id: `${samplePrefix}PRE-Q-${number}`, prompt, options, points: 0, required: true });
  const confidenceOptions = ['Not at all confident', 'Slightly confident', 'Fairly confident', 'Completely confident'];
  const usageOptions = ['Never', 'Monthly', 'Weekly', 'Daily'];
  const preAssessmentQuestions = [
    preQuestion('01', 'Section A | School and Teacher Information\n1. School name *'),
    preQuestion('02', '2. School UDISE code *'),
    preQuestion('03', '3. Which grade(s) do you teach? *'),
    preQuestion('04', '4. What subject(s) do you teach? *'),
    preQuestion('05', '5. How many years have you been teaching? *'),
    preQuestion('06', 'Section B | Technology Exposure and Use\n6. Which of the following best characterizes your exposure and experience with technology in teaching–learning practice? *', ['I have extensively used technology in my teaching practice', 'I have moderately used technology in my teaching practices', 'I have occasionally used technology in my teaching practices', 'I have never used technology in my teaching practices']),
    { ...preQuestion('07', '7. Which of the following have you used DURING SCHOOL TEACHING? (Select all that apply) *', ['Projector', 'Videoconference Unit', 'Interactive Whiteboard e.g., Smartboard', 'Interactive Flat Panel (IFP)', 'Tablet', 'Smartphone', 'Desktop', 'Laptop', 'None of the above']), selection: 'multiple' as const },
    ...[
      'Websites like YouTube, Wikipedia, etc. for searching subject-specific content',
      'Text editor/Word Processing software, PowerPoint/Presentation software for preparing documents and presentations for teaching',
      'Excel/Spreadsheet software for calculating student grades',
      'Software for preparing assessment questions to save time and effort',
    ].map((statement, index) => preQuestion(`08-${String(index + 1).padStart(2, '0')}`, `Section B | Technology Exposure and Use\n8.${String.fromCharCode(97 + index)} How frequently do you use the following during your teaching-learning practice?\n${statement} *`, usageOptions)),
    ...[
      'I can use technology to execute different activities in my class',
      'I can use technology to search for new resources/digital TLMs (teaching-learning materials)',
      'I can use technology to use different types of teaching-learning materials/resources for my class',
      'I can use technology to explore and/or teach and learn a specific topic',
      'I can choose technology that enhances students’ learning on a lesson',
      'I can use technology to improve my teaching productivity',
      "I can promote students' creative thinking through the use of technology",
      'I can help all kind of learners (Visual/Auditory/Kinesthetic/Reading/Writing learners) to learn better by using digital content & technology',
      'I can control disruptive behavior in the classroom and calm students whenever they are noisy',
      'I can leverage technology to increase my teaching time and reduce my time on daily tasks like preparing homework, lesson plans and assessment',
      'I can use technology to apply a variety of assessment strategies like MCQs, Descriptive questions, etc. to assess students’ learning',
      'I can use technology to keep students engaged and motivated including students who show low interest in class',
    ].map((statement, index) => preQuestion(`09-${String(index + 1).padStart(2, '0')}`, `Section C | Confidence in Technology-Enabled Teaching\n9.${String.fromCharCode(97 + index)} How confident are you in doing the following activities?\n${statement} *`, confidenceOptions)),
    ...[
      'I can use a specific technology even when there is no one around to tell me what to do as I go',
      'I can use a specific technology if I have seen someone else using it before trying it myself',
      'I can use a specific technology if I can call someone for help if I get stuck',
      'I can use a specific technology if someone else helps me in getting started',
      'I can use a specific technology if I have used a similar technology before to do the same activity',
    ].map((statement, index) => preQuestion(`10-${String(index + 1).padStart(2, '0')}`, `Section D | Confidence in Using Specific Technologies\n10.${String.fromCharCode(97 + index)} Please rate your confidence in using a particular technology.\n${statement} *`, confidenceOptions)),
  ];
  const preAssessmentForm = { id: preAssessmentFormId, title: 'Digital Teaching Pre-assessment', kind: 'assessment', grading: 'non-graded', source: 'native', planCode: 'TP-DEMO-001', day: 1, stage: 'pre', maxMarks: 0, passMarks: 0, attemptLimit: 1, availableFrom: undefined, availableUntil: undefined, allowUnanswered: false, mandatory: true, comparable: false, questions: preAssessmentQuestions, createdAt: '2026-10-27T09:00:00.000Z' };
  const feedbackForm = { id: feedbackFormId, title: 'Teacher Training Feedback Form', kind: 'feedback', grading: 'non-graded', source: 'native', planCode: 'TP-DEMO-001', day: 3, stage: 'feedback', maxMarks: 0, passMarks: 0, attemptLimit: 1, availableFrom: '2026-10-27', availableUntil: '2026-11-12', allowUnanswered: false, mandatory: true, comparable: false, questions: feedbackQuestions, createdAt: '2026-10-27T09:00:00.000Z' };
  const preAnswers: Record<string, string> = {};
  const preTextAnswers = ['Ravindra Zilla Parishad High School', school.udise, 'Classes 6–8', 'Mathematics and Science', '8 years'];
  let preTextIndex = 0;
  preAssessmentQuestions.forEach((question, index) => {
    if (!question.options.length) preAnswers[question.id] = preTextAnswers[preTextIndex++] ?? '';
    else if (question.selection === 'multiple') preAnswers[question.id] = JSON.stringify([0, 2, 4, 7]);
    else preAnswers[question.id] = String(index === 5 ? 1 : index < 12 ? 2 : 2 + (index % 2));
  });
  const feedbackAnswers: Record<string, string> = {};
  feedbackQuestions.forEach((question, index) => {
    if (index === 0) feedbackAnswers[question.id] = school.school;
    else if (index === 1) feedbackAnswers[question.id] = 'Teacher';
    else if (index === 2) feedbackAnswers[question.id] = '9000000007';
    else if (question.options.length) feedbackAnswers[question.id] = String(index % question.options.length === 0 ? 3 : 4);
    else feedbackAnswers[question.id] = index === 18 ? 'The hands-on classroom activities were useful. More practice time with the teaching device would be helpful.' : 'Please include more examples of using digital content across different subjects.';
  });
  const feedbackScore = feedbackQuestions.reduce((sum, question) => {
    if (!question.options.length) return sum;
    const answerIndex = Number(feedbackAnswers[question.id]);
    const selectedOption = question.options[answerIndex] ?? '';
    const explicitRating = selectedOption.match(/^\s*(\d+)/)?.[1];
    return sum + (explicitRating ? Number(explicitRating) : question.options.length - answerIndex);
  }, 0);
  const feedbackMaxMarks = feedbackQuestions.reduce((sum, question) => question.options.length ? sum + Math.max(1, ...question.options.map(option => Number(option.match(/^\s*(\d+)/)?.[1] ?? 0))) : sum, 0);
  const plan = { id: planId, code: 'TP-DEMO-001', name: 'Digital Teaching Foundations', type: 'Hybrid', description: 'Program for practical digital teaching and classroom technology.', days: 3, beneficiaries: ['Teacher'], resources: [], learningResourceIds: ['video', 'manual', 'guide'], resourceAssignments: [{ id: `${samplePrefix}RESOURCE-001`, resource: 'Teacher training manual', fromDay: 1, toDay: 3, throughProjectEnd: false }, { id: `${samplePrefix}RESOURCE-002`, resource: preAssessmentForm.title, formId: preAssessmentFormId, fromDay: 1, toDay: 1, throughProjectEnd: false }, { id: `${samplePrefix}RESOURCE-003`, resource: feedbackForm.title, formId: feedbackFormId, fromDay: 3, toDay: 3, throughProjectEnd: false }], status: 'Active', createdAt: '2026-01-10T09:00:00.000Z' };
  const project = { id: projectId, odooId: 'DEMO-ODOO-001', odooReference: 'DEMO-TT-2026', name: 'Digital Teaching Improvement Project', code: 'PRJ-DEMO-001', sponsor: 'Schoolnet India', startDate: '2026-10-20', endDate: '2026-11-10', description: 'Project connecting trainer development to school based teacher training.', states: [school.state], assignedUsers: ['Demo2', 'Demo3', 'Demo4', 'Demo5'], status: 'Active', phases: [{ id: `${samplePrefix}PHASE-01`, name: 'Planning and school onboarding', sequence: 1, startDate: '2026-10-20', endDate: '2026-10-24', status: 'Completed' }, { id: `${samplePrefix}PHASE-02`, name: 'Teacher training delivery', sequence: 2, startDate: '2026-10-27', endDate: '2026-11-03', status: 'In Progress' }, { id: `${samplePrefix}PHASE-03`, name: 'Review and project closeout', sequence: 3, startDate: '2026-11-04', endDate: '2026-11-10', status: 'Not Started' }], trainingPlans: [plan.name], selectedTrainingPlanIds: [planId], batchImportPolicy: 'valid-rows' };
  const association = { id: associationId, projectId, trainingPlanId: planId, status: 'Active', createdAt: '2026-01-10T09:00:00.000Z', updatedAt: '2026-01-10T09:00:00.000Z' };
  const commonBatch = { projectId, projectName: project.name, projectPlanAssociationId: associationId, name: school.school, phaseId: `${samplePrefix}PHASE-02`, trainingCycle: '2026 Cycle 1', deliveryMode: 'Hybrid', schoolUdiseVenue: school.udise, schoolName: school.school, state: school.state, district: school.district, location: school.school, trainingPlanCode: plan.code, trainingPlanName: plan.name, trainingDuration: 3, trainingStartTime: '09:30', trainingEndTime: '15:30', trainerCode: trainer.userId ?? trainer.trainerCode, trainerProfileCode: trainer.trainerCode, trainerName: trainer.name, createdAt: '2026-01-10T09:00:00.000Z', createdBy: 'Demo2', registrationCapacity: 30, registrationWindowBeforeDays: 14, registrationWindowAfterDays: 0, attendanceCount: 3, assessmentCount: 1 };
  const batches = [
    { ...commonBatch, id: pastBatchId, batchCode: 'BATCH-DEMO-PAST', uniqueId: 'BATCH-DEMO-PAST', trainingStartDate: '2026-09-14', trainingDates: ['2026-09-14', '2026-09-15', '2026-09-16'], trainingEndAuto: '2026-09-16', openRegistration: false, status: 'Completed' },
    { ...commonBatch, id: upcomingBatchId, batchCode: 'BATCH-DEMO-NOV', uniqueId: 'BATCH-DEMO-NOV', trainingCycle: '2026 Cycle 2', trainingStartDate: '2026-11-10', trainingDates: ['2026-11-10', '2026-11-11', '2026-11-12'], trainingEndAuto: '2026-11-12', openRegistration: true, status: 'Scheduled', attendanceCount: 0, assessmentCount: 0 },
  ];
  const trainee = { id: demoTraineeId, traineeId: demoTraineeId, userId: 'Demo7', name: 'Trainee', email: 'demo7.trainee@example.org', phone: '+91 90000 10007', category: 'Teacher', schoolUdise: school.udise, schoolName: school.school, projectId, state: school.state, district: school.district, consentProvided: true, createdAt: '2026-01-10T09:00:00.000Z', createdBy: 'Demo2' };
  const pendingTrainee = { id: pendingTraineeId, traineeId: pendingTraineeId, name: 'Teacher Two', email: 'teacher.two@example.org', phone: '+91 90000 10008', category: 'Teacher', schoolUdise: school.udise, schoolName: school.school, projectId, state: school.state, district: school.district, consentProvided: true, createdAt: '2026-10-20T09:00:00.000Z', createdBy: 'Demo6' };
  const registrations = [
    { id: `${samplePrefix}REG-COMPLETE`, batchId: pastBatchId, batchCode: 'BATCH-DEMO-PAST', projectId, traineeId: demoTraineeId, userId: 'Demo7', traineeName: trainee.name, name: trainee.name, email: trainee.email, phone: trainee.phone, category: 'Teacher', consentProvided: true, status: 'Approved', registrationStatus: 'Approved', approvalStatus: 'Approved', approved: true, completed: true, source: 'Demo data', submittedAt: '2026-08-01T09:00:00.000Z', submittedBy: 'Demo7', reviewedBy: 'Demo6', reviewedAt: '2026-08-02T09:00:00.000Z' },
    { id: `${samplePrefix}REG-APPROVED`, batchId: upcomingBatchId, batchCode: 'BATCH-DEMO-NOV', projectId, traineeId: demoTraineeId, userId: 'Demo7', traineeName: trainee.name, name: trainee.name, email: trainee.email, phone: trainee.phone, category: 'Teacher', consentProvided: true, status: 'Approved', registrationStatus: 'Approved', approvalStatus: 'Approved', approved: true, source: 'Demo data', submittedAt: '2026-10-12T09:00:00.000Z', submittedBy: 'Demo7', reviewedBy: 'Demo6', reviewedAt: '2026-10-13T09:00:00.000Z' },
    { id: `${samplePrefix}REG-PENDING`, batchId: upcomingBatchId, batchCode: 'BATCH-DEMO-NOV', projectId, traineeId: pendingTraineeId, traineeName: pendingTrainee.name, name: pendingTrainee.name, email: pendingTrainee.email, phone: pendingTrainee.phone, category: 'Teacher', consentProvided: true, status: 'Pending', registrationStatus: 'Pending', approvalStatus: 'Pending', approved: false, source: 'Demo data', submittedAt: '2026-10-20T09:00:00.000Z', submittedBy: 'Demo7' },
  ];

  addSamples('teacher-training-projects', [project]);
  addSamples('teacher-training-plans', [plan]);
  upsertSampleForm(preAssessmentForm);
  addSamples('teacher-training-assessment-form-master', [feedbackForm]);
  const savedPlans = rows('teacher-training-plans');
  const savedPlanIndex = savedPlans.findIndex(item => item.id === planId);
  if (savedPlanIndex >= 0) {
    const assignments = Array.isArray(savedPlans[savedPlanIndex].resourceAssignments) ? savedPlans[savedPlanIndex].resourceAssignments : [];
    for (const assignment of plan.resourceAssignments) if (!assignments.some((item: Record<string, any>) => item.formId === assignment.formId)) assignments.push(assignment);
    savedPlans[savedPlanIndex] = { ...savedPlans[savedPlanIndex], resourceAssignments: assignments };
    localStorage.setItem('teacher-training-plans', JSON.stringify(savedPlans));
  }
  addSamples('teacher-training-project-plan-associations', [association]);
  addSamples('teacher-training-batch-plan-uses', batches);
  addSamples('teacher-training-trainees', [trainee, pendingTrainee]);
  addSamples('teacher-training-registrations', registrations);
  addSamples('teacher-training-attendance-records', ['2026-09-14', '2026-09-15', '2026-09-16'].map((trainingDate, index) => ({ id: `${samplePrefix}ATTENDANCE-${index + 1}`, projectId, batchId: pastBatchId, batchCode: 'BATCH-DEMO-PAST', trainingDate, traineeId: demoTraineeId, userId: 'Demo7', traineeName: trainee.name, status: index === 2 ? 'Absent' : 'Present', markedBy: 'Demo6', markedAt: `${trainingDate}T10:00:00.000Z` })));
  addSamples('teacher-training-assessment-records', [{ id: `${samplePrefix}ASSESSMENT-001`, projectId, batchId: pastBatchId, batchCode: 'BATCH-DEMO-PAST', traineeId: demoTraineeId, userId: 'Demo7', traineeName: trainee.name, name: 'Digital teaching post-assessment', status: 'Passed', completed: true, score: 86, submittedAt: '2026-09-16T12:00:00.000Z' }, { id: `${samplePrefix}ASSESSMENT-002`, projectId, batchId: upcomingBatchId, batchCode: 'BATCH-DEMO-NOV', traineeId: demoTraineeId, userId: 'Demo7', traineeName: trainee.name, name: 'Digital teaching pre-assessment', status: 'Pending', completed: false }]);
  const sampleAssessments = rows('teacher-training-assessment-records');
  const samplePreAssessment = sampleAssessments.findIndex(item => item.id === `${samplePrefix}ASSESSMENT-002`);
  if (samplePreAssessment >= 0) {
    sampleAssessments[samplePreAssessment] = { ...sampleAssessments[samplePreAssessment], formId: preAssessmentFormId, formTitle: preAssessmentForm.title, kind: 'assessment', grading: 'non-graded', planCode: plan.code, day: 1, stage: 'pre', status: 'Pending', completed: false, answers: {} };
    localStorage.setItem('teacher-training-assessment-records', JSON.stringify(sampleAssessments));
  }
  upsertSample('teacher-training-assessment-records', { id: `${samplePrefix}PRE-SUBMISSION-001`, projectId, batchId: pastBatchId, batchCode: 'BATCH-DEMO-PAST', traineeId: demoTraineeId, userId: 'Demo7', registrationId: `${samplePrefix}REG-COMPLETE`, traineeName: trainee.name, name: trainee.name, formId: preAssessmentFormId, formTitle: preAssessmentForm.title, kind: 'assessment', grading: 'non-graded', comparable: false, planCode: plan.code, day: 1, stage: 'pre', status: 'submitted', completed: true, submittedAt: '2026-09-14T08:45:00.000Z', answers: preAnswers });
  upsertSample('teacher-training-feedback-records', { id: `${samplePrefix}FEEDBACK-001`, projectId, batchId: pastBatchId, batchCode: 'BATCH-DEMO-PAST', traineeId: demoTraineeId, userId: 'Demo7', registrationId: `${samplePrefix}REG-COMPLETE`, traineeName: trainee.name, name: trainee.name, formId: feedbackFormId, formTitle: feedbackForm.title, kind: 'feedback', grading: 'non-graded', planCode: plan.code, day: 3, stage: 'feedback', status: 'rated', submitted: true, completed: true, submittedAt: '2026-09-16T13:00:00.000Z', answers: feedbackAnswers, score: feedbackScore, maxMarks: feedbackMaxMarks });
  addSamples('teacher-training-certificates', [{ id: `${samplePrefix}CERTIFICATE-001`, projectId, batchId: pastBatchId, batchCode: 'BATCH-DEMO-PAST', traineeId: demoTraineeId, userId: 'Demo7', traineeName: trainee.name, issued: true, status: 'Issued', issuedAt: '2026-09-20T09:00:00.000Z', certificateNumber: 'CERT-DEMO-0007' }]);
  addSamples('teacher-training-eligible-teachers', [{ id: `${samplePrefix}ELIGIBLE-TEACHERS`, schoolUdise: school.udise, projectId, eligible: true, participantType: 'teacher', count: 24 }]);
  addSamples('teacher-training-eligible-students', [{ id: `${samplePrefix}ELIGIBLE-STUDENTS`, schoolUdise: school.udise, projectId, eligible: true, participantType: 'student', count: 120 }]);
  addSamples('teacher-training-school-assignments', [{ id: `${samplePrefix}SCHOOL-ASSIGNMENT`, userId: 'Demo5', schoolUdise: school.udise, projectId }]);

  const availability: TrainerAvailability[] = ['2026-11-10', '2026-11-11', '2026-11-12'].map((date, index) => ({ id: `${samplePrefix}AVAILABILITY-${index + 1}`, trainerCode: trainer.userId ?? trainer.trainerCode, date, startTime: '09:00', endTime: '16:00', status: 'Available', remarks: 'Batch availability', createdBy: 'Demo6', updatedAt: '2026-10-01T09:00:00.000Z' }));
  addSamples(TRAINER_AVAILABILITY_KEY, availability as unknown as Record<string, any>[]);
  addSamples('teacher-training-holidays', [
    { id: `${samplePrefix}HOLIDAY-NATIONAL`, name: 'Children’s Day', date: '2026-11-14', scope: 'National', state: '', district: '', school: '', active: true, note: 'National holiday' },
    { id: `${samplePrefix}HOLIDAY-STATE`, name: 'Andhra Pradesh Formation Day', date: '2026-11-01', scope: 'State', state: 'Andhra Pradesh', district: '', school: '', active: true, note: 'State holiday' },
  ]);
  cleanSavedDemoLabels();
}
