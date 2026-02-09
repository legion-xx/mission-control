const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = 3333;
const DATA_FILE = path.join(__dirname, 'data', 'tasks.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({
    columns: ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'],
    tasks: [],
    notes: [],
    links: [],
    tags: [],
    activity: [],
    categories: ['ICON', 'Capstone', 'Personal', 'Atticus Setup'],
    settings: { theme: 'dark', focusMode: false, defaultView: 'dashboard' },
    nextId: 1,
    nextNoteId: 1,
    nextLinkId: 1,
    nextTagId: 1,
    nextActivityId: 1
  }, null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to add activity log
function addActivity(data, type, description, entityId = null, user = 'User') {
  const activity = {
    id: data.nextActivityId++,
    type,
    entityId,
    description,
    timestamp: new Date().toISOString(),
    user
  };
  data.activity.unshift(activity); // Add to beginning for latest first
  
  // Keep only last 100 activities
  if (data.activity.length > 100) {
    data.activity = data.activity.slice(0, 100);
  }
  
  return activity;
}

// Helper function to fetch page title
function fetchPageTitle(url, callback) {
  const client = url.startsWith('https:') ? https : http;
  
  try {
    const req = client.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
        // Stop if we have enough data to find title
        if (data.length > 50000) {
          req.destroy();
        }
      });
      
      res.on('end', () => {
        const titleMatch = data.match(/<title[^>]*>([^<]+)</i);
        const title = titleMatch ? titleMatch[1].trim() : url;
        callback(title);
      });
      
      res.on('error', () => callback(url));
    });
    
    req.on('error', () => callback(url));
    req.on('timeout', () => {
      req.destroy();
      callback(url);
    });
    
  } catch (error) {
    callback(url);
  }
}

// Get all data
app.get('/api/data', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  res.json(data);
});

// Dashboard endpoint - today's tasks and reminders
app.get('/api/today', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayTasks = data.tasks.filter(task => {
    if (!task.dueDate) return false;
    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate.getTime() === today.getTime();
  });
  
  const overdueTasks = data.tasks.filter(task => {
    if (!task.dueDate || task.column === 'Done') return false;
    const dueDate = new Date(task.dueDate);
    dueDate.setHours(23, 59, 59, 999);
    return dueDate < today;
  });
  
  const upcomingTasks = data.tasks.filter(task => {
    if (!task.dueDate) return false;
    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const sevenDays = new Date(today);
    sevenDays.setDate(sevenDays.getDate() + 7);
    return dueDate > today && dueDate <= sevenDays;
  });
  
  res.json({
    todayTasks,
    overdueTasks,
    upcomingTasks,
    recentActivity: data.activity.slice(0, 10)
  });
});

// Get due reminders
app.get('/api/reminders/due', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const now = new Date().getTime();
  
  const dueReminders = [];
  data.tasks.forEach(task => {
    task.reminders.forEach(reminder => {
      if (new Date(reminder.time).getTime() <= now && !reminder.fired) {
        dueReminders.push({
          ...reminder,
          taskId: task.id,
          taskTitle: task.title
        });
      }
    });
  });
  
  res.json(dueReminders);
});

// Mark reminder as fired
app.put('/api/reminders/:taskId/:reminderId/fire', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const task = data.tasks.find(t => t.id === parseInt(req.params.taskId));
  
  if (task) {
    const reminder = task.reminders.find(r => r.id === req.params.reminderId);
    if (reminder) {
      reminder.fired = true;
      task.updatedAt = new Date().toISOString();
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    }
  }
  
  res.json({ ok: true });
});

