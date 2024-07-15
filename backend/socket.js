const fs = require('fs');
const path = require('path');

// Define file path and name
const filePath = path.join(__dirname, 'tabData.json');

// Function to determine if a new entry should be created based on the date
function shouldCreateNewEntry(lastDate) {
  const lastEntryDate = new Date(lastDate);
  const now = new Date();
  const oneDayInMillis = 24 * 60 * 60 * 1000;

  // Check if 24 hours have passed since the last entry
  return (now - lastEntryDate) >= oneDayInMillis;
}

// Handler for /monitor endpoint
function handleMonitor(req, res) {
  console.log('Received data:', req.body);

  // Read existing data or initialize as empty array
  let jsonData = [];
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    if (data) {
      jsonData = JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading file:', error);
  }

  // Find existing entry for the current URL
  let foundEntry = jsonData.find(entry => entry.url === req.body.url);

  // Check if new entry should be created or existing updated
  if (!foundEntry || shouldCreateNewEntry(foundEntry.date)) {
    // Create new entry
    jsonData.push({
      date: req.body.date,
      url: req.body.url,
      scannedFiles: req.body.scannedFiles,
      problemFiles: req.body.problemFiles
    });
  } else {
    // Update existing entry with incremented values
    foundEntry.scannedFiles += req.body.scannedFiles;
    foundEntry.problemFiles += req.body.problemFiles;
  }

  // Write updated data back to file
  fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Error writing file:', err);
      res.status(500).json({ error: 'Failed to store data' });
    } else {
      console.log('Data written to file:', req.body);
      res.json({ status: 'success' });
    }
  });
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
function handleGetTabData(req, res) {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      res.status(500).json({ error: 'Failed to read data' });
    } else {
      let jsonData = [];
      try {
        if (data) {
          jsonData = JSON.parse(data);
        }
      } catch (error) {
        console.error('Error parsing JSON:', error);
        res.status(500).json({ error: 'Failed to parse JSON data' });
        return;
      }
      res.json(jsonData);
    }
  });
}

module.exports = {
  handleMonitor,
  handleCloseTab,
  handleGetTabData,
  shouldCreateNewEntry
};
