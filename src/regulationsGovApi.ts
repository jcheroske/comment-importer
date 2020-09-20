import axiosStatic, { AxiosInstance, AxiosRequestConfig } from 'axios'
import envalid from 'envalid'
import Qs from 'qs'

const { cleanEnv, str, url } = envalid

type Options = {
  apiKey: string
  baseURL: string
}

export interface Pagination {
  hasNextPage: boolean
  hasPreviousPage: boolean
  pageNumber: number
  totalPages: number
  pageSize: number
  numberOfElements: number
  totalElements: number
}

export interface RestModel {
  id: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  links: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  relationships: any
}

export interface API {
  getComments({
    documentObjectId,
    postedDate,
    page,
  }: {
    documentObjectId: string
    postedDate: string
    page: number
  }): Promise<[Array<RestModel>, Pagination]>

  getComment({ commentId }: { commentId: string }): Promise<RestModel>
  getDocket({ docketId }: { docketId: string }): Promise<RestModel>
  getDocument({ documentId }: { documentId: string }): Promise<RestModel>
}

export function initialize(): API {
  const options = getOptions()
  const axios = createAxios(options)

  return {
    async getComments({ documentObjectId, postedDate, page }) {
      const res = await axios.get(`/comments`, {
        params: {
          filter: { commentOnId: documentObjectId, postedDate },
          page: { number: page },
          sort: 'postedDate',
        },
      })

      return [res.data.data, res.data.meta]
    },

    async getComment({ commentId }) {
      const res = await axios.get('/comments/:id', {
        params: {
          id: commentId,
        },
      })
      return res.data.data
    },

    async getDocket({ docketId }) {
      const res = await axios.get('/docket/:id', {
        params: {
          id: docketId,
        },
      })
      return res.data.data
    },

    async getDocument({ documentId }) {
      const res = await axios.get('/documents/:id', {
        params: {
          id: documentId,
        },
      })
      return res.data.data
    },
  }
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

function createAxios(options: Options): AxiosInstance {
  const axiosInstance = axiosStatic.create({
    baseURL: options.baseURL,
    headers: {
      'Content-Type': 'application/vnd.api+json;charset=UTF-8',
      'X-Api-Key': options.apiKey,
    },
    paramsSerializer,
  })

  axiosInstance.interceptors.request.use(urlParamInterceptor)

  return axiosInstance
}

function urlParamInterceptor(config: AxiosRequestConfig): AxiosRequestConfig {
  for (const k in config.params) {
    const v = config.params[k]
    if (config.url?.includes(`:${k}`)) {
      config.url = config.url.replace(`:${k}`, encodeURIComponent(v))
      delete config.params[k]
    }
  }

  return config
}

function paramsSerializer(params: AxiosRequestConfig['params']) {
  return Qs.stringify(params)
}
