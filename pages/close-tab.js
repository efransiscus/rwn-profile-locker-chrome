document.getElementById('closeBtn').addEventListener('click', async () => {
  try {
    const tab = await chrome.tabs.getCurrent();
    if (tab && tab.id) {
      await chrome.tabs.remove(tab.id);
    } else {
      window.close();
    }
  } catch (_) {
    window.close();
  }
});
