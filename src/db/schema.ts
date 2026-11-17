import { relations } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  vector,
} from 'drizzle-orm/pg-core';

export interface SourceCitation {
  page: number;
  chunkIndex: number;
  score: number;
  text: string;
}

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  filename: text('filename').notNull(),
  fileType: varchar('file_type', { length: 10 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  pageCount: integer('page_count').notNull().default(1),
  chunkCount: integer('chunk_count').notNull().default(0),
  status: varchar('status', { length: 20 }).notNull().default('processing'),
  errorMessage: text('error_message'),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

export const chunks = pgTable('chunks', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id')
    .references(() => documents.id, { onDelete: 'cascade' })
    .notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  pageNo: integer('page_no').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 768 }).notNull(),
});

export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id')
    .references(() => documents.id, { onDelete: 'cascade' })
    .notNull(),
  role: varchar('role', { length: 10 }).notNull(),
  content: text('content').notNull(),
  sources: jsonb('sources').$type<SourceCitation[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  owner: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  chunks: many(chunks),
  messages: many(chatMessages),
}));

export const chunksRelations = relations(chunks, ({ one }) => ({
  document: one(documents, {
    fields: [chunks.documentId],
    references: [documents.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  document: one(documents, {
    fields: [chatMessages.documentId],
    references: [documents.id],
  }),
}));
