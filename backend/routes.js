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

  try {
    const filteredTabs = await socket.fetchLiveTabs(userOpenTabs[userId]);
    res.json(filteredTabs);
  } catch (err) {
    console.error('Error fetching live tabs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to close live tabs for a specific user
router.post('/closeLiveTabs/:userId', async (req, res) => {
  const userId = req.params.userId;
  const userOpenTabs = req.app.get('userOpenTabs');

  if (!userOpenTabs[userId] || Object.keys(userOpenTabs[userId]).length === 0) {
    console.log(`No open tabs found for userId=${userId}`);
    return res.json({ message: `No open tabs found for userId=${userId}` });
  }

  try {
    const filteredTabs = await socket.fetchLiveTabs(userOpenTabs[userId]);

    // Close each tab returned by fetchLiveTabs
    const wss = req.app.get('wss');
    for (const url of Object.values(filteredTabs)) {
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'closeTab', url: url, userId: userId }));
        }
      });
    }

    res.json({ status: 'success', message: 'Request to close tabs sent.', tabs: filteredTabs });
  } catch (err) {
    console.error('Error closing live tabs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
