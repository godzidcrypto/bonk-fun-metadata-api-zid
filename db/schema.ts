import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// User Schema
export const userSchema = sqliteTable('users', {
  pubkey: text('pubkey').primaryKey().unique().notNull(),
  name: text('name').notNull(),
  bio: text('bio'),
  kickAccessToken: text('kick_access_token'),
  kickUsername: text('kick_username'),
  created: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s','now'))`),
});

// Comment Schema
export const commentSchema = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }), // Fixed typo in type
  tokenMint: text('token_mint').notNull(),
  userPubkey: text('user_pubkey').references(() => userSchema.pubkey).notNull(),
  message: text('message').notNull(), // Explicit column name
  created: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s','now'))`),
});

// Relations
export const userRelations = relations(userSchema, ({ many }) => ({
  comments: many(commentSchema),
}));

export const commentRelations = relations(commentSchema, ({ one }) => ({
  users: one(userSchema, {
    fields: [commentSchema.userPubkey],
    references: [userSchema.pubkey],
  }),
}));

// Contest Registration Schema
export const contestRegistrationSchema = sqliteTable('contest_registrations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contestId: text('contest_id').notNull(),
  userPubkey: text('user_pubkey').references(() => userSchema.pubkey).notNull(),
  twitter: text('twitter').notNull(),
  profileImageUrl: text('profile_image_url').notNull(),
  walletAddress: text('wallet_address').notNull(),
  approved: integer('approved', { mode: 'boolean' }).notNull().default(0),
  created: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(strftime('%s','now'))`),
});

export const contestRelations = relations(contestRegistrationSchema, ({ one }) => ({
  user: one(userSchema, {
    fields: [contestRegistrationSchema.userPubkey],
    references: [userSchema.pubkey],
  }),
}));

// Jobs Schema
export const jobSchema = sqliteTable('jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  company: text('company').notNull(),
  logo: text('logo'),
  location: text('location').notNull(),
  employmentType: text('employment_type'),
  seniority: text('seniority'),
  salary: text('salary'),
  salaryMin: integer('salary_min'),
  salaryMax: integer('salary_max'),
  description: text('description'),
  tagsJson: text('tags_json'), // JSON-encoded string array of tags
  active: integer('active', { mode: 'boolean' }).notNull().default(1),
  created: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s','now'))`),
});

// Job Applications Schema
export const jobApplicationSchema = sqliteTable('job_applications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('job_id').notNull().references(() => jobSchema.id),
  email: text('email').notNull(),
  note: text('note'),
  created: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s','now'))`),
});

export const jobRelations = relations(jobSchema, ({ many }) => ({
  applications: many(jobApplicationSchema),
}));

export const jobApplicationRelations = relations(jobApplicationSchema, ({ one }) => ({
  job: one(jobSchema, {
    fields: [jobApplicationSchema.jobId],
    references: [jobSchema.id],
  }),
}));