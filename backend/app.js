const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const routes = require('./routes'); // Import routes

const app = express();
const port = 5000;

// Middleware
app.use(bodyParser.json());
app.use(routes); // Use routes

// Serve static files from the 'public' directory (optional)
app.use(express.static('public'));

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

// Pass WebSocket server to routes
app.set('wss', wss);

// Start server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
