const express = require('express');
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

  // Verify if the user has any open tabs
  if (!userOpenTabs[userId] || Object.keys(userOpenTabs[userId]).length === 0) {
    console.log(`No open tabs found for userId=${userId}`);
    return res.json({ message: `No open tabs found for userId=${userId}` });
  }

  try {
    // Fetch live tabs that are currently open for the user
    const liveTabs = await fetchLiveTabs(userOpenTabs[userId]);

    // Transform URLs to valid form
    const validLiveTabs = Object.fromEntries(
      Object.entries(liveTabs).map(([tabId, url]) => {
        const validUrl = transformToValidUrl(url);
        return [tabId, validUrl];
      })
    );

    console.log('Valid Live Tabs:', validLiveTabs); // Log to debug

    // Send close commands to WebSocket clients
    const wss = req.app.get('wss');
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        Object.entries(validLiveTabs).forEach(([tabId, validUrl]) => {
          console.log(`Sending close command: ${validUrl} for userId=${userId}`); // Log to debug
          client.send(
            JSON.stringify({
              type: 'closeTab',
              url: validUrl,
              userId: userId,
            })
          );
        });
      }
    });

    res.json({
      status: 'success',
      message: `Request to close tabs sent for userId=${userId}.`,
      tabs: validLiveTabs,
    });
  } catch (err) {
    console.error('Error closing live tabs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to close all open tabs for a specific user
router.post('/closeAllTabs/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    // Call the closeAllLiveTabs function from the socket module
    const result = await socket.closeAllLiveTabs(userId, req);
    res.json(result);
  } catch (err) {
    console.error('Error closing all tabs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// API endpoint to fetch live tabs and close filtered tabs
router.post('/closeFilteredTabs', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // Fetch live open tabs
    const userOpenTabs = await fetchLiveTabs(userId);

    // Filter tabs based on your criteria (you need to implement this function)
    const filteredTabs = filterTabs(userOpenTabs); // Implement your filtering logic here

    // Close filtered tabs
    await closeFilteredTabs(userId, filteredTabs);

    res.json({
      status: 'success',
      message: `Requested to close ${filteredTabs.length} tabs for user ${userId}.`,
    });
  } catch (error) {
    console.error('Error closing filtered tabs:', error);
    res.status(500).json({ error: 'Failed to close filtered tabs' });
  }
});

module.exports = router;
