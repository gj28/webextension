const site = window.location.hostname;

// List of sites to be blocked
const site_list = [
  "openai.com",
  "chatgpt.openai.com",
  "openai.com",
  "chatgpt.com",
  "claude.ai"
];

// Function to block the site
function blockSite() {
  document.querySelector("html").innerHTML = ""; // Clear the page content

  // Create custom styles
  const customCSS = `
    /* Your custom CSS styles here */
    body {
      background-image: url("https://img.freepik.com/free-vector/white-technology-background_23-2148405985.jpg?w=996&t=st=1721370795~exp=1721371395~hmac=09b75d6df0725b9172528d04cf036d6e34928ab5825342ae3db2b2800053200d");
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      height: 100vh; /* Full height of viewport */
      width: 100vw; /* Full width of viewport */
      margin: 0; /* Remove default margin */
      padding: 0; /* Remove default padding */
      overflow: hidden; /* Disable page scroll */
    }
    #This-Site-Block-By-Anti-Ai {
      font-family: "Aboreto";
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #000;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      z-index: 9999;
    }
    #This-Site-Block-By-Anti-Ai .block-message {
      font-size: 30px;
      font-weight: bold;
      margin-bottom: 20px;
    }
    #This-Site-Block-By-Anti-Ai a.button {
      display: inline-block;
      padding: 10px 20px;
      background-color: rgba(145, 158, 164, 1);
      color: #fff;
      text-decoration: none;
      border-radius: 5px;
      cursor: pointer;
      transition: background-color 0.3s ease;
    }
    #This-Site-Block-By-Anti-Ai a.button:hover {
      background-color: rgba(165, 178, 184);
    }
    #toggle-button {
      position: fixed;
      color: #fff;
      top: 10px;
      right: 10px;
      z-index: 10000;
      background-color: #000;
      padding: 8px;
      border-radius: 5px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
      cursor: pointer;
    }
#toggle-button:hover {
    background-color: #555;
}
  `;

  // Add custom styles to the head
  const styleElement = document.createElement("style");
  styleElement.textContent = customCSS;
  document.head.appendChild(styleElement);

  // Create the "Blocked By Anti.Ai" HTML content
  let blockDiv = document.createElement("div");
  blockDiv.id = "This-Site-Block-By-Anti-Ai";
  blockDiv.innerHTML = `
    <div class="block-message">
      <i class="bi bi-exclamation-circle"></i> Blocked By Anti.Ai
    </div>
    <a href="https://www.antiai.ltd/" class="button" target="_blank">Know More</a>
  `;
  document.body.appendChild(blockDiv);

  // Create and append the toggle button
  let toggleButton = document.createElement("button");
  toggleButton.id = "toggle-button";
  toggleButton.textContent = "Unblock Site";
  toggleButton.addEventListener("click", function() {
    sessionStorage.setItem("block_disabled", "true");
    location.reload();
  });
  document.body.appendChild(toggleButton);

  // Disable existing scripts
  document.querySelectorAll('script').forEach(script => script.remove());

  // Prevent new scripts from being added
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeName.toLowerCase() === 'script') {
            node.remove();
          }
        });
      }
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
}

// Function to initialize the toggle button if site is unblocked
function initializeToggleButton() {
  // Create and append the toggle button
  let toggleButton = document.createElement("button");
  toggleButton.id = "toggle-button";
  toggleButton.textContent = "Block Site";
  toggleButton.addEventListener("click", function() {
    sessionStorage.removeItem("block_disabled");
    location.reload();
  });
  document.body.appendChild(toggleButton);
}

// Run the blocking logic or initialize the toggle button based on the session storage
if (site_list.includes(site)) {
  if (sessionStorage.getItem("block_disabled") !== "true") {
    blockSite();
  } else {
    initializeToggleButton();
  }
} else {
  // If the site is not in the block list, just initialize the toggle button if needed
  initializeToggleButton();
}

// Ensure script runs after DOM is fully loaded
document.addEventListener("DOMContentLoaded", function() {
  // Perform any additional checks or actions after DOM is fully loaded if needed
});