// Quick capture with natural language parsing
app.post('/api/quick-capture', (req, res) => {
  const { text, type = 'task' } = req.body;
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  
  if (type === 'task') {
    // Parse natural language for tasks
    let title = text;
    let priority = 'medium';
    let tags = [];
    let dueDate = null;
    let category = 'Personal';
    
    // Extract tags (#tagname)
    const tagMatches = text.match(/#(\w+)/g);
    if (tagMatches) {
      tags = tagMatches.map(tag => tag.substring(1));
      title = title.replace(/#\w+/g, '').trim();
    }
    
    // Extract priority (!high, !medium, !low)
    const priorityMatch = text.match(/!(high|medium|low)/i);
    if (priorityMatch) {
      priority = priorityMatch[1].toLowerCase();
      title = title.replace(/!(high|medium|low)/gi, '').trim();
    }
    
    // Extract due dates (tomorrow, today, specific dates)
    const today = new Date();
    if (/\btomorrow\b/i.test(text)) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dueDate = tomorrow.toISOString().split('T')[0];
      title = title.replace(/\btomorrow\b/gi, '').trim();
    } else if (/\btoday\b/i.test(text)) {
      dueDate = today.toISOString().split('T')[0];
      title = title.replace(/\btoday\b/gi, '').trim();
    }
    
    // Set category based on tags
    if (tags.includes('ICON') || tags.includes('icon')) {
      category = 'ICON';
    } else if (tags.includes('Capstone') || tags.includes('capstone')) {
      category = 'Capstone';
    } else if (tags.includes('setup')) {
      category = 'Atticus Setup';
    }
    
    const task = {
      id: data.nextId++,
      title,
      description: '',
      column: 'To Do',
      priority,
      category,
      assignee: 'Atticus',
      dueDate,
      tags,
      reminders: [],
      recurrence: null,
      attachedNotes: [],
      comments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    data.tasks.push(task);
    addActivity(data, 'task_created', `Task '${task.title}' created via quick capture`, task.id);
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.json(task);
    
  } else if (type === 'note') {
    const note = {
      id: data.nextNoteId++,
      title: text.split('\n')[0] || 'Quick Note',
      content: text,
      tags: [],
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    data.notes.push(note);
    addActivity(data, 'note_created', `Note '${note.title}' created via quick capture`, note.id);
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.json(note);
    
  } else if (type === 'link') {
    // Auto-fetch title for links
    fetchPageTitle(text, (title) => {
      const link = {
        id: data.nextLinkId++,
        url: text,
        title,
        description: '',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      data.links.push(link);
      addActivity(data, 'link_created', `Link '${link.title}' saved`, link.id);
      
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
      res.json(link);
    });
    return; // Don't send response immediately for links
  }
});

// TASKS API
app.get('/api/tasks', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  res.json(data.tasks);
});

app.post('/api/tasks', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const task = {
    id: data.nextId++,
    title: req.body.title || 'Untitled',
    description: req.body.description || '',
    column: req.body.column || 'Backlog',
    priority: req.body.priority || 'medium',
    category: req.body.category || 'Personal',
    assignee: req.body.assignee || 'Atticus',
    dueDate: req.body.dueDate || null,
    tags: req.body.tags || [],
    reminders: [],
    recurrence: null,
    attachedNotes: [],
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  data.tasks.push(task);
  addActivity(data, 'task_created', `Task '${task.title}' created`, task.id);
  
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json(task);
});

app.put('/api/tasks/:id', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const idx = data.tasks.findIndex(t => t.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  
  const oldTask = { ...data.tasks[idx] };
  data.tasks[idx] = { ...data.tasks[idx], ...req.body, updatedAt: new Date().toISOString() };
  
  // Log activity for significant changes
  if (oldTask.column !== data.tasks[idx].column) {
    addActivity(data, 'task_moved', `Task '${data.tasks[idx].title}' moved from ${oldTask.column} to ${data.tasks[idx].column}`, data.tasks[idx].id);
  }
  if (oldTask.priority !== data.tasks[idx].priority) {
    addActivity(data, 'task_updated', `Task '${data.tasks[idx].title}' priority changed to ${data.tasks[idx].priority}`, data.tasks[idx].id);
  }
  
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json(data.tasks[idx]);
});

app.delete('/api/tasks/:id', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const task = data.tasks.find(t => t.id === parseInt(req.params.id));
  if (task) {
    addActivity(data, 'task_deleted', `Task '${task.title}' deleted`, task.id);
  }
  
  data.tasks = data.tasks.filter(t => t.id !== parseInt(req.params.id));
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json({ ok: true });
});

// NOTES API
app.get('/api/notes', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  res.json(data.notes);
});

app.post('/api/notes', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const note = {
    id: data.nextNoteId++,
    title: req.body.title || 'Untitled Note',
    content: req.body.content || '',
    tags: req.body.tags || [],
    pinned: req.body.pinned || false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  data.notes.push(note);
  addActivity(data, 'note_created', `Note '${note.title}' created`, note.id);
  
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json(note);
});

app.put('/api/notes/:id', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const idx = data.notes.findIndex(n => n.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  
  data.notes[idx] = { ...data.notes[idx], ...req.body, updatedAt: new Date().toISOString() };
  addActivity(data, 'note_updated', `Note '${data.notes[idx].title}' updated`, data.notes[idx].id);
  
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json(data.notes[idx]);
});

app.delete('/api/notes/:id', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const note = data.notes.find(n => n.id === parseInt(req.params.id));
  if (note) {
    addActivity(data, 'note_deleted', `Note '${note.title}' deleted`, note.id);
  }
  
  data.notes = data.notes.filter(n => n.id !== parseInt(req.params.id));
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json({ ok: true });
});

