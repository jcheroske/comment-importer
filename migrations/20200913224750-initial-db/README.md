# Migration `20200913224750-initial-db`

This migration has been generated by Jay Cheroske at 9/13/2020, 3:47:50 PM.
You can check out the [state of the schema](./schema.prisma) after the migration.

## Database Steps

```sql
CREATE TABLE "public"."Docket" (
"id" text   NOT NULL ,
"attributes" jsonb   NOT NULL ,
"links" jsonb   NOT NULL ,
PRIMARY KEY ("id")
)

CREATE TABLE "public"."Document" (
"id" text   NOT NULL ,
"docketId" text   NOT NULL ,
"attributes" jsonb   NOT NULL ,
"links" jsonb   NOT NULL ,
"relationships" jsonb   NOT NULL ,
PRIMARY KEY ("id")
)

CREATE TABLE "public"."Comment" (
"id" text   NOT NULL ,
"docketId" text   NOT NULL ,
"documentId" text   NOT NULL ,
"attributes" jsonb   NOT NULL ,
"links" jsonb   NOT NULL ,
"relationships" jsonb   NOT NULL ,
PRIMARY KEY ("id")
)

ALTER TABLE "public"."Document" ADD FOREIGN KEY ("docketId")REFERENCES "public"."Docket"("id") ON DELETE CASCADE ON UPDATE CASCADE

ALTER TABLE "public"."Comment" ADD FOREIGN KEY ("docketId")REFERENCES "public"."Docket"("id") ON DELETE CASCADE ON UPDATE CASCADE

ALTER TABLE "public"."Comment" ADD FOREIGN KEY ("documentId")REFERENCES "public"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE
```

## Changes

```diff
diff --git schema.prisma schema.prisma
migration ..20200913224750-initial-db
--- datamodel.dml
+++ datamodel.dml
@@ -1,0 +1,40 @@
+datasource db {
+  provider = "postgresql"
+  url = "***"
+}
+
+generator client {
+  provider        = "prisma-client-js"
+  binaryTargets   = ["native"]
+  previewFeatures = ["atomicNumberOperations", "connectOrCreate", "insensitiveFilters", "transactionApi"]
+}
+
+model Docket {
+  id String @id
+  comments Comment[]
+  documents Document[]
+  attributes Json
+  links Json
+}
+
+model Document {
+  id String @id
+  docketId String
+  docket Docket @relation(fields: [docketId], references: [id])
+  comments Comment[]
+  attributes Json
+  links Json
+  relationships Json
+}
+
+model Comment {
+  id String @id
+  docketId String
+  docket Docket @relation(fields: [docketId], references: [id])
+  documentId String
+  document Document @relation(fields: [documentId], references: [id])
+  attributes Json
+  links Json
+  relationships Json
+}
+
```


