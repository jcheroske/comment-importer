import axiosStatic, { AxiosInstance, AxiosRequestConfig } from 'axios'
import { cleanEnv, str, url } from 'envalid'
import { JsonArray, JsonObject } from 'type-fest'

type Options = {
  apiKey: string
  baseURL: string
}

type AxiosRequestConfigWithURLParams = AxiosRequestConfig & {
  urlParams: {
    [key: string]: string | number | boolean
  }
}

type Pagination = {
  pageNumber: number
  totalPages: number
  pageSize: number
  numberOfElements: number
  totalElements: number
}

type API = {
  getComments({
    documentObjectId,
    postedDate,
    page,
  }: {
    documentObjectId: string
    postedDate: string
    page: number
  }): [JsonArray, Pagination]

  getDocket({ docketId }: { docketId: string }): JsonObject
  getDocument({ documentId }: { documentId: string }): JsonObject
}

function initialize(): API {
  const options = getOptions()
  const axios = createAxios(options)

  return {
    getComments: createGetComments(axios),
    getDocket: createGetDocket(axios),
    getDocument: createGetDocument(axios),
  }
}

function createAxios(options: Options): AxiosInstance {
  const axiosInstance = axiosStatic.create({
    baseURL: options.baseURL,
    headers: {
      'Content-Type': 'application/vnd.api+json;charset=UTF-8',
      'X-Api-Key': options.apiKey,
    },
  })

  axiosInstance.interceptors.request.use(urlParamInterceptor)

  return axiosInstance
}

function getOptions(): Options {
  const envOptions = cleanEnv(process.env, {
    REGULATIONS_API_KEY: str({ desc: 'Regulations.gov REST API key' }),
    REGULATIONS_BASE_URL: url({ desc: 'Regulations.gov base URL' }),
  })

  return {
    apiKey: envOptions.REGULATIONS_API_KEY,
    baseURL: envOptions.REGULATIONS_BASE_URL,
  }
}

function urlParamInterceptor(config: AxiosRequestConfig) {
  const config_ = config as AxiosRequestConfigWithURLParams
  const replaceTokens = (urlPart: string) =>
    Object.entries(config_.urlParams).reduce((memo, [k, v]) => memo.replace(`:${k}`, encodeURIComponent(v)), urlPart)

  return {
    ...config,
    url: replaceTokens(config.url as string),
    baseUrl: replaceTokens(config.baseURL as string),
  }
}
