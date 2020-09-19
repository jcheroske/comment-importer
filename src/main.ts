import { promises as fs } from 'fs'
import { LocalDate } from '@js-joda/core'
import { PrismaClient } from '@prisma/client'
import type { Docket, Document, Comment } from '@prisma/client'
import axiosStatic, { AxiosError, AxiosInstance } from 'axios'
import { Promise } from 'bluebird'
import { JSDOM } from 'jsdom'
import { pick } from 'lodash/fp'
import Papa from 'papaparse'
import SwaggerClient from 'swagger-client'
import { loadAndValidateEnv } from './util/loadAndValidateEnv'
import { CommentAttributes, DocumentAttributes } from './model-types-d'

const { window } = new JSDOM()

const DOCKET_ID = 'CDC-2020-0087'
const DOCUMENT_ID = 'CDC-2020-0087-0001'

const env = loadAndValidateEnv()

type SwaggerResult = {
  ok: boolean
  status: string
  statusText: string
  obj: {
    data: Array<SwaggerModel>
    meta: {
      [index: string]: number
    }
  }
}

interface SwaggerModel {
  id: string
}

interface NewModel {
  id: string
  attributes: {
    [key: string]: string
  }
  links: {
    [key: string]: string
  }
  relationships: {
    [key: string]: string
  }
}

interface ModelConnection {
  connect: {
    id: string
  }
}

const prisma: PrismaClient = new PrismaClient()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let swagger: any
;(async () => {
  try {
    swagger = await getSwaggerClient()

    await importIntoDatabase()
    await generateCsvFile()
  } catch (e) {
    console.log(e)
  } finally {
    await prisma.$disconnect()
  }
})()

async function importIntoDatabase() {
  await createDocket(DOCKET_ID)

  const document = await createDocument(DOCUMENT_ID)
  const documentAttributes = document.attributes as DocumentAttributes

  const commentStartDate = convertDateTimeToLocalDate(documentAttributes.commentStartDate)
  const commentEndDate = convertDateTimeToLocalDate(documentAttributes.commentEndDate)
  const today = LocalDate.now()
  const loopEndDate = commentEndDate.isBefore(today) ? commentEndDate : today
  for (let d = commentStartDate; d.compareTo(loopEndDate) <= 0; d = d.plusDays(1)) {
    let pageNumber,
      totalPages,
      commentsProcessed = 0
    do {
      const swaggerResult: SwaggerResult = await swagger.apis.comments.get_comments({
        'filter[commentOnId]': documentAttributes.objectId,
        'filter[postedDate]': d.toString(),
        'page[number]': pageNumber,
        sort: 'postedDate',
      })

      checkSwaggerResult(swaggerResult)
      const { data, meta } = swaggerResult.obj

      await Promise.each(data, async (c) => {
        // console.log(`[${d.toString()}] Processing Comment ${++commentNumber}/${meta.totalElements}`)
        commentsProcessed += 1
        await createComment(c.id)
      })

      console.log(
        `[${d.toString()}] Page/Total Pages: ${meta.pageNumber}/${
          meta.totalPages
        }, Processed/Expected/Total: ${commentsProcessed}/${
          meta.numberOfElements + (meta.pageNumber - 1) * meta.pageSize
        }/${meta.totalElements}`
      )

      pageNumber = meta.pageNumber + 1
      totalPages = meta.totalPages
    } while (pageNumber <= totalPages)
  }
}

async function generateCsvFile() {
  const comments = await prisma.$queryRaw<Comment[]>(`
    select * from "Comment"
    where cast(attributes ->> 'postedDate' as timestamp) >= cast('2020-09-14' as timestamp)
    order by attributes -> 'postedDate' asc
  `)

  const csvComments = comments.map((c) => {
    const attributes = c.attributes as CommentAttributes
    return {
      id: c.id,
      postedDate: attributes.postedDate,
      firstName: attributes.firstName,
      lastName: attributes.lastName,
      title: attributes.title,
      comment: stripHtml(attributes.comment),
      city: attributes.city,
      submitterRepCityState: attributes.submitterRepCityState,
      country: attributes.country,
    }
  })

  const csvString = Papa.unparse(csvComments)

  await fs.writeFile('./comments.csv', csvString)
}

function stripHtml(html: string): string {
  const tmp = window.document.createElement('DIV')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

async function createDocket(docketId: string): Promise<Docket> {
  let docket = await prisma.docket.findOne({ where: { id: docketId } })
  if (!docket) {
    const swaggerResult = await swagger.apis.dockets.get_dockets__docketId_({
      docketId,
    })

    checkSwaggerResult(swaggerResult)
    docket = await prisma.docket.create({
      data: newModelFromResult(swaggerResult),
    })
    console.log('Docket created')
  }
  return docket
}

async function createDocument(documentId: string): Promise<Document> {
  let document = await prisma.document.findOne({ where: { id: documentId } })
  if (!document) {
    const swaggerResult = await swagger.apis.documents.get_documents__documentId_({ documentId })

    checkSwaggerResult(swaggerResult)
    document = await prisma.document.create({
      data: {
        ...newModelFromResult(swaggerResult),
        docket: connectToModel('docketId', swaggerResult),
      },
    })
    console.log('Document created')
  }
  return document
}

async function createComment(commentId: string): Promise<Comment> {
  let comment = await prisma.comment.findOne({ where: { id: commentId } })
  if (!comment) {
    const swaggerResult = await swagger.apis.comments.get_comments__commentId_({
      commentId,
    })

    checkSwaggerResult(swaggerResult)
    comment = await prisma.comment.create({
      data: {
        ...newModelFromResult(swaggerResult),
        docket: connectToModel('docketId', swaggerResult),
        document: connectToModel('commentOnDocumentId', swaggerResult),
        nb,
      },
    })
    console.log(`Comment[${comment.id}] created`)
  }
  return comment
}

async function getSwaggerClient() {
  const requestInterceptor = (req: Request): Request => {
    req.headers['x-api-key'] = env.REGULATIONS_API_KEY
    return req
  }

  return await new SwaggerClient({
    url: env.REGULATIONS_OPEN_API_SPEC_URL,
    requestInterceptor,
  })
}

function checkSwaggerResult(result: SwaggerResult): void {
  if (!result.ok) {
    throw new Error(`Swagger error: ${result.status} - ${result.statusText}`)
  }
}

function newModelFromResult(result: SwaggerResult): NewModel {
  return pick(['id', 'attributes', 'links', 'relationships'], result.obj.data)
}

function connectToModel(foreignKey: string, result: SwaggerResult): ModelConnection {
  return {
    connect: {
      id: result.obj.data.attributes[foreignKey],
    },
  }
}

function convertDateTimeToLocalDate(datetime: string): LocalDate {
  return LocalDate.parse(datetime.split('T')[0])
}

export default {}
