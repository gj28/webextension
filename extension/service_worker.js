let tabData = {
  scannedFiles: 0,
  problemFiles: 0,
};

// Function to reset counts after 24 hours
function resetCountsAfter24Hours() {
  const storageKey = 'fileScanData';
  const now = new Date();

  // Retrieve last reset date from storage
  chrome.storage.local.get('lastResetDate', (result) => {
    const lastReset = result.lastResetDate;

    // Check if 24 hours have passed since last reset
    if (!lastReset || now - new Date(lastReset) >= 24 * 60 * 60 * 1000) {
      // Reset counts and update last reset date
      tabData.scannedFiles = 0;
      tabData.problemFiles = 0;
      chrome.storage.local.set({ fileScanData: tabData, lastResetDate: now.toISOString() }, () => {
        console.log('Counts reset after 24 hours.');
      });
    }
  });
}

// Function to scan files for phishy or suspicious content
function scanFiles() {
  let totalFilesScanned = 0;
  let problemFiles = 0;

  const suspiciousPatterns = [
    /<script[^>]*>.*<\/script>/gi, // Inline scripts
    /src\s*=\s*['"]https?:\/\/[^'"]*['"]/gi, // External script sources
    /eval\s*\(/gi, // Usage of eval
    /document\.write\s*\(/gi, // Usage of document.write
    /javascript\s*:/gi, // JavaScript URIs
  ];

  function isSuspicious(content) {
    return suspiciousPatterns.some((pattern) => pattern.test(content));
  }

  // Function to fetch and scan the content of a file
  function fetchAndScan(url) {
    return fetch(url)
      .then((response) => response.text())
      .then((content) => {
        totalFilesScanned++;
        if (isSuspicious(content)) {
          problemFiles++;
        }
      })
      .catch((error) => {
        console.error('Error fetching file:', url, error);
      });
  }

  // Scan each resource file for suspicious content
  const resourcePromises = performance
    .getEntriesByType('resource')
    .filter((resource) => resource.initiatorType === 'script' || resource.initiatorType === 'link')
    .map((resource) => fetchAndScan(resource.name));

  // Wait for all resource scans to complete
  return Promise.all(resourcePromises).then(() => {
    return {
      totalFilesScanned,
      problemFiles,
    };
  });
}

// Function to update tabData and send to backend
function updateTabData(fileScanResults, tabUrl) {
  // Update tabData object with new counts
  tabData.scannedFiles += fileScanResults.totalFilesScanned;
  tabData.problemFiles += fileScanResults.problemFiles;

  // Store current counts in storage
  chrome.storage.local.set({ fileScanData: tabData }, () => {
    // Create a new entry with date, counts, and URL
    const dataEntry = {
      date: new Date().toISOString(),
      url: tabUrl,
      scannedFiles: tabData.scannedFiles,
      problemFiles: tabData.problemFiles,
    };

    // Send data to backend server
    fetch('https://webextension-8p1b.onrender.com/monitor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dataEntry),
    })
      .then((response) => response.json())
      .then((data) => console.log('Data sent to backend:', data))
      .catch((error) => console.error('Error sending data:', error));
  });
}

// Function to initialize WebSocket connection
function initializeWebSocket(userId) {
  const socket = new WebSocket(`wss://webextension-8p1b.onrender.com/socket?userId=${userId}`);

  socket.addEventListener('open', (event) => {
    console.log('WebSocket connection established');
    // Send ping messages every 30 seconds to keep the connection alive
    setInterval(() => {
      socket.send(JSON.stringify({ type: 'ping' }));
    }, 30000);
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'closeTab' && message.url) {
      chrome.tabs.query({ url: message.url }, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.remove(tab.id, () => {
            console.log(`Closed tab with URL: ${message.url}`);
          });
        });
      });
    }
  });

  socket.addEventListener('close', (event) => {
    console.log('WebSocket connection closed');
  });

  socket.addEventListener('error', (event) => {
    console.error('WebSocket error:', event);
  });

  // Notify the backend when a tab is closed
  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    socket.send(JSON.stringify({ type: 'closeTab', tabId }));
  });

  return socket;
}

// Function to handle tab updates
function handleTabUpdates(socket) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      resetCountsAfter24Hours();
      scanFiles().then((fileScanResults) => {
        updateTabData(fileScanResults, tab.url);
      });

      // Notify the backend that a tab has been opened
      chrome.storage.local.get('userId', (result) => {
        const userId = result.userId;
        if (userId) {
          socket.send(JSON.stringify({ type: 'openTab', tabId, url: tab.url }));
        }
      });
    }
  });
}

// Initialize the service worker
chrome.runtime.onInstalled.addListener(() => {
  resetCountsAfter24Hours();

  // Check if user is logged in
  chrome.storage.local.get(['loggedIn', 'userId'], (result) => {
    if (result.loggedIn && result.userId) {
      // Initialize WebSocket connection
      const socket = initializeWebSocket(result.userId);

      // Handle tab updates
      handleTabUpdates(socket);
    } else {
      console.log('User is not logged in.');
    }
  });
});

// Listen for login event to initialize WebSocket and handle tabs
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'login' && message.userId) {
    // Initialize WebSocket connection
    const socket = initializeWebSocket(message.userId);

    // Handle tab updates
    handleTabUpdates(socket);
  }
});
