const userDashboardData = {
    stats: {
        totalEvents: 0,
        registrationCount: 0,
        guestsManaged: 0,
        sponsorshipValue: 0 
    },
    events: [
        { id: 'evt001', title: 'Annual Corporate Gala', date: '2025-12-15', status: 'Upcoming', registrations: 120, guests: 15 },
        { id: 'evt002', title: 'Product Launch 2026', date: '2026-01-20', status: 'Planning', registrations: 0, guests: 5 },
        { id: 'evt003', title: 'Tech Innovation Summit', date: '2026-03-10', status: 'Upcoming', registrations: 450, guests: 30 },
        { id: 'evt004', title: 'Medical Research Conference', date: '2026-04-05', status: 'Pending', registrations: 0, guests: 0 },
        { id: 'evt005', title: 'Global Investors Meet', date: '2026-05-20', status: 'Planning', registrations: 25, guests: 8 },
        { id: 'evt006', title: 'National Career Fair 2026', date: '2026-06-15', status: 'Upcoming', registrations: 800, guests: 40 },
        { id: 'evt007', title: 'University Cultural Fest', date: '2026-02-28', status: 'Planning', registrations: 1200, guests: 50 },
        { id: 'evt008', title: 'City Center Inauguration', date: '2026-07-01', status: 'Upcoming', registrations: 300, guests: 100 },
        { id: 'evt009', title: 'National Day Parade', date: '2026-08-15', status: 'Upcoming', registrations: 5000, guests: 200 },
        { id: 'evt010', title: 'Corporate Strategic Meet', date: '2026-09-10', status: 'Planning', registrations: 50, guests: 10 },
        { id: 'evt011', title: 'Charity Gala Night', date: '2026-10-05', status: 'Pending', registrations: 0, guests: 0 }
    ],
    guests: [],
    sponsorships: [],
    marketing: []
};

const teamMembers = [
    { id: 'tm001', name: 'Mr. Divyansh Gupta', email: 'divyansh.gupta@apexcircle.com', position: 'Team Leader', phone: '', photo: 'assets/images/team-divyansh-gupta.jpeg' },
    { id: 'tm002', name: 'Anurag Sangar', email: 'anurag.sangar@apexcircle.com', position: 'Registration Management', phone: '', photo: 'assets/images/team-anurag-sangar.jpeg' },
    { id: 'tm003', name: 'Miss Palak', email: 'palak@apexcircle.com', position: 'Guest Management', phone: '', photo: 'assets/images/team-palak.jpeg' },
    { id: 'tm004', name: 'Aman Yadav', email: 'aman.yadav@apexcircle.com', position: 'Social Media & PR', phone: '', photo: 'assets/images/team-aman-yadav.jpeg' },
    { id: 'tm005', name: 'Aarti Yadav', email: 'aarti.yadav@apexcircle.com', position: 'Host & Anchor', phone: '', photo: 'assets/images/team-aarti-yadav.jpeg' },
    { id: 'tm006', name: 'Prince Jangra', email: 'prince.jangra@apexcircle.com', position: 'Event Coordinator', phone: '+919992515619', photo: 'assets/images/team-prince-jangra.jpeg' },
    { id: 'tm007', name: 'Naman Singh', email: 'naman.singh@apexcircle.com', position: 'Social Media & PR', phone: '+9178335091207', photo: 'assets/images/team-naman-singh.jpeg' },
    { id: 'tm008', name: 'Drishti Pathak', email: 'drishti.pathak@apexcircle.com', position: 'Creative Team Head', phone: '', photo: 'assets/images/team-drishti-pathak.jpeg' },
    { id: 'tm009', name: 'Deepti', email: 'deepti@apexcircle.com', position: 'Stage Coordinator', phone: '+919958546372', photo: 'assets/images/team-deepti.jpeg' }
];

const adminDashboardData = {
    stats: {
        totalEvents: 0,
        totalUsers: 0,
        totalGuests: 0,
        totalRevenue: 0,
        activeEvents: 0,
        pendingApprovals: 0
    },
    events: [],
    users: [],
    guests: [],
    sponsorships: [],
    marketing: [],
    analytics: { monthlyRevenue: [], eventTypes: [] }
};

// Ensure global access for browser
if (typeof window !== 'undefined') {
    window.teamMembers = teamMembers;
    window.userDashboardData = userDashboardData;
    window.adminDashboardData = adminDashboardData;
}

// Export data for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { userDashboardData, adminDashboardData, teamMembers };
}

