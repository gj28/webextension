const express = require('express');
const router = express.Router();
const { handleMonitor, handleCloseTab, handleGetTabData } = require('./socket');

// POST endpoint to receive and log data
router.post('/monitor', handleMonitor);

// Endpoint to close tab based on URL
router.post('/closeTab', handleCloseTab);

// GET endpoint to serve tabData.json content
router.get('/tabData', handleGetTabData);

module.exports = router;
