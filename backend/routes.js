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

  if (!openTabs || Object.keys(openTabs).length === 0) {
    console.log('No open tabs found');
    return res.json({ message: 'No open tabs found' });
  }

  try {
    const filteredTabs = await socket.fetchLiveTabs(openTabs);
    res.json(filteredTabs);
  } catch (err) {
    console.error('Error fetching live tabs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/masterClose', async (req, res) => {
  const openTabs = req.app.get('openTabs');

  if (!openTabs || Object.keys(openTabs).length === 0) {
    console.log('No open tabs found');
    return res.json({ message: 'No open tabs found' });
  }

  try {
    const result = await socket.closeAllTabs(openTabs);
    res.json(result);
  } catch (err) {
    console.error('Error closing all tabs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


module.exports = router;
