import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma';

@Injectable()
export class CouponRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findByCode(code: string) {
        return this.prisma.coupon.findFirst({
            where: {
                isActive: true,
                code: { equals: code, mode: 'insensitive' },
            },
        });
    }

    async findByCodeAny(code: string) {
        return this.prisma.coupon.findFirst({
            where: {
                code: { equals: code, mode: 'insensitive' },
            },
        });
    }

    async create(data: Prisma.CouponCreateInput) {
        return this.prisma.coupon.create({ data });
    }

    async findAll(
        skip: number,
        take: number,
        sortBy?: string,
        sortOrder?: 'asc' | 'desc',
        fields?: string[],
        searchTerm?: string,
        active?: boolean,
    ) {
        const and: Prisma.CouponWhereInput[] = [];

        if (active !== undefined) {
            and.push({ isActive: active });
        }

        if (searchTerm) {
            and.push({
                OR: [
                    { code: { contains: searchTerm, mode: 'insensitive' } },
                    { name: { contains: searchTerm, mode: 'insensitive' } },
                ],
            });
        }

        const where: Prisma.CouponWhereInput = and.length > 0 ? { AND: and } : {};

        const orderBy: Prisma.CouponOrderByWithRelationInput = sortBy
            ? ({
                [sortBy]: sortOrder || 'asc',
            } as Prisma.CouponOrderByWithRelationInput)
            : { createdAt: 'desc' as Prisma.SortOrder };

        const select = fields && fields.length > 0
            ? (fields.reduce((acc, field) => ({ ...acc, [field]: true }), {}) as Prisma.CouponSelect)
            : undefined;

        const query: any = {
            where,
            skip,
            take,
            orderBy,
        };

        if (select) {
            query.select = select;
        }

        return this.prisma.coupon.findMany(query);
    }

    async count(
        searchTerm?: string,
        active?: boolean,
    ) {
        const and: Prisma.CouponWhereInput[] = [];

        if (active !== undefined) {
            and.push({ isActive: active });
        }

        if (searchTerm) {
            and.push({
                OR: [
                    { code: { contains: searchTerm, mode: 'insensitive' } },
                    { name: { contains: searchTerm, mode: 'insensitive' } },
                ],
            });
        }

        const where: Prisma.CouponWhereInput = and.length > 0 ? { AND: and } : {};

        return this.prisma.coupon.count({ where });
    }

    async findById(id: string) {
        return this.prisma.coupon.findUnique({
            where: { id },
        });
    }

    async update(id: string, data: Prisma.CouponUpdateInput) {
        return this.prisma.coupon.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        return this.prisma.coupon.update({
            where: { id },
            data: { isActive: false },
        });
    }

    async incrementUsageCount(id: string, amount = 1) {
        return this.prisma.coupon.update({
            where: { id },
            data: { usageCount: { increment: amount } },
        });
    }
}
