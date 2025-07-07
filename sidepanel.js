chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'captionUpdate') {
    const div = document.getElementById('captionsDisplay');
    div.textContent = message.text || 'No captions currently visible.';
  }
});
