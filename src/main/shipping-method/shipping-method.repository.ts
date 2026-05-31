import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma';

@Injectable()
export class ShippingMethodRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findByCode(code: string) {
        return this.prisma.shippingMethod.findFirst({
            where: {
                code,
                isActive: true,
            },
        });
    }

    async create(data: Prisma.ShippingMethodCreateInput) {
        return this.prisma.shippingMethod.create({
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
        const where: Prisma.ShippingMethodWhereInput = { isActive: true };

        if (searchTerm) {
            where.OR = [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { code: { contains: searchTerm, mode: 'insensitive' } },
            ];
        }

        const orderBy: Prisma.ShippingMethodOrderByWithRelationInput = sortBy
            ? ({ [sortBy]: sortOrder || 'asc' } as Prisma.ShippingMethodOrderByWithRelationInput)
            : { name: 'asc' as Prisma.SortOrder };

        const select =
            fields && fields.length > 0
                ? (fields.reduce(
                    (acc, field) => ({ ...acc, [field]: true }),
                    {},
                ) as Prisma.ShippingMethodSelect)
                : undefined;

        if (select) {
            return this.prisma.shippingMethod.findMany({
                where,
                skip,
                take,
                orderBy,
                select,
            });
        }

        return this.prisma.shippingMethod.findMany({
            where,
            skip,
            take,
            orderBy,
            include: {
                _count: { select: { orders: true } },
            },
        });
    }

    async count(searchTerm?: string) {
        const where: Prisma.ShippingMethodWhereInput = { isActive: true };

        if (searchTerm) {
            where.OR = [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { code: { contains: searchTerm, mode: 'insensitive' } },
            ];
        }

        return this.prisma.shippingMethod.count({ where });
    }

    async findById(id: string) {
        return this.prisma.shippingMethod.findUnique({
            where: { id, isActive: true },
        });
    }

    async findByIdWithOrderCount(id: string) {
        return this.prisma.shippingMethod.findUnique({
            where: { id, isActive: true },
            include: {
                _count: { select: { orders: true } },
            },
        });
    }

    async update(id: string, data: Prisma.ShippingMethodUpdateInput) {
        return this.prisma.shippingMethod.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        return this.prisma.shippingMethod.update({
            where: { id },
            data: { isActive: false },
        });
    }
}
