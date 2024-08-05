const db = require('./db');
const WebSocket = require('ws');

let wss = new WebSocket.Server({ noServer: true });

function shouldCreateNewEntry(lastDate) {
  const lastEntryDate = new Date(lastDate);
  const now = new Date();
  const oneDayInMillis = 24 * 60 * 60 * 1000;

  return (now - lastEntryDate) >= oneDayInMillis;
}

async function handleMonitor(req, res) {
  console.log('Received data:', req.body);

  const { date, url, scannedFiles, problemFiles, userId } = req.body;

  if (!date || !url || !Number.isInteger(scannedFiles) || !Number.isInteger(problemFiles) || !userId) {
    return res.status(400).json({ error: 'Invalid input data' });
  }

  try {
    const { rows } = await db.query('SELECT * FROM data.tab_data WHERE url = $1 AND user_id = $2 ORDER BY date DESC LIMIT 1', [url, userId]);
    let foundEntry = rows[0];

    if (!foundEntry || shouldCreateNewEntry(foundEntry.date)) {
      await db.query(
        'INSERT INTO data.tab_data (date, url, scanned_files, problem_files, user_id) VALUES ($1, $2, $3, $4, $5)',
        [date, url, scannedFiles, problemFiles, userId]
      );
    } else {
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

function handleCloseTab(req, res) {
  const { url, userId } = req.body;
  if (!url || !userId) {
    return res.status(400).json({ error: 'URL and user ID are required' });
  }

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.userId === userId) {
      client.send(JSON.stringify({ type: 'closeTab', url: url }));
    }
  });

  res.json({ status: 'success', message: `Request to close tab with URL ${url} and user ID ${userId} sent.` });
}

async function handleGetTabData(req, res) {
  try {
    const { rows } = await db.query('SELECT * FROM data.tab_data');
    res.json(rows);
  } catch (error) {
    console.error('Error reading from database:', error);
    res.status(500).json({ error: 'Failed to read data' });
  }
}

function normalizeUrl(url) {
  if (!url) return url;
  url = url.replace(/^https?:\/\//, '');
  url = url.replace(/^www\./, '');
  url = url.replace(/\/$/, '');
  url = url.trim();
  return url;
}

async function fetchLiveTabs(openTabs, userId) {
  const urls = Object.values(openTabs).map(normalizeUrl);
  const query = 'SELECT url FROM "data".aiurl WHERE url = ANY($1::text[]) AND user_id = $2';

  try {
    console.log('Fetching live tabs, input URLs:', urls);
    const result = await db.query(query, [urls, userId]);
    console.log('Database query result:', result.rows);

    const existingUrls = result.rows.map(row => normalizeUrl(row.url));
    console.log('Normalized database URLs:', existingUrls);

    const filteredTabs = {};

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

wss.on('connection', (ws, req) => {
  const userId = new URL(req.url, `http://${req.headers.host}`).searchParams.get('userId');
  ws.userId = userId;

  console.log(`WebSocket connection established for user ${userId}`);

  ws.on('message', (message) => {
    console.log('Received message:', message);
  });

  ws.on('close', () => {
    console.log(`WebSocket connection closed for user ${userId}`);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

module.exports = {
  handleMonitor,
  handleCloseTab,
  handleGetTabData,
  shouldCreateNewEntry,
  fetchLiveTabs,
  wss,
};
