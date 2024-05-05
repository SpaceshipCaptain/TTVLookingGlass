//opens the options page
browser.runtime.onMessage.addListener((message) => {
  if (message.action === "openOptionsPage") {
    browser.tabs.create({ url: browser.runtime.getURL("options/options.html") });
  }
});