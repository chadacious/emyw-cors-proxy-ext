// forward requests coming into the extension to the content script
window.chrome.runtime.onMessageExternal.addListener((request, sender) => {
    if (request.ProviderRequest) {
        const { tab } = sender;
        const { ProviderRequest } = request;
        console.log(tab, 'Got ProviderRequest, passing along', sender);
        console.log(ProviderRequest);
        window.chrome.tabs.sendMessage(tab.id, { ProviderRequest, receiverUrl: sender.url });
    }
});

const processHeadersReceived = (details) => {
    try {
        // console.log('host', host);
        // console.warn('processHeadersReceived', details.responseHeaders);
        for (let j = details.responseHeaders.length - 1; j >= 0; j -= 1) {
            // console.log(details.responseHeaders[j]);
            // Only do these next operations if the initiator is in an iframe.
            // It might actually be a better experience to do this all the time, but since
            // using the tagging tool is expected to be much less frequent, I decided to just
            // make these cookie changes only when necessary. If this gets to be a problem, 
            // then just remove the parentFrameId check.
            if (details.parentFrameId > -1) {
                if (['x-frame-options', 'content-security-policy'].includes(details.responseHeaders[j].name.toLowerCase())) {
                    details.responseHeaders.splice(j, 1);
                }
                if (details.responseHeaders[j].name.toLowerCase() === 'set-cookie') {
                    // Checking for specific cookies works! But then I figured, why not just set the all.
                    details.responseHeaders[j].value = `${details.responseHeaders[j].value}; SameSite=None; Secure`;
                }
            }
            if (details.responseHeaders[j].name.toLowerCase() === 'access-control-allow-origin') {
                if (details.initiator === "https://www.disneyplus.com" && details.responseHeaders[j].value === "null") {
                    // console.log('******* access-control-allow-origin value:', details.responseHeaders[j].value);
                    details.responseHeaders[j].value = details.initiator;
                }
            }
        }
        // console.log('modified Headers', details.responseHeaders);
        return { responseHeaders: details.responseHeaders };
    } catch (error) {
        console.error('Error processing headers', error);
        console.log('details.responseHeaders:', details.responseHeaders);
        return { responseHeaders: details.responseHeaders };
    }
};

// Allow sites to be loaded into iframes
window.chrome.webRequest.onHeadersReceived.addListener(processHeadersReceived, { urls: ["<all_urls>"] }, ["blocking", "responseHeaders", "extraHeaders"]);
