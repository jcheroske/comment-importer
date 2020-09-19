import axiosStatic from 'axios';
import { cleanEnv, str, url } from 'envalid';
function initialize() {
    const options = getOptions();
    const axios = createAxios(options);
    return {
        getComments: createGetComments(axios),
        getDocket: createGetDocket(axios),
        getDocument: createGetDocument(axios),
    };
}
function createAxios(options) {
    const axiosInstance = axiosStatic.create({
        baseURL: options.baseURL,
        headers: {
            'Content-Type': 'application/vnd.api+json;charset=UTF-8',
            'X-Api-Key': options.apiKey,
        },
    });
    axiosInstance.interceptors.request.use(urlParamInterceptor);
    return axiosInstance;
}
function getOptions() {
    const envOptions = cleanEnv(process.env, {
        REGULATIONS_API_KEY: str({ desc: 'Regulations.gov REST API key' }),
        REGULATIONS_BASE_URL: url({ desc: 'Regulations.gov base URL' }),
    });
    return {
        apiKey: envOptions.REGULATIONS_API_KEY,
        baseURL: envOptions.REGULATIONS_BASE_URL,
    };
}
function urlParamInterceptor(config) {
    const config_ = config;
    const replaceTokens = (urlPart) => Object.entries(config_.urlParams).reduce((memo, [k, v]) => memo.replace(`:${k}`, encodeURIComponent(v)), urlPart);
    return {
        ...config,
        url: replaceTokens(config.url),
        baseUrl: replaceTokens(config.baseURL),
    };
}
//# sourceMappingURL=regulationsGovApi.js.map