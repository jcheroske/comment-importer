import { Primitive } from 'type-fest'
import { AxiosRequestConfig } from 'axios'

type AxiosRequestConfigWithURLParams = AxiosRequestConfig & {
  urlParams: {
    [key: string]: string | number | boolean
  }
}

const config: AxiosRequestConfigWithURLParams = {
  url: '/comments/:id',
  baseURL: 'https://api.regulations.gov/v4',
  urlParams: {
    id: 1234,
  },
}

function urlParamInterceptor(config: AxiosRequestConfigWithURLParams) {
  const replaceTokens = (urlPart: string) =>
    Object.entries(config.urlParams).reduce((memo, [k, v]) => memo.replace(`:${k}`, encodeURIComponent(v)), urlPart)

  return {
    ...config,
    url: replaceTokens(config.url as string),
    baseUrl: replaceTokens(config.baseURL as string),
  }
}

console.log(urlParamInterceptor(config))
