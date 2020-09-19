import { promises as fs } from 'fs';
import { LocalDate } from '@js-joda/core';
import { PrismaClient } from '@prisma/client';
import { Promise } from 'bluebird';
import { JSDOM } from 'jsdom';
import { pick } from 'lodash/fp';
import Papa from 'papaparse';
import SwaggerClient from 'swagger-client';
import { loadAndValidateEnv } from './util/loadAndValidateEnv';
const { window } = new JSDOM();
const DOCKET_ID = 'CDC-2020-0087';
const DOCUMENT_ID = 'CDC-2020-0087-0001';
const env = loadAndValidateEnv();
const prisma = new PrismaClient();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let swagger;
(async () => {
    try {
        swagger = await getSwaggerClient();
        await importIntoDatabase();
        await generateCsvFile();
    }
    catch (e) {
        console.log(e);
    }
    finally {
        await prisma.$disconnect();
    }
})();
async function importIntoDatabase() {
    await createDocket(DOCKET_ID);
    const document = await createDocument(DOCUMENT_ID);
    const documentAttributes = document.attributes;
    const commentStartDate = convertDateTimeToLocalDate(documentAttributes.commentStartDate);
    const commentEndDate = convertDateTimeToLocalDate(documentAttributes.commentEndDate);
    const today = LocalDate.now();
    const loopEndDate = commentEndDate.isBefore(today) ? commentEndDate : today;
    for (let d = commentStartDate; d.compareTo(loopEndDate) <= 0; d = d.plusDays(1)) {
        let pageNumber, totalPages, commentsProcessed = 0;
        do {
            const swaggerResult = await swagger.apis.comments.get_comments({
                'filter[commentOnId]': documentAttributes.objectId,
                'filter[postedDate]': d.toString(),
                'page[number]': pageNumber,
                sort: 'postedDate',
            });
            checkSwaggerResult(swaggerResult);
            const { data, meta } = swaggerResult.obj;
            await Promise.each(data, async (c) => {
                // console.log(`[${d.toString()}] Processing Comment ${++commentNumber}/${meta.totalElements}`)
                commentsProcessed += 1;
                await createComment(c.id);
            });
            console.log(`[${d.toString()}] Page/Total Pages: ${meta.pageNumber}/${meta.totalPages}, Processed/Expected/Total: ${commentsProcessed}/${meta.numberOfElements + (meta.pageNumber - 1) * meta.pageSize}/${meta.totalElements}`);
            pageNumber = meta.pageNumber + 1;
            totalPages = meta.totalPages;
        } while (pageNumber <= totalPages);
    }
}
async function generateCsvFile() {
    const comments = await prisma.$queryRaw(`
    select * from "Comment"
    where cast(attributes ->> 'postedDate' as timestamp) >= cast('2020-09-14' as timestamp)
    order by attributes -> 'postedDate' asc
  `);
    const csvComments = comments.map((c) => {
        const attributes = c.attributes;
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
        };
    });
    const csvString = Papa.unparse(csvComments);
    await fs.writeFile('./comments.csv', csvString);
}
function stripHtml(html) {
    const tmp = window.document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}
async function createDocket(docketId) {
    let docket = await prisma.docket.findOne({ where: { id: docketId } });
    if (!docket) {
        const swaggerResult = await swagger.apis.dockets.get_dockets__docketId_({
            docketId,
        });
        checkSwaggerResult(swaggerResult);
        docket = await prisma.docket.create({
            data: newModelFromResult(swaggerResult),
        });
        console.log('Docket created');
    }
    return docket;
}
async function createDocument(documentId) {
    let document = await prisma.document.findOne({ where: { id: documentId } });
    if (!document) {
        const swaggerResult = await swagger.apis.documents.get_documents__documentId_({ documentId });
        checkSwaggerResult(swaggerResult);
        document = await prisma.document.create({
            data: {
                ...newModelFromResult(swaggerResult),
                docket: connectToModel('docketId', swaggerResult),
            },
        });
        console.log('Document created');
    }
    return document;
}
async function createComment(commentId) {
    let comment = await prisma.comment.findOne({ where: { id: commentId } });
    if (!comment) {
        const swaggerResult = await swagger.apis.comments.get_comments__commentId_({
            commentId,
        });
        checkSwaggerResult(swaggerResult);
        comment = await prisma.comment.create({
            data: {
                ...newModelFromResult(swaggerResult),
                docket: connectToModel('docketId', swaggerResult),
                document: connectToModel('commentOnDocumentId', swaggerResult),
                nb,
            },
        });
        console.log(`Comment[${comment.id}] created`);
    }
    return comment;
}
async function getSwaggerClient() {
    const requestInterceptor = (req) => {
        req.headers['x-api-key'] = env.REGULATIONS_API_KEY;
        return req;
    };
    return await new SwaggerClient({
        url: env.REGULATIONS_OPEN_API_SPEC_URL,
        requestInterceptor,
    });
}
function checkSwaggerResult(result) {
    if (!result.ok) {
        throw new Error(`Swagger error: ${result.status} - ${result.statusText}`);
    }
}
function newModelFromResult(result) {
    return pick(['id', 'attributes', 'links', 'relationships'], result.obj.data);
}
function connectToModel(foreignKey, result) {
    return {
        connect: {
            id: result.obj.data.attributes[foreignKey],
        },
    };
}
function convertDateTimeToLocalDate(datetime) {
    return LocalDate.parse(datetime.split('T')[0]);
}
export default {};
//# sourceMappingURL=main.js.map