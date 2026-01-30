const fs = require('fs');
const path = require('path');

// Load team members
const { teamMembers } = require('./js/data.js');

const TASKS_FILE = path.join(__dirname, 'team_tasks.json');
const SCHEDULE_FILE = path.join(__dirname, 'team_scheduled_tasks.json');

// 1. Create the "All Team Members" schedule
const scheduleId = 'schedule_' + Date.now();
const todayStr = new Date().toISOString().split('T')[0];

const newSchedule = {
    id: scheduleId,
    title: 'Remind and Accountablity of Today Team Task ',
    description: 'Reminding and collecting the information and the current scenario about their task',
    memberId: 'all',
    eventName: 'Daily Task',
    recurrence: 'weekly-mon-fri',
    startTime: '09:00',
    endTime: '18:00',
    typeOfWork: 'Remote',
    createdAt: new Date().toISOString(),
    lastGenerated: todayStr, // Mark as generated today
    autoExtend: false
};

// 2. Read existing schedules and add new one
let schedules = [];
if (fs.existsSync(SCHEDULE_FILE)) {
    try {
        schedules = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    } catch (e) {
        console.error('Error reading schedule file:', e);
        schedules = [];
    }
}

// Identify schedules to remove (memberId === 'all')
const schedulesToRemove = schedules.filter(s => s.memberId === 'all');
const removedScheduleIds = new Set(schedulesToRemove.map(s => s.id));

// Remove them from the schedule list
schedules = schedules.filter(s => s.memberId !== 'all');
schedules.push(newSchedule);

fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedules, null, 2));
console.log('Restored schedule to team_scheduled_tasks.json');

// 3. Generate tasks for all team members
let tasks = [];
if (fs.existsSync(TASKS_FILE)) {
    try {
        tasks = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
    } catch (e) {
        console.error('Error reading tasks file:', e);
        tasks = [];
    }
}

// Remove tasks associated with the removed schedules
if (removedScheduleIds.size > 0) {
    const initialCount = tasks.length;
    tasks = tasks.filter(t => !removedScheduleIds.has(t.originScheduleId));
    console.log(`Removed ${initialCount - tasks.length} old tasks from previous 'all' schedules.`);
}

const activeTasksMap = new Set();
tasks.forEach(t => {
    if (t.originScheduleId) {
        const date = t.dueDate ? t.dueDate : (t.createdAt ? t.createdAt.split('T')[0] : '');
        activeTasksMap.add(`${t.originScheduleId}_${t.memberId}_${date}`);
    }
});

let count = 0;
teamMembers.forEach(member => {
    // Check for duplicates
    // The key includes scheduleId, so it will be unique to this new schedule.
    const key = `${scheduleId}_${member.id}_${todayStr}`;
    if (activeTasksMap.has(key)) return;
    
    const newTask = {
        id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        title: newSchedule.title,
        memberId: member.id,
        memberPhone: member.phone,
        description: newSchedule.description,
        eventName: newSchedule.eventName,
        dueDate: todayStr,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        originScheduleId: scheduleId,
        autoExtend: false,
        endTime: newSchedule.endTime
    };

    tasks.push(newTask);
    activeTasksMap.add(key); // Add to map to prevent duplicates within this run if member list has dupes
    count++;
});

fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
console.log(`Generated ${count} tasks for team members in team_tasks.json`);
