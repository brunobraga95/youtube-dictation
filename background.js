chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  chrome.sidePanel.setOptions({
    path: 'sidepanel.html',
    enabled: true,
  });
});

chrome.runtime.setUninstallURL(
  'https://docs.google.com/forms/d/e/1FAIpQLSc6cuzDvCA-aWyOhrxOwllw3rBNqLHdemEPyYtu7sEZTWXrow/viewform?usp=header'
);
