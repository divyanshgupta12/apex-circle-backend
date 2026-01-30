const fs = require('fs');
const path = require('path');

const tasksFile = path.join(__dirname, 'team_tasks.json');

try {
    const data = fs.readFileSync(tasksFile, 'utf8');
    const tasks = JSON.parse(data);
    
    const princeTasks = tasks.filter(t => t.memberId === 'tm006');
    
    let output = '';
    output += `Total tasks: ${tasks.length}\n`;
    output += 'Tasks for tm006 (Prince Jangra):\n';
    princeTasks.forEach(t => {
        output += `- ID: ${t.id}\n`;
        output += `  Title: ${t.title}\n`;
        output += `  Due: ${t.dueDate}\n`;
        output += `  Status: ${t.status}\n`;
        output += `  AutoExtended: ${t.autoExtend}\n`;
        output += `  Description: ${t.description}\n`;
        output += '---\n';
    });
    
    fs.writeFileSync('debug_output.txt', output);
    console.log('Done');

} catch (e) {
    fs.writeFileSync('debug_output.txt', 'Error: ' + e.message);
}
