-- Schema for The Apex Circle

-- Enable UUID extension if needed (though we use string IDs mostly)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: team_tasks
CREATE TABLE IF NOT EXISTS team_tasks (
    id TEXT PRIMARY KEY,
    title TEXT,
    "memberId" TEXT,  -- Quoted to preserve camelCase if needed, but standard SQL is snake_case. The JSON uses camelCase.
                      -- Neon/Postgres is case-insensitive unless quoted.
                      -- The API logic usually maps JSON fields to columns. 
                      -- Let's use snake_case for columns and assume the API handles mapping, 
                      -- OR stick to quoted identifiers to match JSON exactly for simplicity with generic REST APIs.
                      -- The existing Netlify functions seem to use `memberId` in query strings (PostgREST style).
                      -- PostgREST usually expects columns to match.
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
