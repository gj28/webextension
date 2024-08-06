const express = require('express');
const WebSocket = require('ws');
const router = express.Router();
const socket = require('./socket');
const authentication = require('./auth/authentication');
const { fetchLiveTabs, transformToValidUrl } = require('./helpers'); // Import the new function

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
    // Normalize and fetch tabs
    const liveTabs = await fetchLiveTabs(userOpenTabs[userId]);
    res.json(liveTabs);
  } catch (err) {
    console.error('Error fetching live tabs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to close live tabs for a specific user
router.post('/closeLiveTabs/:userId', async (req, res) => {
  const userId = req.params.userId;
  const userOpenTabs = req.app.get('userOpenTabs');

  // Check if the "close" flag is set to true in the request body
  const { close } = req.body;
  if (close !== true) {
    return res.status(400).json({ error: 'Invalid request. Please provide { "close": true } in the request body.' });
  }

  if (!userOpenTabs[userId] || Object.keys(userOpenTabs[userId]).length === 0) {
    console.log(`No open tabs found for userId=${userId}`);
    return res.json({ message: `No open tabs found for userId=${userId}` });
  }

  try {
    // Fetch live tabs that are currently open for the user
    const liveTabs = await fetchLiveTabs(userOpenTabs[userId]);

    // Close each tab for the specified user
    const wss = req.app.get('wss');
    for (const url of Object.values(liveTabs)) {
      const validUrl = transformToValidUrl(url); // Transform the URL to a valid form
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({ type: 'closeTab', url: validUrl, userId: userId })
          );
        }
      });
    }

    res.json({
      status: 'success',
      message: `Request to close tabs sent for userId=${userId}.`,
      tabs: liveTabs,
    });
  } catch (err) {
    console.error('Error closing live tabs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
