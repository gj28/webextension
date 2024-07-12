const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = 5000;

// Middleware
app.use(bodyParser.json());

// Define file path and name
const filePath = path.join(__dirname, 'tabData.json');

// Create HTTP server with Express app
const server = http.createServer(app);

// WebSocket server for communication with the Chrome extension
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket connection established');

  ws.on('message', (message) => {
    console.log('Received message from client:', message);
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// Function to determine if a new entry should be created based on the date
function shouldCreateNewEntry(lastDate) {
  const lastEntryDate = new Date(lastDate);
  const now = new Date();
  const oneDayInMillis = 24 * 60 * 60 * 1000;

  // Check if 24 hours have passed since the last entry
  return (now - lastEntryDate) >= oneDayInMillis;
}

// POST endpoint to receive and log data
app.post('/monitor', (req, res) => {
  console.log('Received data:', req.body);

  // Read existing data or initialize as empty array
  let jsonData = [];
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    if (data) {
      jsonData = JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading file:', error);
  }

  // Find existing entry for the current URL
  let foundEntry = jsonData.find(entry => entry.url === req.body.url);

  // Check if new entry should be created or existing updated
  if (!foundEntry || shouldCreateNewEntry(foundEntry.date)) {
    // Create new entry
    jsonData.push({
      date: req.body.date,
      url: req.body.url,
      scannedFiles: req.body.scannedFiles,
      problemFiles: req.body.problemFiles
    });
  } else {
    // Update existing entry with incremented values
    foundEntry.scannedFiles += req.body.scannedFiles;
    foundEntry.problemFiles += req.body.problemFiles;
  }

  // Write updated data back to file
  fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Error writing file:', err);
      res.status(500).json({ error: 'Failed to store data' });
    } else {
      console.log('Data written to file:', req.body);
      res.json({ status: 'success' });
    }
  });
});

// Endpoint to close tab based on URL
app.post('/closeTab', (req, res) => {
  const tabUrl = req.body.url;
  if (!tabUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Broadcast the message to all connected WebSocket clients
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'closeTab', url: tabUrl }));
    }
  });

  res.json({ status: 'success', message: `Request to close tab with URL ${tabUrl} sent.` });
});

// GET endpoint to serve tabData.json content
app.get('/tabData', (req, res) => {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      res.status(500).json({ error: 'Failed to read data' });
    } else {
      let jsonData = [];
      try {
        if (data) {
          jsonData = JSON.parse(data);
        }
      } catch (error) {
        console.error('Error parsing JSON:', error);
        res.status(500).json({ error: 'Failed to parse JSON data' });
          return;
      }
      res.json(jsonData);
    }
  });
});

// Serve static files from the 'public' directory (optional)
app.use(express.static('public'));

// Start server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
