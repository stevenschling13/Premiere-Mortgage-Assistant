import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './common/health/health.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationModule } from './organization/organization.module';
import { UserModule } from './user/user.module';
import { LeadModule } from './lead/lead.module';
import { BorrowerModule } from './borrower/borrower.module';
import { LoanApplicationModule } from './loan-application/loan-application.module';
import { TaskModule } from './task/task.module';
import { NoteModule } from './note/note.module';
import { ConversationModule } from './conversation/conversation.module';
import { WorkflowModule } from './workflow/workflow.module';
import { OutboundEventModule } from './outbound-event/outbound-event.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    OrganizationModule,
    UserModule,
    LeadModule,
    BorrowerModule,
    LoanApplicationModule,
    TaskModule,
    NoteModule,
    ConversationModule,
    WorkflowModule,
    OutboundEventModule,
    WebhookModule,
  ],
})
export class AppModule {}
