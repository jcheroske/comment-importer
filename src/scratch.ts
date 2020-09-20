import { initialize } from './regulationsGovApi.js'
import { AxiosError } from 'axios'

process.on('unhandledRejection', (error: Error) => {
  // Will print "unhandledRejection err is not defined"
  console.log('unhandledRejection', error)
  if (error.isAxiosError) {
    console.log(error.response?.data?.errors?.[0])
  }
})

const api = initialize()

;(async () => {
  const document = await api.getDocument({ documentId: 'CDC-2020-0087-0001' })
  const [comments, meta] = await api.getComments({
    documentObjectId: document?.attributes?.objectId,
    postedDate: '2020-08-14',
    page: 1,
  })

  console.log(comments)
  console.log(meta)
})()
