// Background script to handle API requests and bypass CORS/referer restrictions
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "makeApiRequest") {
    const { url, body } = request;
    
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    .then(response => response.json())
    .then(data => {
      console.log('Google API response data:', JSON.stringify(data, null, 2));
      if (data.error) {
        // The API returned an error object
        console.error('Google API returned an error:', data.error);
        sendResponse({ success: false, error: 'API Error: ' + (data.error.message || JSON.stringify(data.error)) });
      } else {
        // Assume success if no data.error field
        sendResponse({ success: true, data });
      }
    })
    .catch(error => {
      console.error('Fetch/JSON parse error in background:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Indicates that the response is asynchronous
  }
});
