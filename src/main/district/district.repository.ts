import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma';

@Injectable()
export class DistrictRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findDivisionById(divisionId: string) {
    return this.prisma.division.findUnique({
      where: { id: divisionId, isActive: true },
    });
  }

  async findByNameAndDivision(name: string, divisionId: string) {
    return this.prisma.district.findFirst({
      where: {
        name,
        divisionId,
      },
    });
  }

  async findAll(
    skip: number,
    take: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    fields?: string[],
    searchTerm?: string,
    countryId?: string,
    divisionId?: string,
  ) {
    // Build where clause
    const where: Prisma.DistrictWhereInput = { isActive: true };

    if (divisionId) {
      where.divisionId = divisionId;
    }

    if (countryId) {
      where.division = {
        countryId: countryId,
      };
    }

    if (searchTerm) {
      where.name = { contains: searchTerm, mode: 'insensitive' };
    }

    // Build orderBy object
    const orderBy: Prisma.DistrictOrderByWithRelationInput = sortBy
      ? ({ [sortBy]: sortOrder || 'asc' } as Prisma.DistrictOrderByWithRelationInput)
      : { name: 'asc' as Prisma.SortOrder };

    const select = fields && fields.length > 0
      ? (fields.reduce((acc, field) => ({ ...acc, [field]: true }), {}) as Prisma.DistrictSelect)
      : undefined;

    if (select) {
      return this.prisma.district.findMany({
        where,
        skip,
        take,
        orderBy,
        select,
      });
    }

    return this.prisma.district.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        _count: { select: { thanas: true } },
      },
    });
  }

  async count(searchTerm?: string, countryId?: string, divisionId?: string) {
    const where: Prisma.DistrictWhereInput = { isActive: true };

    if (divisionId) {
      where.divisionId = divisionId;
    }

    if (countryId) {
      where.division = {
        countryId: countryId,
      };
    }

    if (searchTerm) {
      where.name = { contains: searchTerm, mode: 'insensitive' };
    }

    return this.prisma.district.count({ where });
  }

  async create(data: Prisma.DistrictCreateInput) {
    return this.prisma.district.create({
      data,
    });
  }

  async findById(id: string) {
    return this.prisma.district.findUnique({
      where: { id, isActive: true },
    });
  }

  async findByIdWithRelations(id: string) {
    return this.prisma.district.findUnique({
      where: { id, isActive: true },
      include: {
        division: {
          include: {
            country: true,
          },
        },
        thanas: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
        _count: { select: { thanas: true } },
      },
    });
  }

  async update(id: string, data: Prisma.DistrictUpdateInput) {
    return this.prisma.district.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.district.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
