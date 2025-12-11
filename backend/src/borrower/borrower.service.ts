import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBorrowerDto } from './dto/create-borrower.dto';
import { LeadStatus } from '../common/prisma-enums';

@Injectable()
export class BorrowerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateBorrowerDto) {
    const borrower = await this.prisma.borrower.create({
      data: {
        organizationId,
        primaryContact: dto.primaryContact,
        coBorrowerInfo: dto.coBorrowerInfo,
      },
    });
    if (dto.leadId) {
      await this.prisma.lead.updateMany({
        where: { id: dto.leadId, organizationId },
        data: { status: LeadStatus.CONVERTED },
      });
    }
    return borrower;
  }

  findAll(organizationId: string) {
    return this.prisma.borrower.findMany({ where: { organizationId } });
  }

  async findOne(organizationId: string, id: string) {
    const borrower = await this.prisma.borrower.findFirst({ where: { id, organizationId } });
    if (!borrower) {
      throw new NotFoundException('Borrower not found');
    }
    return borrower;
  }
}
