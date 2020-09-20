import { promises as fs } from 'fs';
import * as joda from '@js-joda/core';
import prisma from '@prisma/client';
import bluebird from 'bluebird';
import jsdom from 'jsdom';
import pick from 'lodash/fp/pick.js';
import Papa from 'papaparse';
import { initialize } from './regulationsGovApi.js';
import envalid from 'envalid';
const { cleanEnv, str } = envalid;
const { LocalDate } = joda.default;
const { PrismaClient } = prisma;
const { Promise } = bluebird;
const { window } = new jsdom.JSDOM();
const prismaClient = new PrismaClient();
const restApi = initialize();
async function main() {
    try {
        await importIntoDatabase();
        await generateCsvFile();
    }
    catch (e) {
        console.log(e);
    }
    finally {
        await prismaClient.$disconnect();
    }
}
main();
async function importIntoDatabase() {
    const options = getOptions();
    await createDocket(options.docketId);
    const document = await createDocument(options.documentId);
    const documentAttributes = document.attributes;
    const commentStartDate = convertDateTimeToLocalDate(documentAttributes.commentStartDate);
    // const commentStartDate = convertDateTimeToLocalDate('2020-09-17')
    const commentEndDate = convertDateTimeToLocalDate(documentAttributes.commentEndDate);
    const today = LocalDate.now();
    const loopEndDate = commentEndDate.isBefore(today) ? commentEndDate : today;
    let commentsImported = 0;
    for (let d = commentStartDate; d.compareTo(loopEndDate) <= 0; d = d.plusDays(1)) {
        let pageNumber = 1, totalPages, commentsProcessed = 0;
        do {
            const [restModels, pagination] = await restApi.getComments({
                documentObjectId: documentAttributes.objectId,
                postedDate: d.toString(),
                page: pageNumber,
            });
            await Promise.each(restModels, async (c) => {
                commentsProcessed += 1;
                if (await createComment(c.id)) {
                    commentsImported += 1;
                }
            });
            console.log(`[${d.toString()}] Page/Total Pages: ${pagination.pageNumber}/${pagination.totalPages}, Processed/Expected/Total: ${commentsProcessed}/${pagination.numberOfElements + (pagination.pageNumber - 1) * pagination.pageSize}/${pagination.totalElements}`);
            pageNumber = pagination.pageNumber + 1;
            totalPages = pagination.totalPages;
        } while (pageNumber <= totalPages);
    }
    console.log(`Total comments imported: ${commentsImported}`);
}
async function generateCsvFile() {
    const comments = await prismaClient.$queryRaw(`
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
    let docket = await prismaClient.docket.findOne({ where: { id: docketId } });
    if (!docket) {
        const restModel = await restApi.getDocket({ docketId });
        docket = await prismaClient.docket.create({
            data: createInputFromRestModel(restModel),
        });
        console.log('Docket created');
    }
    return docket;
}
async function createDocument(documentId) {
    let document = await prismaClient.document.findOne({ where: { id: documentId } });
    if (!document) {
        const restModel = await restApi.getDocument({ documentId });
        document = await prismaClient.document.create({
            data: {
                ...createInputFromRestModel(restModel),
                docket: {
                    connect: {
                        id: restModel.attributes.docketId,
                    },
                },
            },
        });
        console.log('Document created');
    }
    return document;
}
async function createComment(commentId) {
    let comment = await prismaClient.comment.findOne({ where: { id: commentId } });
    if (!comment) {
        const restModel = await restApi.getComment({ commentId });
        comment = await prismaClient.comment.create({
            data: {
                ...createInputFromRestModel(restModel),
                docket: {
                    connect: {
                        id: restModel.attributes.docketId,
                    },
                },
                document: {
                    connect: {
                        id: restModel.attributes.commentOnDocumentId,
                    },
                },
            },
        });
        console.log(`Comment[${comment.id}] created`);
        return true;
    }
    else {
        return false;
    }
}
function createInputFromRestModel(restModel) {
    return pick(['id', 'attributes', 'links', 'relationships'], restModel);
}
function convertDateTimeToLocalDate(datetime) {
    return LocalDate.parse(datetime.split('T')[0]);
}
function getOptions() {
    const envOptions = cleanEnv(process.env, {
        DOCKET_ID: str({ desc: 'Docket id to connect to comments' }),
        DOCUMENT_ID: str({ desc: 'Document id to import and connect to comments' }),
    });
    return {
        docketId: envOptions.DOCKET_ID,
        documentId: envOptions.DOCUMENT_ID,
    };
}
//# sourceMappingURL=index.js.map