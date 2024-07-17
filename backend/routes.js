const express = require('express');
const router = express.Router();
const socket = require('./socket');
const authentication = require('./auth/authentication');

// POST endpoint to receive and log data
router.post('/monitor', socket.handleMonitor);

// Endpoint to close tab based on URL
router.post('/closeTab', socket.handleCloseTab);

// GET endpoint to serve tabData.json content
router.get('/tabData', socket.handleGetTabData);


router.post('/login', authentication.login);


router.get('/user', authentication.user);

module.exports = router;
