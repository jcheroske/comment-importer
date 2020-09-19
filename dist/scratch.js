const config = {
    url: '/comments/:id',
    baseURL: 'https://api.regulations.gov/v4',
    urlParams: {
        id: 1234,
    },
};
function urlParamInterceptor(config) {
    const replaceTokens = (urlPart) => Object.entries(config.urlParams).reduce((memo, [k, v]) => memo.replace(`:${k}`, encodeURIComponent(v)), urlPart);
    return {
        ...config,
        url: replaceTokens(config.url),
        baseUrl: replaceTokens(config.baseURL),
    };
}
console.log(urlParamInterceptor(config));
export {};
//# sourceMappingURL=scratch.js.map