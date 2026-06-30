import type { Classification, StudentStatus } from "@/lib/enums";

export type ScoreRow = {
  studentId: string;
  studentCode: string;
  citizenId: string;
  fullName: string;
  status: StudentStatus;
  score: {
    id: string;
    score: number;
    classification: Classification;
    note: string | null;
  } | null;
};

export type ScoresResponse = {
  semester: { id: string; name: string; isLocked: boolean };
  canMutate: boolean;
  rows: ScoreRow[];
};

export type ClassOption = {
  id: string;
  code: string;
  name: string;
  faculty: { name: string };
};

export type SemesterOption = {
  id: string;
  number: number;
  name: string;
  isLocked: boolean;
  academicYear: { name: string };
};
