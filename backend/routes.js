const express = require('express');
const WebSocket = require('ws');
const router = express.Router();
const socket = require('./socket');
const authentication = require('./auth/authentication');

// Existing endpoints
router.post('/monitor', socket.handleMonitor);
router.post('/closeTab', socket.handleCloseTab);
router.get('/tabData', socket.handleGetTabData);
router.post('/login', authentication.login);
router.get('/user', authentication.user);

// Endpoint to fetch live open tabs data for a specific user
router.get('/liveTabs/:userId', async (req, res) => {
  const userId = req.params.userId;
  const userOpenTabs = req.app.get('userOpenTabs');

  if (!userOpenTabs[userId] || Object.keys(userOpenTabs[userId]).length === 0) {
    console.log(`No open tabs found for userId=${userId}`);
    return res.json({ message: `No open tabs found for userId=${userId}` });
  }

  // Simply return all open tabs for the user without database restriction
  const openTabs = userOpenTabs[userId];
  console.log(`Open tabs for userId=${userId}:`, openTabs);

  res.json({ status: 'success', tabs: openTabs });
});

// Endpoint to close live tabs for a specific user
router.post('/closeLiveTabs/:userId', async (req, res) => {
  const userId = req.params.userId;
  const userOpenTabs = req.app.get('userOpenTabs');

  if (!userOpenTabs[userId] || Object.keys(userOpenTabs[userId]).length === 0) {
    console.log(`No open tabs found for userId=${userId}`);
    return res.json({ message: `No open tabs found for userId=${userId}` });
  }

  const openTabs = userOpenTabs[userId];
  console.log(`Closing tabs for userId=${userId}:`, openTabs);

  // Broadcast close tab messages for each open tab
  const wss = req.app.get('wss');
  for (const url of Object.values(openTabs)) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'closeTab', url: url, userId: userId }));
      }
    });
  }

  res.json({ status: 'success', message: 'Request to close tabs sent.', tabs: openTabs });
});

module.exports = router;
