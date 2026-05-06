export type DevPreviewMode = 'off' | 'teacher' | 'student';

export const isDevPreviewAvailable = Boolean((import.meta as any).env?.DEV);

export const DEV_PREVIEW_USERS = {
  teacher: {
    uid: 'dev-preview-teacher-misaki',
    email: 'misaki.nihongo@gmail.com',
    displayName: 'Misaki Preview',
    role: 'teacher' as const,
  },
  student: {
    uid: 'dev-preview-student-test',
    email: 'mtokuyama23@gmail.com',
    displayName: 'Test Student Preview',
    role: 'student' as const,
  },
};

export const DEV_PREVIEW_STUDENTS = [
  {
    uid: DEV_PREVIEW_USERS.student.uid,
    email: DEV_PREVIEW_USERS.student.email,
    name: DEV_PREVIEW_USERS.student.displayName,
    role: 'student' as const,
  },
];

export const getDevPreviewUser = (mode: DevPreviewMode) => {
  if (!isDevPreviewAvailable || mode === 'off') return null;
  return mode === 'teacher' ? DEV_PREVIEW_USERS.teacher : DEV_PREVIEW_USERS.student;
};
