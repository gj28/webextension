const db = require('./db');
const WebSocket = require('ws');

// Function to determine if a new entry should be created based on the date
function shouldCreateNewEntry(lastDate) {
  const lastEntryDate = new Date(lastDate);
  const now = new Date();
  const oneDayInMillis = 24 * 60 * 60 * 1000;

  // Check if 24 hours have passed since the last entry
  return (now - lastEntryDate) >= oneDayInMillis;
}

// Handler for /monitor endpoint
async function handleMonitor(req, res) {
  console.log('Received data:', req.body);

  const { date, url, scannedFiles, problemFiles } = req.body;

  if (!date || !url || !Number.isInteger(scannedFiles) || !Number.isInteger(problemFiles)) {
    return res.status(400).json({ error: 'Invalid input data' });
  }

  try {
    // Find existing entry for the current URL
    const { rows } = await db.query('SELECT * FROM data.tab_data WHERE url = $1 ORDER BY date DESC LIMIT 1', [url]);
    let foundEntry = rows[0];

    if (!foundEntry || shouldCreateNewEntry(foundEntry.date)) {
      // Create new entry
      await db.query(
        'INSERT INTO data.tab_data (date, url, scanned_files, problem_files) VALUES ($1, $2, $3, $4)',
        [date, url, scannedFiles, problemFiles]
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
  const tabUrl = req.body.url;
  if (!tabUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Broadcast the message to all connected WebSocket clients
  const wss = req.app.get('wss');
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'closeTab', url: tabUrl }));
    }
  });

  res.json({ status: 'success', message: `Request to close tab with URL ${tabUrl} sent.` });
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

// Function to fetch live open tabs data
async function fetchLiveTabs(openTabs) {
  const urls = Object.values(openTabs);
  const db = 'SELECT url FROM "data".aiurl WHERE url = ANY($1::text[])';

  try {
    const result = await db.query(db, [urls]);
    const existingUrls = result.rows.map(row => row.url);
    const filteredTabs = {};

    // Filter openTabs to include only those URLs that exist in the database
    for (const [tabId, url] of Object.entries(openTabs)) {
      if (existingUrls.includes(url)) {
        filteredTabs[tabId] = url;
      }
    }

    return filteredTabs;
  } catch (err) {
    console.error('Error querying database:', err);
    throw err;
  }
}

module.exports = {
  handleMonitor,
  handleCloseTab,
  handleGetTabData,
  shouldCreateNewEntry,
  fetchLiveTabs
};
