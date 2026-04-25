-- CreateEnum
CREATE TYPE "CheckinFieldType" AS ENUM ('number', 'text', 'boolean', 'scale');

-- AlterTable
ALTER TABLE "session_exercise_logs" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "session_sets" ADD COLUMN     "reps_feeling" "Feeling",
ADD COLUMN     "weight_feeling" "Feeling";

-- CreateTable
CREATE TABLE "checkin_questions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "field_type" "CheckinFieldType" NOT NULL,
    "unit" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkin_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkin_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_answers" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "value_number" DECIMAL(10,2),
    "value_text" TEXT,
    "value_boolean" BOOLEAN,
    "value_scale" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checkin_questions_user_id_order_idx" ON "checkin_questions"("user_id", "order");

-- CreateIndex
CREATE INDEX "checkin_entries_user_id_date_idx" ON "checkin_entries"("user_id", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "checkin_entries_user_id_date_key" ON "checkin_entries"("user_id", "date");

-- CreateIndex
CREATE INDEX "checkin_answers_entry_id_idx" ON "checkin_answers"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_answers_entry_id_question_id_key" ON "checkin_answers"("entry_id", "question_id");

-- AddForeignKey
ALTER TABLE "checkin_questions" ADD CONSTRAINT "checkin_questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_entries" ADD CONSTRAINT "checkin_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_answers" ADD CONSTRAINT "checkin_answers_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "checkin_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_answers" ADD CONSTRAINT "checkin_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "checkin_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
