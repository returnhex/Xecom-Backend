import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma';

@Injectable()
export class DivisionRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findCountryById(countryId: string) {
    return this.prisma.country.findUnique({
      where: { id: countryId, isActive: true },
    });
  }

  async findByNameAndCountry(name: string, countryId: string) {
    return this.prisma.division.findFirst({
      where: {
        name,
        countryId,
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
  ) {
    // Build where clause
    const where: Prisma.DivisionWhereInput = { isActive: true };

    if (countryId) {
      where.countryId = countryId;
    }

    if (searchTerm) {
      where.name = { contains: searchTerm, mode: 'insensitive' };
    }

    // Build orderBy object
    const orderBy: Prisma.DivisionOrderByWithRelationInput = sortBy
      ? ({ [sortBy]: sortOrder || 'asc' } as Prisma.DivisionOrderByWithRelationInput)
      : { name: 'asc' as Prisma.SortOrder };

    const select = fields && fields.length > 0
      ? (fields.reduce((acc, field) => ({ ...acc, [field]: true }), {}) as Prisma.DivisionSelect)
      : undefined;

    if (select) {
      return this.prisma.division.findMany({
        where,
        skip,
        take,
        orderBy,
        select,
      });
    }

    const divisions = await this.prisma.division.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        _count: { select: { districts: true } },
      },
    });

    // Add nested counts for thanas
    const divisionsWithCounts = await Promise.all(
      divisions.map(async (division) => {
        const thanaCount = await this.prisma.thana.count({
          where: {
            isActive: true,
            district: {
              isActive: true,
              divisionId: division.id,
            },
          },
        });

        return {
          ...division,
          _count: {
            ...division._count,
            thanas: thanaCount,
          },
        };
      }),
    );

    return divisionsWithCounts;
  }

  async count(searchTerm?: string, countryId?: string) {
    const where: Prisma.DivisionWhereInput = { isActive: true };

    if (countryId) {
      where.countryId = countryId;
    }

    if (searchTerm) {
      where.name = { contains: searchTerm, mode: 'insensitive' };
    }

    return this.prisma.division.count({ where });
  }

  async create(data: Prisma.DivisionCreateInput) {
    return this.prisma.division.create({
      data,
      include: {
        country: true,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.division.findUnique({
      where: { id, isActive: true },
    });
  }

  async findByIdWithRelations(id: string) {
    const division = await this.prisma.division.findUnique({
      where: { id, isActive: true },
      include: {
        country: true,
        districts: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
        _count: { select: { districts: true } },
      },
    });

    if (!division) {
      return null;
    }

    // Add nested count for thanas
    const thanaCount = await this.prisma.thana.count({
      where: {
        isActive: true,
        district: {
          isActive: true,
          divisionId: division.id,
        },
      },
    });

    return {
      ...division,
      _count: {
        ...division._count,
        thanas: thanaCount,
      },
    };
  }

  async update(id: string, data: Prisma.DivisionUpdateInput) {
    return this.prisma.division.update({
      where: { id },
      data,
      include: {
        country: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.division.update({
      where: { id },
      data: { isActive: false },
      include: {
        country: true,
      },
    });
  }
}
