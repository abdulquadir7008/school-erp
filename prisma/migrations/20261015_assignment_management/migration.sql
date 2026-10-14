-- Complete Assignment Management System
-- Extends Assignment with section/teacher/year scoping, type, lifecycle status,
-- late-submission policy, rubric, attachments; adds per-student
-- AssignmentSubmission tracking plus an immutable submission-history table.

-- Enums
CREATE TYPE "AssignmentType" AS ENUM ('INDIVIDUAL', 'GROUP', 'PROJECT', 'PRACTICAL', 'RESEARCH');
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');
CREATE TYPE "AssignmentSubmissionStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'GRADED', 'LATE_SUBMITTED', 'RETURNED_FOR_REVISION', 'RESUBMITTED');

-- Assignment: new columns (legacy table already has id/title/description/classId/subjectId/totalMarks/dueDate/schoolId)
ALTER TABLE "Assignment" ADD COLUMN "sectionId" UUID;
ALTER TABLE "Assignment" ADD COLUMN "teacherId" UUID;
ALTER TABLE "Assignment" ADD COLUMN "academicYearId" UUID;
ALTER TABLE "Assignment" ADD COLUMN "instructions" TEXT;
ALTER TABLE "Assignment" ADD COLUMN "type" "AssignmentType" NOT NULL DEFAULT 'INDIVIDUAL';
ALTER TABLE "Assignment" ADD COLUMN "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Assignment" ADD COLUMN "lateSubmissionDate" TIMESTAMP(3);
ALTER TABLE "Assignment" ADD COLUMN "allowLateSubmission" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Assignment" ADD COLUMN "passingMarks" INTEGER;
ALTER TABLE "Assignment" ADD COLUMN "gradingCriteria" TEXT;
ALTER TABLE "Assignment" ADD COLUMN "referenceMaterials" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Assignment" ADD COLUMN "attachments" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Assignment" ADD COLUMN "status" "AssignmentStatus" NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "Assignment" ADD COLUMN "createdBy" UUID;

-- Assignment: indexes
CREATE INDEX IF NOT EXISTS "Assignment_sectionId_idx" ON "Assignment"("sectionId");
CREATE INDEX IF NOT EXISTS "Assignment_subjectId_idx" ON "Assignment"("subjectId");
CREATE INDEX IF NOT EXISTS "Assignment_teacherId_idx" ON "Assignment"("teacherId");
CREATE INDEX IF NOT EXISTS "Assignment_status_idx" ON "Assignment"("status");
CREATE INDEX IF NOT EXISTS "Assignment_dueDate_idx" ON "Assignment"("dueDate");
CREATE INDEX IF NOT EXISTS "Assignment_schoolId_classId_sectionId_idx" ON "Assignment"("schoolId", "classId", "sectionId");

-- Assignment: foreign keys
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AssignmentSubmission table (one current row per student per assignment)
CREATE TABLE "AssignmentSubmission" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "assignmentId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "status" "AssignmentSubmissionStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  "submissionText" TEXT,
  "attachments" JSONB NOT NULL DEFAULT '[]',
  "submittedAt" TIMESTAMP(3),
  "isLate" BOOLEAN NOT NULL DEFAULT false,
  "marksObtained" INTEGER,
  "feedback" TEXT,
  "reviewedBy" UUID,
  "reviewedAt" TIMESTAMP(3),
  "gradesPublished" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_studentId_key" ON "AssignmentSubmission"("assignmentId", "studentId");
CREATE INDEX "AssignmentSubmission_schoolId_idx" ON "AssignmentSubmission"("schoolId");
CREATE INDEX "AssignmentSubmission_assignmentId_idx" ON "AssignmentSubmission"("assignmentId");
CREATE INDEX "AssignmentSubmission_studentId_idx" ON "AssignmentSubmission"("studentId");
CREATE INDEX "AssignmentSubmission_status_idx" ON "AssignmentSubmission"("status");

ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AssignmentSubmissionHistory table (immutable snapshots per resubmit / grade change)
CREATE TABLE "AssignmentSubmissionHistory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "submissionId" UUID NOT NULL,
  "assignmentId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "AssignmentSubmissionStatus" NOT NULL,
  "submissionText" TEXT,
  "attachments" JSONB,
  "marksObtained" INTEGER,
  "feedback" TEXT,
  "createdBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentSubmissionHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssignmentSubmissionHistory_submissionId_idx" ON "AssignmentSubmissionHistory"("submissionId");
CREATE INDEX "AssignmentSubmissionHistory_assignmentId_idx" ON "AssignmentSubmissionHistory"("assignmentId");
CREATE INDEX "AssignmentSubmissionHistory_studentId_idx" ON "AssignmentSubmissionHistory"("studentId");
CREATE INDEX "AssignmentSubmissionHistory_schoolId_idx" ON "AssignmentSubmissionHistory"("schoolId");

ALTER TABLE "AssignmentSubmissionHistory" ADD CONSTRAINT "AssignmentSubmissionHistory_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
