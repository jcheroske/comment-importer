import { promises as fs } from 'fs'
import { LocalDate } from '@js-joda/core'
import { PrismaClient } from '@prisma/client'
import type { Docket, Document, Comment } from '@prisma/client'
import { Promise } from 'bluebird'
import { JSDOM } from 'jsdom'
import { pick } from 'lodash/fp'
import Papa from 'papaparse'
import SwaggerClient from 'swagger-client'
import { loadAndValidateEnv } from '@/util/loadAndValidateEnv'

const { window } = new JSDOM()

const DOCKET_ID = 'CDC-2020-0087'
const DOCUMENT_ID = 'CDC-2020-0087-0001'

const env = loadAndValidateEnv()

type SwaggerResult = {
  ok: boolean
  status: string
  statusText: string
  obj: {
    data: {
      [index: string]: unknown
    }
    meta: {
      [index: string]: unknown
    }
  }
}

interface SwaggerModel {
  id: string
}

interface NewModel {
  id: string
  attributes: object
  links: object
  relationships: object
}

interface ModelConnection {
  connect: {
    id: string
  }
}

let prisma: PrismaClient
let swagger: SwaggerClient
;(async () => {
  try {
    swagger = await getSwaggerClient()
    prisma = new PrismaClient()

    await importIntoDatabase()
    await generateCsvFile()
  } catch (e) {
    console.log(e)
  } finally {
    if (prisma != null) {
      await prisma.$disconnect()
    }
  }
})()

async function importIntoDatabase() {
  await createDocket(DOCKET_ID)

  const document = await createDocument(DOCUMENT_ID)

  const commentStartDate = convertDateTimeToLocalDate(document.attributes.commentStartDate)
  const commentEndDate = convertDateTimeToLocalDate(document.attributes.commentEndDate)
  const today = LocalDate.now()
  const loopEndDate = commentEndDate.isBefore(today) ? commentEndDate : today
  for (let d = commentStartDate; d.compareTo(loopEndDate) <= 0; d = d.plusDays(1)) {
    let pageNumber, totalPages
    do {
      const swaggerResult: SwaggerResult = await swagger.apis.comments.get_comments({
        'filter[commentOnId]': document.attributes.objectId,
        'filter[postedDate]': d.toString(),
        'page[number]': pageNumber,
        sort: 'postedDate',
      })

      checkSwaggerResult(swaggerResult)
      const { data, meta } = swaggerResult.obj

      console.log(
        `[${d.toString()}] Page ${meta.pageNumber}/${meta.totalPages}, Count: ${
          meta.numberOfElements + (meta.pageNumber - 1) * meta.pageSize
        }/${meta.totalElements}`
      )

      await Promise.map(data, (c: SwaggerModel) => createComment(c.id))

      pageNumber = meta.pageNumber + 1
      totalPages = meta.totalPages
    } while (pageNumber <= totalPages)
  }
}

async function generateCsvFile() {
  const comments = await prisma.comment.findMany({
    select: {
      id: true,
      attributes: true,
    },
  })

  const csvComments = comments.map((c) => ({
    id: c.id,
    firstName: c.attributes.firstName,
    lastName: c.attributes.lastName,
    title: c.attributes.title,
    comment: stripHtml(c.attributes.comment),
    postedDate: c.attributes.postedDate,
    city: c.attributes.city,
    submitterRepCityState: c.attributes.submitterRepCityState,
    country: c.attributes.country,
  }))

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
      },
    })
    console.log(`Comment[${comment.id}] created`)
  }
  return comment
}

async function getSwaggerClient(): Promise<SwaggerClient> {
  const requestInterceptor = (req: Request): Request => {
    // @ts-ignore
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
