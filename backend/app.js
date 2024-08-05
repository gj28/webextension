const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const routes = require('./routes'); // Import routes
const cors = require('cors');
const url = require('url'); // Add URL module for parsing

const app = express();
const port = 5000;

const openTabs = {}; // Object to keep track of open tabs
const userConnections = {}; // Store WebSocket connections by user ID

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(routes); // Use routes

// Serve static files from the 'public' directory (optional)
app.use(express.static('public'));

// Create HTTP server with Express app
const server = http.createServer(app);

// WebSocket server for communication with the Chrome extension
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, request) => {
  const queryParams = url.parse(request.url, true).query;
  const userId = queryParams.userId;

  console.log(`WebSocket connection established for userId=${userId}`);

  // Store the connection for the specific user
  userConnections[userId] = ws;

  ws.on('message', (message) => {
    const msg = JSON.parse(message);
    const { type, tabId, url } = msg;

    switch (type) {
      case 'openTab':
        openTabs[tabId] = { url, userId };
        broadcastOpenTabs();
        break;
      case 'closeTab':
        delete openTabs[tabId];
        broadcastOpenTabs();
        break;
    }

    console.log(`Received message from userId=${userId}:`, message);
  });

  ws.on('close', () => {
    console.log(`WebSocket connection closed for userId=${userId}`);
    delete userConnections[userId];
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for userId=${userId}:`, error);
  });

  ws.send(JSON.stringify({ type: 'openTabs', tabs: getTabsForUser(userId) }));
});

// Function to broadcast the list of open tabs to all clients
function broadcastOpenTabs() {
  Object.values(userConnections).forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'openTabs', tabs: openTabs }));
    }
  });
}

// Function to get tabs for a specific user
function getTabsForUser(userId) {
  const userTabs = {};
  for (const [tabId, tabData] of Object.entries(openTabs)) {
    if (tabData.userId === userId) {
      userTabs[tabId] = tabData.url;
    }
  }
  return userTabs;
}

// Attach openTabs and userConnections to the app instance
app.set('openTabs', openTabs);
app.set('userConnections', userConnections);

// Pass WebSocket server to routes
app.set('wss', wss);

// Start server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
