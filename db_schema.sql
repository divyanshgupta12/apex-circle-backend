-- Schema for The Apex Circle

-- Enable UUID extension if needed (though we use string IDs mostly)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: team_tasks
CREATE TABLE IF NOT EXISTS team_tasks (
    id TEXT PRIMARY KEY,
    title TEXT,
    "memberId" TEXT,
    "eventName" TEXT,
    description TEXT,
    "dueDate" TEXT,
    status TEXT,
    "createdAt" TEXT,
    "updatedAt" TEXT,
    "originScheduleId" TEXT,
    "autoExtend" BOOLEAN,
    "endTime" TEXT,
    "rewardAmount" NUMERIC,
    "memberPhone" TEXT,
    "extensionCount" INTEGER
);

-- Table: team_scheduled_tasks
CREATE TABLE IF NOT EXISTS team_scheduled_tasks (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    "memberId" TEXT,
    "eventName" TEXT,
    recurrence TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "typeOfWork" TEXT,
    "createdAt" TEXT,
    "lastGenerated" TEXT,
    "autoExtend" BOOLEAN,
    "updatedAt" TEXT,
    "dailyVariations" TEXT,
    "rewardAmount" NUMERIC
);

-- Table: team_rewards
CREATE TABLE IF NOT EXISTS team_rewards (
    id TEXT PRIMARY KEY,
    "memberId" TEXT,
    amount NUMERIC,
    reason TEXT,
    "createdAt" TEXT,
    status TEXT
);

-- Table: team_training_videos
CREATE TABLE IF NOT EXISTS team_training_videos (
    id TEXT PRIMARY KEY,
    title TEXT,
    url TEXT,
    description TEXT,
    "memberId" TEXT,
    "createdAt" TEXT,
    "updatedAt" TEXT,
    category TEXT
);
