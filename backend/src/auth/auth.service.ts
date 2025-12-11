import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async validateUser(loginDto: LoginDto): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: loginDto.email,
        organizationId: loginDto.organizationId,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
      name: user.name,
    };
  }

  async login(loginDto: LoginDto) {
    const payload = await this.validateUser(loginDto);
    const token = await this.jwt.signAsync(payload);
    return { accessToken: token, user: payload };
  }

  async register(data: RegisterDto) {
    const organization = await this.prisma.organization.findUnique({ where: { id: data.organizationId } });
    if (!organization) {
      throw new ConflictException('Organization not found');
    }
    const existing = await this.prisma.user.findFirst({
      where: {
        email: data.email,
        organizationId: data.organizationId,
      },
    });
    if (existing) {
      throw new ConflictException('User already exists');
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        organizationId: data.organizationId,
        role: data.role,
        passwordHash,
      },
    });
    const payload: AuthenticatedUser = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
      name: user.name,
    };
    const token = await this.jwt.signAsync(payload);
    return { accessToken: token, user: payload };
  }
}
