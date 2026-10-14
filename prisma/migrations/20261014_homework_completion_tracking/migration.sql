-- Homework Management & Completion Tracking
-- Extends Homework with section/subject/teacher/year scoping, dates, priority,
-- publish status, attachments; adds per-student HomeworkSubmission tracking.

-- Enums
CREATE TYPE "HomeworkStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "HomeworkPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "HomeworkSubmissionStatus" AS ENUM ('PENDING', 'COMPLETED', 'NOT_SUBMITTED');

-- Homework: normalize subjectId to UUID (existing values are expected to be NULL or UUID text)
ALTER TABLE "Homework" ALTER COLUMN "subjectId" TYPE UUID USING "subjectId"::UUID;

-- Homework: new columns
ALTER TABLE "Homework" ADD COLUMN "sectionId" UUID;
ALTER TABLE "Homework" ADD COLUMN "teacherId" UUID;
ALTER TABLE "Homework" ADD COLUMN "academicYearId" UUID;
ALTER TABLE "Homework" ADD COLUMN "homeworkDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Homework" ADD COLUMN "priority" "HomeworkPriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Homework" ADD COLUMN "status" "HomeworkStatus" NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "Homework" ADD COLUMN "attachments" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Homework" ADD COLUMN "createdBy" UUID;

-- Homework: indexes (schoolId column + index already exist on legacy table)
CREATE INDEX IF NOT EXISTS "Homework_sectionId_idx" ON "Homework"("sectionId");
CREATE INDEX IF NOT EXISTS "Homework_subjectId_idx" ON "Homework"("subjectId");
CREATE INDEX IF NOT EXISTS "Homework_teacherId_idx" ON "Homework"("teacherId");
CREATE INDEX IF NOT EXISTS "Homework_status_idx" ON "Homework"("status");
CREATE INDEX IF NOT EXISTS "Homework_dueDate_idx" ON "Homework"("dueDate");
CREATE INDEX IF NOT EXISTS "Homework_schoolId_classId_sectionId_idx" ON "Homework"("schoolId", "classId", "sectionId");

-- Homework: foreign keys
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- HomeworkSubmission table
CREATE TABLE "HomeworkSubmission" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "homeworkId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "status" "HomeworkSubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "submittedAt" TIMESTAMP(3),
  "submissionText" TEXT,
  "attachmentUrl" TEXT,
  "teacherRemark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HomeworkSubmission_homeworkId_studentId_key" ON "HomeworkSubmission"("homeworkId", "studentId");
CREATE INDEX "HomeworkSubmission_schoolId_idx" ON "HomeworkSubmission"("schoolId");
CREATE INDEX "HomeworkSubmission_homeworkId_idx" ON "HomeworkSubmission"("homeworkId");
CREATE INDEX "HomeworkSubmission_studentId_idx" ON "HomeworkSubmission"("studentId");
CREATE INDEX "HomeworkSubmission_status_idx" ON "HomeworkSubmission"("status");

ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
