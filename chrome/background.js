//opens the options page
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "openOptionsPage") {
      chrome.runtime.openOptionsPage();
    }
  });