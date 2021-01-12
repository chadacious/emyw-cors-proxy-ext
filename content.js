
const simpleInjector = (func) => {
    const actualCode = '(' + func + ')();'; // var actualCode = asObject ? '(' + func + ')(' + options ? JSON.stringify(options) : '' + ');' : func.toString();
    const s = document.createElement("script");
    s.textContent = actualCode;
    document.documentElement.appendChild(s); // s.remove();
};

if (window.self.location.host === 'www.disneyplus.com' && window.self !== window.top) {
    simpleInjector(function () {
        const realSelf = this.self;
        this.self = this.top;
        var hfbInterval;
        const hookFrameBuster = () => {
            var scripts = document.getElementsByTagName("script");
            for (var i = 0; i < scripts.length; i++) {
                if (!scripts[i].src && scripts[i].innerHTML.startsWith('\nif (self == top) {')) {
                    // console.log(i, scripts[i].innerHTML)
                    document.head.removeChild(scripts[i]);
                    // setTimeout(() => this.self = realSelf, 10);
                    this.self = realSelf;
                    clearInterval(hfbInterval);
                }
            }
        };
        hfbInterval = setInterval(hookFrameBuster, 1);
    });
}

const getAccessToken = () => { 
    const accessKey = Object.keys(window.localStorage).find(key => key.match(/_access--disney-/));
    if (!accessKey) {
        console.error('Access key not found');
        return;
    }
    const accessContent = JSON.parse(window.localStorage[accessKey] || '{}');
    const { token } = accessContent.context || {};
    if (!token) {
        console.error('Access token not found');
        return;
    }
    return token;
};

window.chrome.runtime.onMessage.addListener(async (request) => {
    console.log('recevied message from extension', request);
    if (request.ProviderRequest && window.location.host.indexOf("localhost") === -1) {
        const { url, reqType, resType, request: remoteRequest, provider } = request.ProviderRequest;
        const { receiverUrl } = request;
        const { headers: rawHeaders } = remoteRequest;
        const accessToken = getAccessToken();
        console.log('perform Provider Fetch here', remoteRequest);
        // console.log('DP accessToken', accessToken);
        // replace header containing {accessToken} with accessToken
        const headers = rawHeaders ? JSON.parse(JSON.stringify(rawHeaders).replace('{accessToken}', accessToken)) : null;
        console.log('headers:', headers);
        console.log('should respond', receiverUrl); // i.e. "http://localhost:3001/"
        const fetchRequest = headers ? { ...remoteRequest, headers } : { ...remoteRequest };

        if (reqType === 'arraybuffer') {
            const byteArray = Uint8Array.from(atob(decodeURIComponent(fetchRequest.body)), c => c.charCodeAt(0))
            var xhr = new XMLHttpRequest();
            xhr.open("POST", url, true);
            xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
            xhr.responseType = "arraybuffer";
            xhr.withCredentials = false;
            xhr.onreadystatechange = () => {
                try {
                    if (xhr.readyState == 4 && xhr.status == 200) {
                       console.log("The disneyplus license is: " + xhr.response);
                       const license = btoa(String.fromCharCode(...new Uint8Array(xhr.response)));
                       window.parent.postMessage(license, receiverUrl);
                    }
                } catch (err) {
                    window.parent.postMessage(err.message, receiverUrl);
                    console.log(err);
                }
            };
            xhr.send(byteArray);
        } else {
            console.log('requesting from ', url, 'with', fetchRequest);
            fetch(url, fetchRequest)
                .then((res) => {
                    if (resType === 'text') {
                        res.text().then((res) => {
                            console.log('Got provider response!!!', res);
                            window.parent.postMessage(res, receiverUrl);
                        });
                    } else if (resType === 'arrayBuffer') {
                        res.arrayBuffer().then((bres) => {
                            console.log('Got provider response!!!', bres);
                            window.parent.postMessage(bres, receiverUrl);
                        });
                    } else {
                        res.json().then((jres) => {
                            console.log('Got provider response!!!', jres);
                            window.parent.postMessage(jres, receiverUrl);
                        });
                    }
                })
                .catch((err) => {
                    console.log('Provider response failed!!!', err);
                    window.parent.postMessage(err.message, receiverUrl);
                });
        }
    }
    return true;
});
