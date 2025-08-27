import { Hono, type Context } from 'hono';
import { arktypeValidator } from '@hono/arktype-validator';
import { type } from 'arktype';
import { db } from '../db';
import { and, desc, eq, like, sql } from 'drizzle-orm';
import { jobApplicationSchema, jobSchema } from '../db/schema';
import { metadataEnv } from '../env';

const jobsRouter = new Hono();

function isAdminAuthorized(c: Context) {
  const pwd = c.req.header('x-admin-password') || c.req.query('admin_password');
  return !!pwd && pwd === metadataEnv.ADMIN_PASSWORD;
}

// Public: list jobs
const ListQuery = type({
  q: 'string?',
  company: 'string?',
  seniority: 'string?',
  location: 'string?',
  // accept strings from query and parse to numbers below
  page: 'string?',
  pageSize: 'string?',
  salaryMin: 'string?',
  salaryMax: 'string?',
});

jobsRouter.get('/', arktypeValidator('query', ListQuery), async (c) => {
  try {
    const { q, company, seniority, location, salaryMin, salaryMax } = c.req.valid('query') as {
      q?: string; company?: string; seniority?: string; location?: string; salaryMin?: string; salaryMax?: string
    };
    const page = Number.parseInt(c.req.query('page') ?? '1', 10);
    const pageSize = Math.min(50, Number.parseInt(c.req.query('pageSize') ?? '20', 10));

    const whereClauses = [eq(jobSchema.active, true) as any];
    if (q) {
      const likeExpr = `%${q.toLowerCase()}%`;
      whereClauses.push(sql`lower(${jobSchema.title}) like ${likeExpr} or lower(${jobSchema.company}) like ${likeExpr}` as any);
    }
    if (company) whereClauses.push(eq(jobSchema.company, company) as any);
    if (seniority) whereClauses.push(eq(jobSchema.seniority, seniority) as any);
    if (location) whereClauses.push(like(jobSchema.location, `%${location}%`) as any);
    const sMin = salaryMin ? Number.parseInt(salaryMin, 10) : undefined;
    const sMax = salaryMax ? Number.parseInt(salaryMax, 10) : undefined;
    if (Number.isFinite(sMin as number)) whereClauses.push(sql`${jobSchema.salaryMin} >= ${sMin}` as any);
    if (Number.isFinite(sMax as number)) whereClauses.push(sql`${jobSchema.salaryMax} <= ${sMax}` as any);

    const rows = await db.select().from(jobSchema)
      .where(whereClauses.length > 1 ? and(...whereClauses) : whereClauses[0])
      .orderBy(desc(jobSchema.created))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const items = rows.map((r) => ({
      id: r.id!,
      title: r.title,
      company: r.company,
      logo: r.logo || undefined,
      location: r.location,
      employmentType: r.employmentType || undefined,
      seniority: r.seniority || undefined,
      salary: r.salary || undefined,
      salaryMin: r.salaryMin ?? undefined,
      salaryMax: r.salaryMax ?? undefined,
      description: r.description || undefined,
      tags: r.tagsJson ? JSON.parse(r.tagsJson) : [],
      postedAgo: undefined,
      applyUrl: '',
    }));

    return c.json({ total: items.length, items });
  } catch (e) {
    console.error('Failed to list jobs', e);
    return c.text('Failed to list jobs', 500);
  }
});

// Public: apply to job
const ApplySchema = type({ jobId: 'number', email: 'string.email', note: 'string<=2000?' });
jobsRouter.post('/apply', arktypeValidator('json', ApplySchema, (result, c) => {
  if (!result.success) return c.text(`Invalid data: ${result.errors.summary}`, 400);
}), async (c) => {
  try {
    const { jobId, email, note } = c.req.valid('json') as { jobId: number; email: string; note?: string };

    const job = await db.query.jobSchema.findFirst({ where: (t, { eq }) => eq(t.id, jobId) });
    if (!job || !job.active) return c.text('Job not found', 404);

    // prevent duplicate applications per email per job
    const existing = await db.query.jobApplicationSchema.findFirst({
      where: (t, { eq, and }) => and(eq(t.jobId, jobId), eq(t.email, email.toLowerCase()))
    });
    if (existing) return c.text('You have already applied to this job with this email.', 409);

    await db.insert(jobApplicationSchema).values({
      jobId,
      email: email.toLowerCase(),
      note: note?.trim() || null as any,
    });
    return c.json({ status: 'ok' });
  } catch (e) {
    console.error('Failed to apply', e);
    return c.text('Failed to apply', 500);
  }
});

