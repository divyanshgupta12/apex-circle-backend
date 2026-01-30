# Team Member Portal - Documentation

## Overview
The Team Member Portal is a comprehensive system for managing team members, assigning tasks, scheduling events, and tracking rewards within The Apex Circle organization.

## Access Points

### Admin Portal
- **URL**: `/dashboard/admin/team-management.html`
- **Access**: Admin login required
- **Purpose**: Manage team members, assign tasks, create schedules, and assign rewards

### Team Member Portal
- **Login URL**: `/dashboard/team/login.html`
- **Dashboard URL**: `/dashboard/team/index.html`
- **Access**: Team member login required
- **Purpose**: View assigned tasks, event schedules, and rewards

## Team Member Credentials

### Team Members List:

1. **Mr. Divyansh Gupta - Team Leader**
   - Email: `divyansh.gupta@apexcircle.com`
   - Password: `divyansh2025`
   - ID: `tm001`

2. **Anurag Sangar - Registration Management**
   - Email: `anurag.sangar@apexcircle.com`
   - Password: `anurag2025`
   - ID: `tm002`

3. **Miss Palak - Guest Management**
   - Email: `palak@apexcircle.com`
   - Password: `palak2025`
   - ID: `tm003`

4. **Aman Yadav - Social Media & PR**
   - Email: `aman.yadav@apexcircle.com`
   - Password: `aman2025`
   - ID: `tm004`

5. **Aarti Yadav - Host & Anchor**
   - Email: `aarti.yadav@apexcircle.com`
   - Password: `aarti2025`
   - ID: `tm005`

6. **Prince Jangra - Event Coordinator**
   - Email: `prince.jangra@apexcircle.com`
   - Password: `prince2025`
   - ID: `tm006`

7. **Naman Singh - Social Media & PR**
   - Email: `naman.singh@apexcircle.com`
   - Password: `naman2025`
   - ID: `tm007`

8. **Drishti Pathak - Creative Team Head**
   - **Username:** `drishti.pathak@apexcircle.com`
   - **Password:** `drishti2025`
   - **Phone:** (Not provided)
   - **Portal:** [Team Dashboard](dashboard/team/login.html)

## Features

### Admin Features (Team Management Page)

#### 1. Team Members Tab
- View all team members
- See member details (name, position, email, ID)

#### 2. Task Assignment Tab
- Assign tasks to team members
- Set task title, description, event, due date, and status
- View all assigned tasks
- Edit and delete tasks

#### 3. Event Schedule Tab
- Create event schedules for team members
- Set event name, date, time, location, and description
- View all scheduled events
- Edit and delete schedules

#### 4. Reward Management Tab
- Assign rewards to team members
- Set reward title, amount, event, date, and description
- View all assigned rewards
- Edit and delete rewards

### Team Member Features (Dashboard)

#### 1. My Tasks Tab
- View all assigned tasks
- See task details (title, description, event, due date, status)
- Mark tasks as completed
- View task statistics

#### 2. Event Schedule Tab
- View all scheduled events
- See event details (name, date, time, location, role)
- Sorted by date

#### 3. My Rewards Tab
- View all received rewards
- See reward details (title, amount, event, date, description)
- View total reward amount
- Sorted by date (newest first)

## Data Storage

All task, schedule, and reward data is stored remotely (Neon DB) to ensure 24/7 availability and data isolation. 

The following keys are used in `sessionStorage` (not `localStorage`) for the current session only:
- `apex_user`: Current logged-in user data
- `apex_api_base`: Optional API base URL override
- `apex_neon_key`: Optional Neon API key for direct connection

No sensitive data is persisted in `localStorage`.

## Data Structure

### Task Object
```javascript
{
    id: "task_1234567890",
    title: "Task Title",
    memberId: "tm001",
    eventName: "Event Name",
    description: "Task description",
    dueDate: "2025-12-31",
    status: "pending" | "in-progress" | "completed",
    createdAt: "2025-01-01T00:00:00.000Z"
}
```

### Schedule Object
```javascript
{
    id: "schedule_1234567890",
    eventName: "Event Name",
    memberId: "tm001",
    date: "2025-12-31",
    startTime: "09:00",
    endTime: "17:00",
    location: "Venue Name",
    description: "Schedule description",
    createdAt: "2025-01-01T00:00:00.000Z"
}
```

### Reward Object
```javascript
{
    id: "reward_1234567890",
    title: "Reward Title",
    memberId: "tm001",
    eventName: "Event Name",
    amount: 1000,
    date: "2025-12-31",
    description: "Reward description",
    createdAt: "2025-01-01T00:00:00.000Z"
}
```

## Navigation

### Admin Sidebar Menu
- Dashboard
- Events
- Users & Clients
- **Team Management** (NEW)
- Guests & VIPs
- Sponsorships
- Marketing & PR
- Analytics
- Settings
- Logout

### Team Member Sidebar Menu
- Dashboard
- Logout

## Usage Instructions

### For Admins:

1. **Login** to admin portal
2. Navigate to **Team Management** from sidebar
3. Use tabs to:
   - View team members
   - Assign tasks using "Assign Task" button
   - Create schedules using "Add Schedule" button
   - Assign rewards using "Assign Reward" button
4. Manage existing items using Edit/Delete buttons

### For Team Members:

1. **Login** to team portal at `/dashboard/team/login.html`
2. View dashboard with three tabs:
   - **My Tasks**: See assigned tasks and mark them complete
   - **Event Schedule**: View upcoming events
   - **My Rewards**: View received rewards and total amount
3. Use "Refresh" buttons to reload data

## Technical Details

- **Authentication**: JavaScript-based authentication using sessionStorage
- **Data Persistence**: Remote Neon DB with local fallback
- **Responsive**: Works on desktop and mobile devices
- **Browser Compatibility**: Modern browsers (Chrome, Firefox, Safari, Edge)

## Future Enhancements

- Backend integration for data persistence
- Email notifications for task assignments
- Calendar view for schedules
- Task priority levels
- Reward points system
- Performance analytics
- File uploads for task attachments
- Comments/notes on tasks


