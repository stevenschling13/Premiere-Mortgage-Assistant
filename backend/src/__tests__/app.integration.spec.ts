import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

class InMemoryPrisma implements Partial<PrismaService> {
  organizations: any[] = [];
  users: any[] = [];
  leads: any[] = [];
  borrowers: any[] = [];
  loanApplications: any[] = [];
  outboundEvents: any[] = [];
  webhookSubscriptions: any[] = [];

  organization = {
    create: async ({ data }: any) => {
      const org = { ...data, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() };
      this.organizations.push(org);
      return org;
    },
    findMany: async () => this.organizations,
    findUnique: async ({ where: { id } }: any) => this.organizations.find((o) => o.id === id) || null,
    findFirst: async ({ where: { name } }: any) => this.organizations.find((o) => o.name === name) || null,
  };

  user = {
    findFirst: async ({ where }: any) =>
      this.users.find((u) => u.email === where.email && u.organizationId === where.organizationId) || null,
    findMany: async ({ where }: any) => this.users.filter((u) => u.organizationId === where.organizationId),
    create: async ({ data }: any) => {
      const user = { ...data, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() };
      this.users.push(user);
      return user;
    },
    update: async ({ where: { id }, data }: any) => {
      const user = this.users.find((u) => u.id === id);
      Object.assign(user, data);
      return user;
    },
  };

  lead = {
    create: async ({ data }: any) => {
      const lead = { ...data, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() };
      this.leads.push(lead);
      return lead;
    },
    findMany: async ({ where }: any) => this.leads.filter((l) => l.organizationId === where.organizationId),
    findFirst: async ({ where }: any) => this.leads.find((l) => l.id === where.id && l.organizationId === where.organizationId) || null,
    updateMany: async ({ where, data }: any) => {
      const leads = this.leads.filter((l) => l.id === where.id && l.organizationId === where.organizationId);
      leads.forEach((l) => Object.assign(l, data));
      return { count: leads.length };
    },
    update: async ({ where: { id }, data }: any) => {
      const lead = this.leads.find((l) => l.id === id);
      if (lead) Object.assign(lead, data);
      return lead;
    },
  };

  borrower = {
    create: async ({ data }: any) => {
      const borrower = { ...data, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() };
      this.borrowers.push(borrower);
      return borrower;
    },
    findMany: async ({ where }: any) => this.borrowers.filter((b) => b.organizationId === where.organizationId),
    findFirst: async ({ where }: any) => this.borrowers.find((b) => b.id === where.id && b.organizationId === where.organizationId) || null,
  };

  loanApplication = {
    create: async ({ data }: any) => {
      const loan = { ...data, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() };
      this.loanApplications.push(loan);
      return loan;
    },
    findMany: async ({ where }: any) => this.loanApplications.filter((l) => l.organizationId === where.organizationId),
    findFirst: async ({ where }: any) =>
      this.loanApplications.find((l) => l.id === where.id && l.organizationId === where.organizationId) || null,
    update: async ({ where: { id }, data }: any) => {
      const loan = this.loanApplications.find((l) => l.id === id);
      Object.assign(loan, data);
      return loan;
    },
  };

  outboundEvent = {
    create: async ({ data }: any) => {
      const event = { ...data, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() };
      this.outboundEvents.push(event);
      return event;
    },
    findMany: async ({ where }: any) =>
      this.outboundEvents.filter((e) => (where.status ? e.status === where.status : true)),
    update: async ({ where: { id }, data }: any) => {
      const event = this.outboundEvents.find((e) => e.id === id);
      Object.assign(event, data);
      return event;
    },
  };

  webhookSubscription = {
    findMany: async ({ where }: any) =>
      this.webhookSubscriptions.filter(
        (s) => s.organizationId === where.organizationId && s.eventType === where.eventType && s.isActive,
      ),
    create: async ({ data }: any) => {
      const sub = { ...data, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() };
      this.webhookSubscriptions.push(sub);
      return sub;
    },
    findFirst: async ({ where }: any) =>
      this.webhookSubscriptions.find((s) => s.id === where.id && s.organizationId === where.organizationId) || null,
    update: async ({ where: { id }, data }: any) => {
      const sub = this.webhookSubscriptions.find((s) => s.id === id);
      Object.assign(sub, data);
      return sub;
    },
  };
}

describe('App Integration', () => {
  let app: INestApplication;
  let prisma: InMemoryPrisma;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'integration-secret-key';
    process.env.DATABASE_URL = 'postgresql://localhost/in-memory';
    prisma = new InMemoryPrisma();
    const { AppModule } = await import('../app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, authenticates, and enforces tenant isolation', async () => {
    const orgRes = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .send({ name: 'Org One' })
      .expect(201);
    const organizationId = orgRes.body.id;

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'user1@example.com',
        name: 'User One',
        password: 'Password123!',
        role: 'OWNER',
        organizationId,
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'user1@example.com', password: 'Password123!', organizationId })
      .expect(201);
    const token = loginRes.body.accessToken;

    const leadRes = await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: 'web' })
      .expect(201);

    const borrowerRes = await request(app.getHttpServer())
      .post('/api/v1/borrowers')
      .set('Authorization', `Bearer ${token}`)
      .send({ primaryContact: { name: 'Borrower' }, leadId: leadRes.body.id })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/loan-applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ borrowerId: borrowerRes.body.id, loanType: 'FHA', amount: 250000, leadId: leadRes.body.id })
      .expect(201);

    const orgTwo = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .send({ name: 'Org Two' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'user2@example.com',
        name: 'User Two',
        password: 'Password123!',
        role: 'OWNER',
        organizationId: orgTwo.body.id,
      })
      .expect(201);

    const loginTwo = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'user2@example.com', password: 'Password123!', organizationId: orgTwo.body.id })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/leads/${leadRes.body.id}`)
      .set('Authorization', `Bearer ${loginTwo.body.accessToken}`)
      .expect(404);
  });
});
