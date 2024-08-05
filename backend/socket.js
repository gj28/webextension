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

  const { date, url, scannedFiles, problemFiles, userId } = req.body;

  if (!date || !url || !Number.isInteger(scannedFiles) || !Number.isInteger(problemFiles) || !userId) {
    return res.status(400).json({ error: 'Invalid input data' });
  }

  try {
    // Find existing entry for the current URL
    const { rows } = await db.query('SELECT * FROM data.tab_data WHERE url = $1 AND user_id = $2 ORDER BY date DESC LIMIT 1', [url, userId]);
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
  const { url, userId } = req.body;
  if (!url || !userId) {
    return res.status(400).json({ error: 'URL and user ID are required' });
  }

  // Broadcast the message to all connected WebSocket clients
  const wss = req.app.get('wss');
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'closeTab', url: url, userId: userId }));
    }
  });

  res.json({ status: 'success', message: `Request to close tab with URL ${url} and user ID ${userId} sent.` });
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

// Function to normalize URLs by removing schemes, optional `www.`, trailing slashes, and spaces
function normalizeUrl(url) {
  if (!url) return url;
  // Remove the scheme (http, https)
  url = url.replace(/^https?:\/\//, '');
  // Optionally remove 'www.'
  url = url.replace(/^www\./, '');
  // Remove trailing slash
  url = url.replace(/\/$/, '');
  // Remove leading and trailing spaces
  url = url.trim();
  return url;
}

// Function to fetch live open tabs data
async function fetchLiveTabs(openTabs) {
  // Normalize the URLs from openTabs
  const urls = Object.values(openTabs).map(normalizeUrl);
  const query = 'SELECT url FROM "data".aiurl WHERE url = ANY($1::text[])';

  try {
    console.log('Fetching live tabs, input URLs:', urls);

    // Query the database
    const result = await db.query(query, [urls]);
    console.log('Database query result:', result.rows);

    // Normalize database URLs for comparison
    const existingUrls = result.rows.map(row => normalizeUrl(row.url));
    console.log('Normalized database URLs:', existingUrls);

    const filteredTabs = {};

    // Filter openTabs to include only those URLs that exist in the database
    for (const [tabId, url] of Object.entries(openTabs)) {
      const normalizedUrl = normalizeUrl(url);
      console.log(`Tab ID: ${tabId}, Original URL: ${url}, Normalized URL:${normalizedUrl}`);
      if (existingUrls.includes(normalizedUrl)) {
        filteredTabs[tabId] = url;
      }
    }

    console.log('Filtered open tabs:', filteredTabs);
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
  fetchLiveTabs,
};
