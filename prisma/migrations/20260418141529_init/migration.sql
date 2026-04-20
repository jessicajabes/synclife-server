-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'trainer', 'admin');

-- CreateEnum
CREATE TYPE "SetType" AS ENUM ('warmup', 'working');

-- CreateEnum
CREATE TYPE "PlanMode" AS ENUM ('weekly', 'sequential');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('in_progress', 'completed', 'skipped');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('synced', 'pending');

-- CreateEnum
CREATE TYPE "Feeling" AS ENUM ('light', 'normal', 'heavy');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "role" "Role" NOT NULL DEFAULT 'student',
    "trainer_id" UUID,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "muscle_groups" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "muscle_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "youtube_url" TEXT,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_muscle_groups" (
    "exercise_id" UUID NOT NULL,
    "muscle_group_id" UUID NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "exercise_muscle_groups_pkey" PRIMARY KEY ("exercise_id","muscle_group_id")
);

-- CreateTable
CREATE TABLE "workout_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "student_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_exercises" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "section_title" TEXT,
    "superset_group" INTEGER,
    "default_rest_seconds" INTEGER NOT NULL DEFAULT 60,
    "notes" TEXT,

    CONSTRAINT "template_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_exercise_sets" (
    "id" UUID NOT NULL,
    "template_exercise_id" UUID NOT NULL,
    "type" "SetType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reps_range" TEXT NOT NULL,
    "rest_seconds" INTEGER,

    CONSTRAINT "template_exercise_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "student_id" UUID NOT NULL,
    "mode" "PlanMode" NOT NULL,
    "week_map" JSONB,
    "sequence" JSONB,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sessions" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "workout_template_id" UUID NOT NULL,
    "template_version" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "status" "SessionStatus" NOT NULL DEFAULT 'in_progress',
    "total_volume" DOUBLE PRECISION,
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_exercise_logs" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "substituted_exercise_id" UUID,
    "feeling" "Feeling",
    "notes" TEXT,

    CONSTRAINT "session_exercise_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_sets" (
    "id" UUID NOT NULL,
    "session_exercise_log_id" UUID NOT NULL,
    "set_number" INTEGER NOT NULL,
    "type" "SetType" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "reps" INTEGER NOT NULL,
    "sub_reps" JSONB,

    CONSTRAINT "session_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "muscle_groups_name_key" ON "muscle_groups"("name");

-- CreateIndex
CREATE INDEX "exercise_muscle_groups_exercise_id_order_idx" ON "exercise_muscle_groups"("exercise_id", "order");

-- CreateIndex
CREATE INDEX "template_exercises_template_id_order_idx" ON "template_exercises"("template_id", "order");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_muscle_groups" ADD CONSTRAINT "exercise_muscle_groups_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_muscle_groups" ADD CONSTRAINT "exercise_muscle_groups_muscle_group_id_fkey" FOREIGN KEY ("muscle_group_id") REFERENCES "muscle_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_exercises" ADD CONSTRAINT "template_exercises_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workout_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_exercises" ADD CONSTRAINT "template_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_exercise_sets" ADD CONSTRAINT "template_exercise_sets_template_exercise_id_fkey" FOREIGN KEY ("template_exercise_id") REFERENCES "template_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_workout_template_id_fkey" FOREIGN KEY ("workout_template_id") REFERENCES "workout_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_exercise_logs" ADD CONSTRAINT "session_exercise_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_exercise_logs" ADD CONSTRAINT "session_exercise_logs_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_exercise_logs" ADD CONSTRAINT "session_exercise_logs_substituted_exercise_id_fkey" FOREIGN KEY ("substituted_exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_sets" ADD CONSTRAINT "session_sets_session_exercise_log_id_fkey" FOREIGN KEY ("session_exercise_log_id") REFERENCES "session_exercise_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
