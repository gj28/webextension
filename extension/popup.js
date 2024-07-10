// popup.js

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('startMonitoring').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'startMonitoring' });
  });

  document.getElementById('stopMonitoring').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'stopMonitoring' });
  });
});
