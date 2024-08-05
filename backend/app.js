const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const routes = require('./routes');
const cors = require('cors');

const app = express();
const port = 5000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Serve static files from the 'public' directory (optional)
app.use(express.static('public'));

// Create HTTP server with Express app
const server = http.createServer(app);

// WebSocket server for communication with the Chrome extension
const wss = new WebSocket.Server({ server, path: '/socket' });

const userOpenTabs = {}; // Object to keep track of user-specific open tabs

wss.on('connection', (ws, req) => {
  const urlParams = new URLSearchParams(req.url.split('?')[1]);
  const userId = urlParams.get('userId');

  if (!userId) {
    ws.close(4001, 'User ID not provided');
    return;
  }

  console.log(`WebSocket connection established for userId=${userId}`);

  if (!userOpenTabs[userId]) {
    userOpenTabs[userId] = {};
  }

  ws.on('message', (message) => {
    const msg = JSON.parse(message);
    const { type, tabId, url } = msg;

    switch (type) {
      case 'openTab':
        userOpenTabs[userId][tabId] = url;
        broadcastOpenTabs(userId);
        break;
      case 'closeTab':
        delete userOpenTabs[userId][tabId];
        broadcastOpenTabs(userId);
        break;
      default:
        console.log(`Unknown message type received from userId=${userId}:`, message);
    }

    console.log(`Received message from userId=${userId}:`, message);
  });

  ws.on('close', () => {
    console.log(`WebSocket connection closed for userId=${userId}`);
  });

  // Send the initial state of open tabs to the client
  ws.send(JSON.stringify({ type: 'openTabs', tabs: userOpenTabs[userId] }));
});

// Function to broadcast the list of open tabs to all clients for a specific user
function broadcastOpenTabs(userId) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'openTabs', tabs: userOpenTabs[userId] }));
    }
  });
}

// Attach userOpenTabs to the app instance
app.set('userOpenTabs', userOpenTabs);

// Pass WebSocket server to routes
app.set('wss', wss);

// Use routes
app.use(routes);

// Start server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
