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

// Endpoint to fetch live open tabs data
router.get('/liveTabs', async (req, res) => {
  const openTabs = req.app.get('openTabs');
  const userId = req.query.userId; // Retrieve userId from query parameters

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (!openTabs || Object.keys(openTabs).length === 0) {
    console.log('No open tabs found');
    return res.json({ message: 'No open tabs found' });
  }

  try {
    const filteredTabs = await socket.fetchLiveTabs(openTabs);
    res.json({ userId, tabs: filteredTabs });
  } catch (err) {
    console.error('Error fetching live tabs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/closeLiveTabs', async (req, res) => {
  const openTabs = req.app.get('openTabs');
  const userId = req.body.userId; // Retrieve userId from request body

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (!openTabs || Object.keys(openTabs).length === 0) {
    console.log('No open tabs found');
    return res.json({ message: 'No open tabs found' });
  }

  try {
    const filteredTabs = await socket.fetchLiveTabs(openTabs);

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
