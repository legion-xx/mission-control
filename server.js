const express = require('express');
const fs = require('fs');
const path = require('path');

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
    categories: ['ICON', 'Capstone', 'Personal', 'Atticus Setup'],
    nextId: 1
  }, null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Get all data
app.get('/api/tasks', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  res.json(data);
});

// Create task
app.post('/api/tasks', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const task = {
    id: data.nextId++,
    title: req.body.title || 'Untitled',
    description: req.body.description || '',
    column: req.body.column || 'Backlog',
    priority: req.body.priority || 'medium', // low, medium, high
    category: req.body.category || 'Personal',
    assignee: req.body.assignee || 'Adam', // Adam or Atticus
    dueDate: req.body.dueDate || null,
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.tasks.push(task);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json(task);
});

// Update task
app.put('/api/tasks/:id', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const idx = data.tasks.findIndex(t => t.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  
  data.tasks[idx] = { ...data.tasks[idx], ...req.body, updatedAt: new Date().toISOString() };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json(data.tasks[idx]);
});

// Delete task
app.delete('/api/tasks/:id', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  data.tasks = data.tasks.filter(t => t.id !== parseInt(req.params.id));
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json({ ok: true });
});

// Add comment to task
app.post('/api/tasks/:id/comments', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const task = data.tasks.find(t => t.id === parseInt(req.params.id));
  if (!task) return res.status(404).json({ error: 'Not found' });
  
  const comment = {
    text: req.body.text,
    author: req.body.author || 'Adam',
    createdAt: new Date().toISOString()
  };
  task.comments.push(comment);
  task.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json(comment);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mission Control running at http://localhost:${PORT}`);
});