// LINKS API
app.get('/api/links', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  res.json(data.links);
});

app.post('/api/links', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  
  fetchPageTitle(req.body.url, (title) => {
    const link = {
      id: data.nextLinkId++,
      url: req.body.url,
      title: req.body.title || title,
      description: req.body.description || '',
      tags: req.body.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    data.links.push(link);
    addActivity(data, 'link_created', `Link '${link.title}' saved`, link.id);
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.json(link);
  });
});

app.put('/api/links/:id', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const idx = data.links.findIndex(l => l.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  
  data.links[idx] = { ...data.links[idx], ...req.body, updatedAt: new Date().toISOString() };
  addActivity(data, 'link_updated', `Link '${data.links[idx].title}' updated`, data.links[idx].id);
  
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json(data.links[idx]);
});

app.delete('/api/links/:id', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const link = data.links.find(l => l.id === parseInt(req.params.id));
  if (link) {
    addActivity(data, 'link_deleted', `Link '${link.title}' deleted`, link.id);
  }
  
  data.links = data.links.filter(l => l.id !== parseInt(req.params.id));
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json({ ok: true });
});

// TAGS API
app.get('/api/tags', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  res.json(data.tags);
});

app.post('/api/tags', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const tag = {
    id: data.nextTagId++,
    name: req.body.name,
    color: req.body.color || '#6366f1'
  };
  
  data.tags.push(tag);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json(tag);
});

// SEARCH API
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ tasks: [], notes: [], links: [] });
  
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const query = q.toLowerCase();
  
  const tasks = data.tasks.filter(task => 
    task.title.toLowerCase().includes(query) ||
    task.description.toLowerCase().includes(query) ||
    task.tags.some(tag => tag.toLowerCase().includes(query))
  );
  
  const notes = data.notes.filter(note =>
    note.title.toLowerCase().includes(query) ||
    note.content.toLowerCase().includes(query) ||
    note.tags.some(tag => tag.toLowerCase().includes(query))
  );
  
  const links = data.links.filter(link =>
    link.title.toLowerCase().includes(query) ||
    link.description.toLowerCase().includes(query) ||
    link.url.toLowerCase().includes(query) ||
    link.tags.some(tag => tag.toLowerCase().includes(query))
  );
  
  res.json({ tasks, notes, links });
});

// SETTINGS API
app.get('/api/settings', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  res.json(data.settings);
});

app.put('/api/settings', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  data.settings = { ...data.settings, ...req.body };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json(data.settings);
});

// ACTIVITY API
app.get('/api/activity', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  res.json(data.activity);
});

// Comments API (for tasks)
app.post('/api/tasks/:id/comments', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const task = data.tasks.find(t => t.id === parseInt(req.params.id));
  if (!task) return res.status(404).json({ error: 'Not found' });
  
  const comment = {
    id: Date.now().toString(),
    text: req.body.text,
    author: req.body.author || 'User',
    createdAt: new Date().toISOString()
  };
  
  task.comments.push(comment);
  task.updatedAt = new Date().toISOString();
  addActivity(data, 'comment_added', `Comment added to task '${task.title}'`, task.id);
  
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json(comment);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mission Control v2 running at http://localhost:${PORT}`);
});