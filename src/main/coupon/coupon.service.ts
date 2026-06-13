import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CouponRepository } from './coupon.repository';
import {
    CreateCouponDto,
    SetCouponActiveDto,
    UpdateCouponDto,
    ValidateCouponDto,
} from './coupon.dto';
import calculatePagination from 'src/utils/calculatePagination';
import { CouponType, OrderStatus } from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CouponService {
    constructor(
        private readonly couponRepository: CouponRepository,
        private readonly prisma: PrismaService,
    ) { }

    private normalizeCode(code: string) {
        return code.trim().toUpperCase();
    }

    private parseOptionalDate(label: string, value?: string) {
        if (!value) {
            return undefined;
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            throw new HttpException(
                `${label} must be a valid ISO date string`,
                HttpStatus.BAD_REQUEST,
            );
        }
        return date;
    }

    private async assertApplicableProductsExist(productIds?: string[]) {
        const uniqueProductIds = Array.from(new Set(productIds ?? [])).filter(Boolean);
        if (uniqueProductIds.length > 0) {
            const found = await this.prisma.product.findMany({
                where: { id: { in: uniqueProductIds } },
                select: { id: true },
            });
            const foundSet = new Set(found.map((p) => p.id));
            const missing = uniqueProductIds.filter((id) => !foundSet.has(id));

            if (missing.length > 0) {
                throw new HttpException(
                    `Invalid applicableProductIds. Not found: ${missing.join(', ')}`,
                    HttpStatus.BAD_REQUEST,
                );
            }
        }
    }

    // ------------------------------- Add Coupon -------------------------------
    public async addCoupon(dto: CreateCouponDto) {
        const code = this.normalizeCode(dto.code);

        // Prevent duplicates (including soft-deleted ones)
        const existing = await this.couponRepository.findByCodeAny(code);

        if (existing) {
            throw new HttpException(
                'Coupon with this code already exists',
                HttpStatus.CONFLICT,
            );
        }

        await this.assertApplicableProductsExist(dto.applicableProductIds);

        const startsAt = this.parseOptionalDate('startsAt', dto.startsAt);
        const expiresAt = this.parseOptionalDate('expiresAt', dto.expiresAt);

        if (startsAt && expiresAt && startsAt > expiresAt) {
            throw new HttpException(
                'startsAt cannot be after expiresAt',
                HttpStatus.BAD_REQUEST,
            );
        }

        const coupon = await this.couponRepository.create({
            code,
            name: dto.name,
            description: dto.description,
            type: dto.type ?? CouponType.PERCENTAGE,
            value: dto.value,
            minOrderAmount: dto.minOrderAmount,
            maxDiscountAmount: dto.maxDiscountAmount,
            usageLimit: dto.usageLimit,
            userUsageLimit: dto.userUsageLimit,
            isActive: dto.isActive ?? true,
            startsAt,
            expiresAt,
            applicableProductIds: dto.applicableProductIds ?? [],
        });

        return coupon;
    }

    // ------------------------------- Get All Coupons -------------------------------
    public async getAllCoupons(
        pageNumber: number,
        pageSize: number,
        sortBy: string | undefined,
        sortOrder: 'asc' | 'desc' | undefined,
        fields: string | undefined,
        searchTerm: string | undefined,
        active: string | undefined,
    ) {
        const { skip, take } = calculatePagination({
            page: pageNumber,
            take: pageSize,
        });

        const selectedFields = fields
            ? fields.split(',').map((field) => field.trim()).filter(Boolean)
            : undefined;

        let activeFilter: boolean | undefined = undefined;
        if (active !== undefined && active !== '') {
            const normalized = active.toLowerCase();
            if (normalized !== 'true' && normalized !== 'false') {
                throw new HttpException(
                    'Invalid active query param. Use true or false.',
                    HttpStatus.BAD_REQUEST,
                );
            }
            activeFilter = normalized === 'true';
        }

        const [coupons, total] = await Promise.all([
            this.couponRepository.findAll(
                skip,
                take,
                sortBy,
                sortOrder,
                selectedFields,
                searchTerm,
                activeFilter,
            ),
            this.couponRepository.count(searchTerm, activeFilter),
        ]);

        return {
            data: coupons,
            meta: {
                pageNumber,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
                totalCount: total,
            },
        };
    }

    // ------------------------------- Get Single Coupon -------------------------------
    public async getSingleCoupon(id: string) {
        const coupon = await this.couponRepository.findById(id);

        if (!coupon || !coupon.isActive) {
            throw new HttpException('Coupon not found', HttpStatus.NOT_FOUND);
        }

        return coupon;
    }

    public async getCouponByCode(code: string) {
        const normalized = this.normalizeCode(code);
        const coupon = await this.couponRepository.findByCode(normalized);

        if (!coupon) {
            throw new HttpException('Coupon not found', HttpStatus.NOT_FOUND);
        }

        return coupon;
    }

    // ------------------------------- Update Coupon -------------------------------
    public async updateCoupon(dto: UpdateCouponDto) {
        const existing = await this.couponRepository.findById(dto.id);

        if (!existing) {
            throw new HttpException('Coupon not found', HttpStatus.NOT_FOUND);
        }

        await this.assertApplicableProductsExist(dto.applicableProductIds);

        const newCode = dto.code ? this.normalizeCode(dto.code) : undefined;
        if (newCode) {
            const duplicate = await this.couponRepository.findByCodeAny(newCode);
            if (duplicate && duplicate.id !== dto.id) {
                throw new HttpException(
                    'Coupon with this code already exists',
                    HttpStatus.CONFLICT,
                );
            }
        }

        const startsAt = this.parseOptionalDate('startsAt', dto.startsAt);
        const expiresAt = this.parseOptionalDate('expiresAt', dto.expiresAt);
        const nextStartsAt = startsAt ?? existing.startsAt ?? undefined;
        const nextExpiresAt = expiresAt ?? existing.expiresAt ?? undefined;
        if (nextStartsAt && nextExpiresAt && nextStartsAt > nextExpiresAt) {
            throw new HttpException(
                'startsAt cannot be after expiresAt',
                HttpStatus.BAD_REQUEST,
            );
        }

        const coupon = await this.couponRepository.update(dto.id, {
            code: newCode,
            name: dto.name,
            description: dto.description,
            type: dto.type,
            value: dto.value,
            minOrderAmount: dto.minOrderAmount,
            maxDiscountAmount: dto.maxDiscountAmount,
            usageLimit: dto.usageLimit,
            userUsageLimit: dto.userUsageLimit,
            isActive: dto.isActive,
            startsAt,
            expiresAt,
            applicableProductIds: dto.applicableProductIds,
        });

        return coupon;
    }

    // ------------------------------- Delete Coupon -------------------------------
    public async deleteCoupon(id: string) {
        const existing = await this.couponRepository.findById(id);

        if (!existing) {
            throw new HttpException('Coupon not found', HttpStatus.NOT_FOUND);
        }

        return this.couponRepository.delete(id);
    }

    // ------------------------------- Set Active -------------------------------
    public async setCouponActive(id: string, dto: SetCouponActiveDto) {
        const existing = await this.couponRepository.findById(id);

        if (!existing) {
            throw new HttpException('Coupon not found', HttpStatus.NOT_FOUND);
        }

        return this.couponRepository.update(id, { isActive: dto.isActive });
    }

    // ------------------------------- Validate Coupon -------------------------------
    public async validateCoupon(dto: ValidateCouponDto, userId?: string) {
        const code = this.normalizeCode(dto.code);

        const coupon = await this.couponRepository.findByCode(code);
        if (!coupon) {
            throw new HttpException('Invalid coupon code', HttpStatus.BAD_REQUEST);
        }

        const now = new Date();
        if (coupon.startsAt && coupon.startsAt > now) {
            throw new HttpException('Coupon is not started yet', HttpStatus.BAD_REQUEST);
        }
        if (coupon.expiresAt && coupon.expiresAt < now) {
            throw new HttpException('Coupon has expired', HttpStatus.BAD_REQUEST);
        }
        if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
            throw new HttpException(
                'Coupon usage limit has been reached',
                HttpStatus.BAD_REQUEST,
            );
        }

        const variantCounts = new Map<string, number>();
        for (const { variantId, quantity } of (dto.variants ?? [])) {
            variantCounts.set(variantId, (variantCounts.get(variantId) ?? 0) + quantity);
        }

        const uniqueVariantIds = Array.from(variantCounts.keys());
        const variants = uniqueVariantIds.length > 0
            ? await this.prisma.productVariant.findMany({
                where: { id: { in: uniqueVariantIds } },
                select: { id: true, price: true, productId: true },
            })
            : [];

        const foundVariantSet = new Set(variants.map((v) => v.id));
        const missingVariantIds = uniqueVariantIds.filter((id) => !foundVariantSet.has(id));
        if (missingVariantIds.length > 0) {
            throw new HttpException(
                `Invalid variantIds. Not found: ${missingVariantIds.join(', ')}`,
                HttpStatus.BAD_REQUEST,
            );
        }

        const orderAmount = variants.reduce((sum, variant) => {
            const qty = variantCounts.get(variant.id) ?? 0;
            return sum + Number(variant.price) * qty;
        }, 0);

        if (coupon.minOrderAmount !== null && orderAmount < Number(coupon.minOrderAmount)) {
            throw new HttpException(
                `Minimum order amount of ${Number(coupon.minOrderAmount).toFixed(2)} is required for this coupon. Your current order total is ${orderAmount.toFixed(2)}`,
                HttpStatus.BAD_REQUEST,
            );
        }

        const restrictByProducts = coupon.applicableProductIds.length > 0;
        const eligibleVariantIds = restrictByProducts
            ? variants
                .filter((variant) => coupon.applicableProductIds.includes(variant.productId))
                .map((variant) => variant.id)
            : variants.map((variant) => variant.id);

        const eligibleVariantSet = new Set(eligibleVariantIds);
        const eligibleAmount = variants.reduce((sum, variant) => {
            if (!eligibleVariantSet.has(variant.id)) {
                return sum;
            }
            const qty = variantCounts.get(variant.id) ?? 0;
            return sum + Number(variant.price) * qty;
        }, 0);

        if (restrictByProducts && eligibleAmount === 0) {
            throw new HttpException(
                'Coupon is not applicable to selected products',
                HttpStatus.BAD_REQUEST,
            );
        }

        const appliesToAllRequestedVariants =
            uniqueVariantIds.length === 0 || eligibleVariantIds.length === uniqueVariantIds.length;

        if (coupon.userUsageLimit !== null && userId) {
            const customer = await this.prisma.customer.findUnique({
                where: { userId },
                select: { id: true },
            });

            if (customer) {
                const usedCount = await this.prisma.order.count({
                    where: {
                        customerId: customer.id,
                        couponId: coupon.id,
                        status: { not: OrderStatus.CANCELLED },
                    },
                });

                if (usedCount >= coupon.userUsageLimit) {
                    throw new HttpException(
                        'Coupon usage limit reached for this user',
                        HttpStatus.BAD_REQUEST,
                    );
                }
            }
        }

        let discountAmount = 0;
        if (coupon.type === CouponType.PERCENTAGE) {
            discountAmount = (eligibleAmount * Number(coupon.value)) / 100;
        } else if (coupon.type === CouponType.FIXED_AMOUNT) {
            discountAmount = Math.min(Number(coupon.value), eligibleAmount);
        } else if (coupon.type === CouponType.FREE_SHIPPING) {
            discountAmount = 0;
        } else {
            discountAmount = 0;
        }

        if (coupon.maxDiscountAmount !== null) {
            discountAmount = Math.min(discountAmount, Number(coupon.maxDiscountAmount));
        }

        discountAmount = Math.max(0, Math.min(discountAmount, orderAmount));

        return {
            coupon,
            discountAmount,
            orderAmount,
            finalAmount: Math.max(0, orderAmount - discountAmount),
            eligibleVariantIds,
            appliesToAllRequestedVariants,
        };
    }
}
