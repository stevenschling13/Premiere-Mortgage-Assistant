import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, organizationId },
    });
    if (existing) {
      throw new ConflictException('User already exists');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: { ...dto, passwordHash, organizationId },
    });
  }

  findAll(organizationId: string) {
    return this.prisma.user.findMany({ where: { organizationId } });
  }

  async findOne(organizationId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(organizationId: string, id: string, dto: UpdateUserDto) {
    await this.findOne(organizationId, id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
    });
  }
}
