import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string, dto: CreateLeadDto) {
    return this.prisma.lead.create({
      data: { ...dto, organizationId },
    });
  }

  findAll(organizationId: string) {
    return this.prisma.lead.findMany({ where: { organizationId } });
  }

  async findOne(organizationId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id, organizationId } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  async update(organizationId: string, id: string, dto: UpdateLeadDto) {
    await this.findOne(organizationId, id);
    return this.prisma.lead.update({ where: { id }, data: dto });
  }
}
