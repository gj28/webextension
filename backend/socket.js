const db = require('./db');
const WebSocket = require('ws');
const { transformToValidUrl } = require('./helpers');

// Function to determine if a new entry should be created based on the date
function shouldCreateNewEntry(lastDate) {
  const lastEntryDate = new Date(lastDate);
  const now = new Date();
  const oneDayInMillis = 24 * 60 * 60 * 1000;

  // Check if 24 hours have passed since the last entry
  return now - lastEntryDate >= oneDayInMillis;
}

// Handler for /monitor endpoint
async function handleMonitor(req, res) {
  console.log('Received data:', req.body);

  const { date, url, scannedFiles, problemFiles, userId } = req.body;

  if (!date || !url || !Number.isInteger(scannedFiles) || !Number.isInteger(problemFiles) || !userId) {
    return res.status(400).json({ error: 'Invalid input data' });
  }

  try {
    // Find existing entry for the current URL
    const { rows } = await db.query(
      'SELECT * FROM data.tab_data WHERE url = $1 AND user_id = $2 ORDER BY date DESC LIMIT 1',
      [url, userId]
    );
    let foundEntry = rows[0];

    if (!foundEntry || shouldCreateNewEntry(foundEntry.date)) {
      // Create new entry
      await db.query(
        'INSERT INTO data.tab_data (date, url, scanned_files, problem_files, user_id) VALUES ($1, $2, $3, $4, $5)',
        [date, url, scannedFiles, problemFiles, userId]
      );
    } else {
      // Update existing entry with incremented values
      await db.query(
        'UPDATE data.tab_data SET scanned_files = scanned_files + $1, problem_files = problem_files + $2 WHERE id = $3',
        [scannedFiles, problemFiles, foundEntry.id]
      );
    }

    console.log('Data stored in database:', req.body);
    res.json({ status: 'success' });
  } catch (error) {
    console.error('Error interacting with database:', error);
    res.status(500).json({ error: 'Failed to store data' });
  }
}

// Handler for /closeTab endpoint
function handleCloseTab(req, res) {
  const { userId } = req.params; // Extract userId from URL params
  const { tabId } = req.body; // Extract tabId from request body

  if (!tabId || !userId) {
    return res.status(400).json({ error: 'Tab ID and user ID are required' });
  }

  const wss = req.app.get('wss');
  const userOpenTabs = req.app.get('userOpenTabs');

  // Remove tab from userOpenTabs
  if (userOpenTabs[userId] && userOpenTabs[userId][tabId]) {
    delete userOpenTabs[userId][tabId];
  }

  // Broadcast the message to all connected WebSocket clients for the specific user
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: 'closeTab',
          tabId: tabId,
          userId: userId,
        })
      );
    }
  });

  res.json({
    status: 'success',
    message: `Request to close tab with ID ${tabId} and user ID ${userId} sent.`,
  });
}

// Handler for /tabData endpoint
async function handleGetTabData(req, res) {
  try {
    const { rows } = await db.query('SELECT * FROM data.tab_data');
    res.json(rows);
  } catch (error) {
    console.error('Error reading from database:', error);
    res.status(500).json({ error: 'Failed to read data' });
  }
}

// Function to fetch live open tabs data without any restrictions
async function fetchLiveTabs(userOpenTabs) {
  // Directly return userOpenTabs without filtering against the database
  console.log('Fetched live tabs:', userOpenTabs);
  return userOpenTabs; // Return as is to reflect currently open tabs
}

// Function to close all live tabs for a specific user
// Function to close all filtered tabs
async function closeFilteredTabs(userId, filteredTabs, wss) {
  // Send a closeTab message for each filtered tab
  Object.values(filteredTabs).forEach((url) => {
    const validUrl = transformToValidUrl(url); // Transform normalized URL to valid form

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: 'closeTab',
            url: validUrl, // Send the valid URL
            userId: userId,
          })
        );
      }
    });
  });

  console.log(`Sent closeTab messages for ${Object.keys(filteredTabs).length} tabs for user ${userId}.`);
}

module.exports = {
  handleMonitor,
  handleCloseTab,
  handleGetTabData,
  fetchLiveTabs,
  closeFilteredTabs
};
