# The Apex Circle - Event Management System

A complete, professional event management website and dashboard system built with HTML, CSS, and JavaScript.

## Project Structure

```
The Apex Circle/
├── index.html                 # Home page
├── about.html                 # About Us page
├── services.html              # Services page
├── process.html               # Our Process page
├── collaborations.html        # Collaborations page (DTS partnership)
├── team.html                  # Our Team page
├── gallery.html               # Gallery page
├── contact.html               # Contact page
├── assets/
│   └── images/                # Image assets directory
│       ├── README.md          # Image naming conventions
│       └── .gitkeep           # Git tracking file
├── css/
│   ├── main.css              # Global styles and variables
│   ├── public.css            # Public website styles
│   └── dashboard.css         # Dashboard-specific styles
├── js/
│   ├── main.js               # Navigation and shared utilities
│   ├── auth.js               # Authentication system (demo)
│   ├── dashboard.js          # Dashboard logic and data rendering
│   └── data.js               # Dummy data for dashboard simulation
└── dashboard/
    ├── user/                 # Client/User Dashboard
    │   ├── login.html
    │   ├── index.html        # Dashboard overview
    │   ├── events.html       # Event management
    │   ├── guests.html       # Guest list management
    │   ├── sponsorships.html # Sponsorship status
    │   ├── marketing.html    # Marketing & PR
    │   └── profile.html      # Profile & settings
    └── admin/                # Admin Dashboard
        ├── login.html
        ├── index.html        # Admin dashboard overview
        ├── events.html       # Event management
        ├── users.html        # User & client management
        ├── guests.html       # Guest & VIP management
        ├── sponsorships.html # Sponsorship & finance tracking
        ├── marketing.html    # Marketing & PR campaigns
        ├── analytics.html    # Analytics dashboard
        └── settings.html     # System settings
```

## Features

### Public Website
- **Home**: Hero section, features, and call-to-action
- **About Us**: Company information, mission, values, and DTS partnership
- **Services**: Comprehensive service offerings
- **Our Process**: 8-step event management process
- **Collaborations**: DTS strategic partnership highlight
- **Our Team**: Team members with photos and roles
- **Gallery**: Event showcase with Teacher's Day 2025 event at Starex University
- **Contact**: Contact form and information

### User Dashboard (Client Portal)
- **Dashboard Overview**: Stats cards and recent activity
- **Event Management**: View and manage events
- **Guest List Management**: Manage guest registrations
- **Sponsorship Status**: View sponsorship information
- **Marketing & PR**: Track campaign progress
- **Profile & Settings**: Account management

### Admin Dashboard
- **Dashboard Overview**: Comprehensive stats and analytics
- **Event Management**: Full CRUD operations for events
- **User & Client Management**: Manage all users and clients
- **Guest & VIP Management**: Complete guest tracking
- **Sponsorship & Finance**: Track all sponsorships and revenue
- **Marketing & PR**: Campaign management
- **Analytics**: Charts and metrics (placeholders)
- **Settings**: System configuration

## Authentication
Authentication is client-side demo-only and uses browser sessionStorage.

## Getting Started

1. Open `index.html` in a web browser to view the public website
2. Navigate to `dashboard/user/login.html` for client portal
3. Navigate to `dashboard/admin/login.html` for admin portal


## Technical Details

- **Pure HTML5**: Semantic structure
- **CSS3**: Modern layout with Flexbox and Grid
- **Vanilla JavaScript**: No external frameworks
- **Data Persistence**: Remote-first system using PostgREST (Neon DB) with local JSON fallback.
  - **Data Isolation**: Session-based isolation using sessionStorage.
  - **Server Synchronization**: Team Dashboard syncs with the server to ensure data consistency.
  - **Admin Panel**: Manages global data and syncs with the server.
- **Modular Architecture**: Separate files for maintainability

## Deployment & Automation (24/7 Availability)

To ensure the system remains online 24/7 (even when your PC is off), the project is configured for deployment on **Netlify**.

### 1. Hosting
- The frontend (HTML/CSS/JS) is served globally via Netlify's CDN.
- **Result**: The website is accessible to users at any time from any device.

### 2. Server-Side Automation (Cron Jobs)
- A Scheduled Function (`netlify/functions/cron_tasks.js`) is configured in `netlify.toml` to run **Daily at 9:00 AM IST**.
- **Capabilities**:
  - Automatically generates new tasks based on recurring schedules.
  - Checks for and extends overdue tasks automatically.
  - Sends notifications (if SMS is configured).
- **Result**: Daily management tasks happen automatically without requiring an admin to be logged in.

### 3. Environment Variables
For the backend functions to work on Netlify, set the following environment variables in your Netlify Site Settings:
- `NEON_API_URL`: Your Neon DB REST endpoint.
- `NEON_API_KEY`: Your Neon DB API Key.
- `TEXTBEE_API_KEY` (Optional): For SMS notifications.
- `TEXTBEE_DEVICE_ID` (Optional): For SMS notifications.