// Admin: create job
const CreateJobSchema = type({
  title: 'string>0',
  company: 'string>0',
  logo: 'string?',
  location: 'string>0',
  employmentType: 'string?',
  seniority: 'string?',
  salary: 'string?',
  salaryMin: 'number.integer>=0?',
  salaryMax: 'number.integer>=0?',
  description: 'string?',
  tags: 'string[]?'
});

// Admin: list all jobs (including inactive)
jobsRouter.get('/admin/list', async (c) => {
  if (!isAdminAuthorized(c)) return c.text('Unauthorized', 401);
  try {
    const rows = await db.select().from(jobSchema).orderBy(desc(jobSchema.created));
    const items = rows.map((r) => ({
      id: r.id!,
      title: r.title,
      company: r.company,
      logo: r.logo || undefined,
      location: r.location,
      employmentType: r.employmentType || undefined,
      seniority: r.seniority || undefined,
      salary: r.salary || undefined,
      description: r.description || undefined,
      tags: r.tagsJson ? JSON.parse(r.tagsJson) : [],
      active: !!r.active,
      created: r.created,
    }));
    return c.json({ items });
  } catch (e) {
    console.error('Failed to list jobs (admin)', e);
    return c.text('Failed to list jobs', 500);
  }
});

jobsRouter.post('/admin/create', arktypeValidator('json', CreateJobSchema, (r, c) => {
  if (!r.success) return c.text(`Invalid job: ${r.errors.summary}`, 400);
}), async (c) => {
  if (!isAdminAuthorized(c)) return c.text('Unauthorized', 401);
  try {
    const body = c.req.valid('json') as any;
    const sanitize = (s?: string, max = 256) => (typeof s === 'string' ? s.trim().slice(0, max) : undefined);
    const cleanTags = Array.isArray(body.tags)
      ? (body.tags as string[]).map(t => sanitize(t, 32)).filter(Boolean).slice(0, 10)
      : undefined;

    const res = await db.insert(jobSchema).values({
      title: sanitize(body.title, 160)!,
      company: sanitize(body.company, 80)!,
      logo: sanitize(body.logo, 512) || null as any,
      location: sanitize(body.location, 120)!,
      employmentType: sanitize(body.employmentType, 40) || null as any,
      seniority: sanitize(body.seniority, 40) || null as any,
      salary: sanitize(body.salary, 120) || null as any,
      salaryMin: typeof body.salaryMin === 'number' ? body.salaryMin : null,
      salaryMax: typeof body.salaryMax === 'number' ? body.salaryMax : null,
      description: sanitize(body.description, 5000) || null as any,
      tagsJson: cleanTags ? JSON.stringify(cleanTags) : null as any,
      active: true,
    }).returning({ id: jobSchema.id });
    const created = res?.[0]?.id;
    if (!created) return c.text('Failed to create job', 500);
    return c.json({ id: created });
  } catch (e) {
    console.error('Failed to create job', e);
    return c.text('Failed to create job', 500);
  }
});

