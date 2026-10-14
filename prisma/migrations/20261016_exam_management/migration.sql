-- Complete Exam Management System
-- Class/section scoping (ExamClass), timetable fields on ExamSubject
-- (room, invigilator, duration, instructions), marks review workflow
-- with audit history, ARCHIVED exam status, grading policy support.

-- Enum changes
ALTER TYPE "ExamStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
CREATE TYPE "MarkStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- Exam: new columns
ALTER TABLE "Exam" ADD COLUMN "durationMin" INTEGER;
ALTER TABLE "Exam" ADD COLUMN "instructions" TEXT;
ALTER TABLE "Exam" ADD COLUMN "gradingPolicy" JSONB;
ALTER TABLE "Exam" ADD COLUMN "publishedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Exam_academicYearId_idx" ON "Exam"("academicYearId");

-- ExamClass: exam <-> class/section scoping
CREATE TABLE "ExamClass" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "examId" UUID NOT NULL,
  "classId" UUID NOT NULL,
  "sectionId" UUID,
  "schoolId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExamClass_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExamClass_examId_classId_sectionId_key" ON "ExamClass"("examId", "classId", "sectionId");
CREATE INDEX "ExamClass_examId_idx" ON "ExamClass"("examId");
CREATE INDEX "ExamClass_classId_idx" ON "ExamClass"("classId");
CREATE INDEX "ExamClass_schoolId_idx" ON "ExamClass"("schoolId");
ALTER TABLE "ExamClass" ADD CONSTRAINT "ExamClass_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamClass" ADD CONSTRAINT "ExamClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamClass" ADD CONSTRAINT "ExamClass_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing exams without scoping apply to every class in their school.
INSERT INTO "ExamClass" ("examId", "classId", "sectionId", "schoolId")
SELECT e."id", c."id", NULL, e."schoolId"
FROM "Exam" e JOIN "SchoolClass" c ON c."schoolId" = e."schoolId"
WHERE NOT EXISTS (SELECT 1 FROM "ExamClass" ec WHERE ec."examId" = e."id");

-- ExamSubject: timetable fields
ALTER TABLE "ExamSubject" ADD COLUMN "durationMin" INTEGER;
ALTER TABLE "ExamSubject" ADD COLUMN "room" TEXT;
ALTER TABLE "ExamSubject" ADD COLUMN "invigilatorId" UUID;
ALTER TABLE "ExamSubject" ADD COLUMN "instructions" TEXT;
CREATE INDEX IF NOT EXISTS "ExamSubject_examId_idx" ON "ExamSubject"("examId");
ALTER TABLE "ExamSubject" ADD CONSTRAINT "ExamSubject_invigilatorId_fkey" FOREIGN KEY ("invigilatorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mark: review workflow + attendance flags
ALTER TABLE "Mark" ADD COLUMN "status" "MarkStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Mark" ADD COLUMN "isAbsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Mark" ADD COLUMN "isExempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Mark" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "Mark" ADD COLUMN "approvedBy" UUID;
ALTER TABLE "Mark" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Mark" ADD COLUMN "submittedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Mark_status_idx" ON "Mark"("status");

-- MarkHistory: auditable corrections
CREATE TABLE "MarkHistory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "markId" UUID NOT NULL,
  "examSubjectId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "oldMarks" INTEGER,
  "newMarks" INTEGER,
  "oldStatus" "MarkStatus",
  "newStatus" "MarkStatus" NOT NULL,
  "reason" TEXT,
  "changedBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarkHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarkHistory_markId_idx" ON "MarkHistory"("markId");
CREATE INDEX "MarkHistory_examSubjectId_idx" ON "MarkHistory"("examSubjectId");
CREATE INDEX "MarkHistory_studentId_idx" ON "MarkHistory"("studentId");
CREATE INDEX "MarkHistory_schoolId_idx" ON "MarkHistory"("schoolId");
ALTER TABLE "MarkHistory" ADD CONSTRAINT "MarkHistory_markId_fkey" FOREIGN KEY ("markId") REFERENCES "Mark"("id") ON DELETE CASCADE ON UPDATE CASCADE;
