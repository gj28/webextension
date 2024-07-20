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
router.get('/liveTabs', (req, res) => {
  const openTabs = req.app.get('openTabs');
  res.json(openTabs);
});

module.exports = router;
