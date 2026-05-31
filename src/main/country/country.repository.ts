import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma';

@Injectable()
export class CountryRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findByNameOrCode(name: string, code?: string) {
    return this.prisma.country.findFirst({
      where: {
        OR: [{ name }, ...(code ? [{ code }] : [])],
      },
    });
  }

  async create(data: Prisma.CountryCreateInput) {
    return this.prisma.country.create({
      data,
    });
  }

  async findAll(
    skip: number,
    take: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    fields?: string[],
    searchTerm?: string,
  ) {
    // Build where clause
    const where: Prisma.CountryWhereInput = { isActive: true };

    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { code: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // Build orderBy object
    const orderBy: Prisma.CountryOrderByWithRelationInput = sortBy
      ? ({ [sortBy]: sortOrder || 'asc' } as Prisma.CountryOrderByWithRelationInput)
      : { name: 'asc' as Prisma.SortOrder };

    const select = fields && fields.length > 0
      ? (fields.reduce((acc, field) => ({ ...acc, [field]: true }), {}) as Prisma.CountrySelect)
      : undefined;

    if (select) {
      return this.prisma.country.findMany({
        where,
        skip,
        take,
        orderBy,
        select,
      });
    }

    const countries = await this.prisma.country.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        _count: { select: { divisions: true } },
      },
    });

    // Add nested counts for districts and thanas
    const countriesWithCounts = await Promise.all(
      countries.map(async (country) => {
        const [districtCount, thanaCount] = await Promise.all([
          this.prisma.district.count({
            where: {
              isActive: true,
              division: {
                countryId: country.id,
                isActive: true,
              },
            },
          }),
          this.prisma.thana.count({
            where: {
              isActive: true,
              district: {
                isActive: true,
                division: {
                  countryId: country.id,
                  isActive: true,
                },
              },
            },
          }),
        ]);

        return {
          ...country,
          _count: {
            ...country._count,
            districts: districtCount,
            thanas: thanaCount,
          },
        };
      }),
    );

    return countriesWithCounts;
  }

  async count(searchTerm?: string) {
    const where: Prisma.CountryWhereInput = { isActive: true };

    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { code: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    return this.prisma.country.count({ where });
  }

  async findById(id: string) {
    return this.prisma.country.findUnique({
      where: { id, isActive: true },
    });
  }

  async findByIdWithDivisions(id: string) {
    const country = await this.prisma.country.findUnique({
      where: { id, isActive: true },
      include: {
        divisions: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
        _count: { select: { divisions: true } },
      },
    });

    if (!country) {
      return null;
    }

    // Add nested counts for districts and thanas
    const [districtCount, thanaCount] = await Promise.all([
      this.prisma.district.count({
        where: {
          isActive: true,
          division: {
            countryId: country.id,
            isActive: true,
          },
        },
      }),
      this.prisma.thana.count({
        where: {
          isActive: true,
          district: {
            isActive: true,
            division: {
              countryId: country.id,
              isActive: true,
            },
          },
        },
      }),
    ]);

    return {
      ...country,
      _count: {
        ...country._count,
        districts: districtCount,
        thanas: thanaCount,
      },
    };
  }

  async update(id: string, data: Prisma.CountryUpdateInput) {
    return this.prisma.country.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.country.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
