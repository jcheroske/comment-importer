import axiosStatic from 'axios';
import envalid from 'envalid';
import Qs from 'qs';
const { cleanEnv, str, url } = envalid;
export function initialize() {
    const options = getOptions();
    const axios = createAxios(options);
    return {
        async getComments({ documentObjectId, postedDate, page }) {
            const res = await axios.get(`/comments`, {
                params: {
                    filter: { commentOnId: documentObjectId, postedDate },
                    page: { number: page },
                    sort: 'postedDate',
                },
            });
            return [res.data.data, res.data.meta];
        },
        async getComment({ commentId }) {
            const res = await axios.get('/comments/:id', {
                params: {
                    id: commentId,
                },
            });
            return res.data.data;
        },
        async getDocket({ docketId }) {
            const res = await axios.get('/docket/:id', {
                params: {
                    id: docketId,
                },
            });
            return res.data.data;
        },
        async getDocument({ documentId }) {
            const res = await axios.get('/documents/:id', {
                params: {
                    id: documentId,
                },
            });
            return res.data.data;
        },
    };
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
function createAxios(options) {
    const axiosInstance = axiosStatic.create({
        baseURL: options.baseURL,
        headers: {
            'Content-Type': 'application/vnd.api+json;charset=UTF-8',
            'X-Api-Key': options.apiKey,
        },
        paramsSerializer,
    });
    axiosInstance.interceptors.request.use(urlParamInterceptor);
    return axiosInstance;
}
function urlParamInterceptor(config) {
    for (const k in config.params) {
        const v = config.params[k];
        if (config.url?.includes(`:${k}`)) {
            config.url = config.url.replace(`:${k}`, encodeURIComponent(v));
            delete config.params[k];
        }
    }
    return config;
}
function paramsSerializer(params) {
    return Qs.stringify(params);
}
//# sourceMappingURL=regulationsGovApi.js.map