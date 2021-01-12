
const fetchDeviceToken = async () => {
    let url = "https://global.edge.bamgrid.com/devices";
    let headers = {
        authorization: "Bearer " + apiKey,
        "content-type": "application/json; charset=UTF-8"
    };

    let body = {
        deviceFamily: "android", // "browser",
        applicationRuntime: "android", // "chrome",
        deviceProfile: "tv", // "macosx",
        attributes: {}
    };

    let response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body)
    });

    let responseObj = await response.json();

    return responseObj.assertion;
};

const fetchToken = async (token, tokenType) => {
    let url = "https://global.edge.bamgrid.com/token";
    let headers = {
        authorization: "Bearer " + apiKey,
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
    };

    let body = urlEncode({
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        latitude: 0,
        longitude: 0,
        platform: "browser",
        subject_token: token,
        subject_token_type: tokenType
    });

    let response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: body
    });

    let responseObj = await response.json();

    return responseObj;
};

const fetchPreAuthToken = async (deviceToken) => {
    let tokenObj = await fetchToken(deviceToken, "urn:bamtech:params:oauth:token-type:device");

    return tokenObj.access_token;
};

const fetchIdToken = async (preAuthToken, userName, password) => {
    let url = "https://global.edge.bamgrid.com/idp/login";
    let headers = {
        authorization: "Bearer " + preAuthToken,
        "content-type": "application/json; charset=UTF-8"
    };

    let body = {
        email: userName,
        password: password
    };

    let response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body)
    });

    let responseObj = await response.json();

    return responseObj.id_token;
};

const fetchGrantToken = async (preAuthToken, idToken) => {
    let url = "https://global.edge.bamgrid.com/accounts/grant";
    let headers = {
        authorization: "Bearer " + preAuthToken,
        "content-type": "application/json; charset=UTF-8"
    };

    let body = {
        id_token: idToken
    };

    let response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body)
    });

    let responseObj = await response.json();

    return responseObj.assertion;
};

const fetchAccessRefreshTokens = async (grantToken) => {
    return await fetchToken(grantToken, "urn:bamtech:params:oauth:token-type:account");
};

const refreshTokens = async (refreshToken) => {
    let url = "https://global.edge.bamgrid.com/token";
    let headers = {
        authorization: "Bearer " + apiKey,
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
    };

    let body = urlEncode({
        grant_type: "refresh_token",
        latitude: 0,
        longitude: 0,
        platform: "browser",
        refresh_token: refreshToken
    });

    let response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: body
    });

    let tokens = await response.json();
    localStorage.setItem("dplus-tokens", JSON.stringify(tokens));
    return tokens;
};

const getAccessToken = async (forceRefresh) => {
    let tokens = localStorage.getItem("dplus-tokens");
    if (tokens && JSON.parse(tokens).access_token) {
        const { access_token: accessToken } = JSON.parse(tokens);
        const parsedToken = parseJwt(accessToken);
        if (parsedToken.exp > (new Date().getTime()) / 1000 && !forceRefresh) {
            console.log('Tokens seem good. Expires: ', parsedToken.exp, ' now ', (new Date().getTime() + 1) / 1000)
            return JSON.parse(tokens).access_token;
        } else if (JSON.parse(tokens).refresh_token) {
            console.log('Tokens are expired. Refreshing...');
            const jsonTokens = await refreshTokens(JSON.parse(tokens).refresh_token);
            if (jsonTokens) {
                return jsonTokens.access_token;
            } else {
                return null;
            }
        }
    }
    return null;
}

const parseJwt = (token) => {
    try {
        // Get Token Header
        const base64HeaderUrl = token.split('.')[0];
        const base64Header = base64HeaderUrl.replace('-', '+').replace('_', '/');
        const headerData = JSON.parse(window.atob(base64Header));

        // Get Token payload and date's
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace('-', '+').replace('_', '/');
        const dataJWT = JSON.parse(window.atob(base64));
        dataJWT.header = headerData;

        // TODO: add expiration at check ...
        console.log('The parsed token is: ', dataJWT);

        return dataJWT;
    } catch (err) {
        return false;
    }
}

window.chrome.runtime.onMessage.addListener(async (request, sender, response = () => { }) => {
    console.log('recevied message from extension', request);
    if (request.ProviderRequest && window.location.host.indexOf("localhost") === -1) {
        console.log('perform Provider Fetch here', window.location);
        console.log(request);
        const accessToken = await getAccessToken();
        console.log('DP accessToken', accessToken);
        // replace header containing {accessToken} with accessToken
        const { url, resType, receiverUrl, ...rest } = request.ProviderRequest;
        console.log('should respond', receiverUrl); // i.e. "http://localhost:3001/"
        fetch(url, { ...rest })
            .then((res) => {
                if (resType === 'text') {
                    res.text().then((res) => {
                        response(res);
                        console.log('Got provider response!!!', res);
                        window.parent.postMessage(res, receiverUrl);
                    });
                } else if (resType === 'arrayBuffer') {
                    res.arrayBuffer().then((bres) => {
                        response(bres);
                        console.log('Got provider response!!!', bres);
                        window.parent.postMessage(bres, receiverUrl);
                    });
                } else {
                    res.json().then((jres) => {
                        response(jres);
                        console.log('Got provider response!!!', jres);
                        window.parent.postMessage(jres, receiverUrl);
                    });
                }
            })
            .catch((err) => {
                console.log('Provider response failed!!!', err);
                console.log(err);
                response(err.message);
                window.parent.postMessage(err.message, receiverUrl);
            });
    }
});