// Admin: update job
const UpdateJobSchema = type({ id: 'number', active: 'boolean?', title: 'string?', company: 'string?', logo: 'string?', location: 'string?', employmentType: 'string?', seniority: 'string?', salary: 'string?', salaryMin: 'number.integer>=0?', salaryMax: 'number.integer>=0?', description: 'string?', tags: 'string[]?' });
jobsRouter.post('/admin/update', arktypeValidator('json', UpdateJobSchema, (r, c) => {
  if (!r.success) return c.text(`Invalid update: ${r.errors.summary}`, 400);
}), async (c) => {
  if (!isAdminAuthorized(c)) return c.text('Unauthorized', 401);
  try {
    const { id, tags, ...rest } = c.req.valid('json') as any;
    const sanitize = (s?: string, max = 256) => (typeof s === 'string' ? s.trim().slice(0, max) : undefined);
    const update: any = {
      ...rest,
    };
    if (typeof update.title !== 'undefined') update.title = sanitize(update.title, 160);
    if (typeof update.company !== 'undefined') update.company = sanitize(update.company, 80);
    if (typeof update.logo !== 'undefined') update.logo = sanitize(update.logo, 512);
    if (typeof update.location !== 'undefined') update.location = sanitize(update.location, 120);
    if (typeof update.employmentType !== 'undefined') update.employmentType = sanitize(update.employmentType, 40);
    if (typeof update.seniority !== 'undefined') update.seniority = sanitize(update.seniority, 40);
    if (typeof update.salary !== 'undefined') update.salary = sanitize(update.salary, 120);
    if (typeof update.description !== 'undefined') update.description = sanitize(update.description, 5000);
    if (typeof tags !== 'undefined') {
      const cleanTags = Array.isArray(tags)
        ? (tags as string[]).map((t) => sanitize(t, 32)).filter(Boolean).slice(0, 10)
        : undefined;
      update.tagsJson = cleanTags ? JSON.stringify(cleanTags) : null;
    }
    await db.update(jobSchema).set(update).where(eq(jobSchema.id, id));
    return c.json({ status: 'ok' });
  } catch (e) {
    console.error('Failed to update job', e);
    return c.text('Failed to update job', 500);
  }
});

// Admin: list applications for a job
jobsRouter.get('/admin/applications/:jobId', async (c) => {
  if (!isAdminAuthorized(c)) return c.text('Unauthorized', 401);
  try {
    const jobId = parseInt(c.req.param('jobId'));
    const apps = await db.select().from(jobApplicationSchema)
      .where(eq(jobApplicationSchema.jobId, jobId))
      .orderBy(desc(jobApplicationSchema.created));
    return c.json({ items: apps });
  } catch (e) {
    console.error('Failed to list applications', e);
    return c.text('Failed to list applications', 500);
  }
});

// Admin: get single job by id
jobsRouter.get('/admin/job/:jobId', async (c) => {
  if (!isAdminAuthorized(c)) return c.text('Unauthorized', 401);
  try {
    const jobId = parseInt(c.req.param('jobId'));
    const job = await db.query.jobSchema.findFirst({ where: (t, { eq }) => eq(t.id, jobId) });
    if (!job) return c.text('Not found', 404);
    return c.json({
      id: job.id,
      title: job.title,
      company: job.company,
      logo: job.logo || undefined,
      location: job.location,
      employmentType: job.employmentType || undefined,
      seniority: job.seniority || undefined,
      salary: job.salary || undefined,
      salaryMin: job.salaryMin ?? undefined,
      salaryMax: job.salaryMax ?? undefined,
      description: job.description || undefined,
      tags: job.tagsJson ? JSON.parse(job.tagsJson) : [],
      active: !!job.active,
      created: job.created,
    });
  } catch (e) {
    console.error('Failed to fetch job (admin)', e);
    return c.text('Failed to fetch job', 500);
  }
});

// Admin: delete an application by id
jobsRouter.post('/admin/applications/delete', async (c) => {
  if (!isAdminAuthorized(c)) return c.text('Unauthorized', 401);
  try {
    const payload = await c.req.json() as { id?: number };
    if (!payload?.id) return c.text('Missing id', 400);
    await db.delete(jobApplicationSchema).where(eq(jobApplicationSchema.id, payload.id));
    return c.json({ status: 'ok' });
  } catch (e) {
    console.error('Failed to delete application', e);
    return c.text('Failed to delete application', 500);
  }
});

// Admin: delete a job (hard delete)
jobsRouter.post('/admin/delete', async (c) => {
  if (!isAdminAuthorized(c)) return c.text('Unauthorized', 401);
  try {
    const payload = await c.req.json() as { id?: number };
    if (!payload?.id) return c.text('Missing id', 400);
    // Delete applications first to satisfy FK constraints, then delete job
    await db.delete(jobApplicationSchema).where(eq(jobApplicationSchema.jobId, payload.id));
    await db.delete(jobSchema).where(eq(jobSchema.id, payload.id));
    return c.json({ status: 'ok' });
  } catch (e) {
    console.error('Failed to delete job', e);
    return c.text('Failed to delete job', 500);
  }
});

export default jobsRouter;


