const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const routes = require('./routes');
const cors = require('cors');

const app = express();
const port = 5000;

const openTabs = {}; // Object to keep track of open tabs

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

wss.on('connection', (ws, req) => {
  const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const userId = urlParams.get('userId');

  console.log(`WebSocket connection established for userId: ${userId}`);

  ws.on('message', (message) => {
    const msg = JSON.parse(message);
    const { type, tabId, url } = msg;

    switch (type) {
      case 'openTab':
        openTabs[tabId] = url;
        broadcastOpenTabs();
        break;
      case 'closeTab':
        delete openTabs[tabId];
        broadcastOpenTabs();
        break;
    }

    console.log('Received message from client:', message);
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });

  ws.send(JSON.stringify({ type: 'openTabs', tabs: openTabs }));
});

// Function to broadcast the list of open tabs to all clients
function broadcastOpenTabs() {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'openTabs', tabs: openTabs }));
    }
  });
}

// Attach openTabs to the app instance
app.set('openTabs', openTabs);

// Pass WebSocket server to routes
app.set('wss', wss);

// Start server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
