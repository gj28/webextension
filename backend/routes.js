const express = require('express');
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

  try {
    const filteredTabs = await fetchLiveTabs(openTabs);
    res.json(filteredTabs);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
