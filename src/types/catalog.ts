import type { Gender, Role, StudentStatus } from "@/lib/enums";

// Kiểu dữ liệu các dòng trả về từ API danh mục (khớp với select/include trong route).

export type FacultyRow = {
  id: string;
  code: string;
  name: string;
  _count: { classes: number; users: number };
};

export type CohortRow = {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  _count: { classes: number };
};

export type SemesterRow = {
  id: string;
  number: number;
  name: string;
  isLocked: boolean;
  // Số bản ghi điểm đang gắn với học kỳ này (mục 5.3.1).
  _count?: { conductScores: number };
};

export type AcademicYearRow = {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  semesters: SemesterRow[];
};

export type ClassRow = {
  id: string;
  code: string;
  name: string;
  facultyId: string;
  cohortId: string;
  advisorId: string;
  faculty: { id: string; name: string; code: string };
  cohort: { id: string; name: string };
  advisor: { id: string; fullName: string };
  _count: { students: number };
};

export type StudentRow = {
  id: string;
  studentCode: string;
  citizenId: string;
  fullName: string;
  gender: Gender | null;
  dob: string | null;
  status: StudentStatus;
  classId: string;
  class: { id: string; code: string; faculty: { name: string } };
};

export type UserRow = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: Role;
  facultyId: string | null;
  isActive: boolean;
  faculty: { id: string; name: string } | null;
};
