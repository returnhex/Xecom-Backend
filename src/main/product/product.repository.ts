import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  Prisma,
  ProductDimensionUnit,
  ProductRelationType,
  ProductStatus,
} from 'src/generated/prisma';

@Injectable()
export class ProductRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findAll(
    skip: number,
    take: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    fields?: string[],
    searchTerm?: string,
    brandIds?: string,
    categoryIds?: string,
    tag?: string,
    ratingCount?: number,
    reviewCount?: number,
    attributeValueIds?: string,
    priceStarts?: number,
    priceEnds?: number,
    statuses?: ProductStatus[],
    isBestCollection?: boolean,
  ) {
    // Build where clause
    const where: Prisma.ProductWhereInput = {};

    // Handle statuses filter; default to ACTIVE when not provided.
    if (statuses && statuses.length > 0) {
      where.status = { in: statuses };
    } else {
      where.status = ProductStatus.ACTIVE;
    }

    if (brandIds) {
      const brandIdArray = brandIds.split(',').map(id => id.trim()).filter(id => id);
      if (brandIdArray.length > 0) {
        where.brandId = { in: brandIdArray };
      }
    }

    if (categoryIds) {
      const categoryIdArray = categoryIds.split(',').map(id => id.trim()).filter(id => id);
      if (categoryIdArray.length > 0) {
        where.categoryId = { in: categoryIdArray };
      }
    }

    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        {
          shortDescription: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        { tags: { has: searchTerm } },
      ];
    }

    if (tag) {
      where.tags = { has: tag };
    }

    if (ratingCount) {
      where.avgRating = { gte: ratingCount };
    }

    if (reviewCount) {
      where.reviewCount = { gte: reviewCount };
    }

    if (isBestCollection !== undefined) {
      where.isBestCollection = isBestCollection;
    }

    // Filter by attribute value IDs
    if (attributeValueIds) {
      console.log('Filtering by attribute value IDs:', attributeValueIds);
      const attributeIdArray = attributeValueIds.split(',').map(id => id.trim()).filter(id => id);
      if (attributeIdArray.length > 0) {
        where.variants = {
          some: {
            attributes: {
              some: {
                attributeValueId: {
                  in: attributeIdArray,
                },
              },
            },
          },
        };
      }
    }

    // Price filter based on variants
    if (priceStarts || priceEnds) {
      const priceFilter: any = {};
      if (priceStarts) {
        priceFilter.gte = priceStarts;
      }
      if (priceEnds) {
        priceFilter.lte = priceEnds;
      }

      where.variants = {
        ...where.variants,
        some: {
          ...((where.variants as any)?.some || {}),
          price: priceFilter,
        },
      };
    }

    // Build orderBy object
    const orderBy: Prisma.ProductOrderByWithRelationInput = sortBy
      ? ({ [sortBy]: sortOrder || 'asc' } as Prisma.ProductOrderByWithRelationInput)
      : { createdAt: 'desc' as Prisma.SortOrder };

    // Build select object if fields are specified
    const select = fields && fields.length > 0
      ? (fields.reduce((acc, field) => ({ ...acc, [field]: true }), {}) as Prisma.ProductSelect)
      : undefined;

    // If select is used, we need to handle includes differently
    const query: any = {
      where,
      skip,
      take,
      orderBy,
    };

    if (select) {
      query.select = {
        ...select,
        // _count: { select: { images: true, variants: true } },
        images: { where: { isFeatured: true }, take: 1, select: { imageUrl: true, isFeatured: true } },
      };
    } else {
      query.include = {
        _count: { select: { images: true, variants: true } },
        images: { where: { isFeatured: true }, take: 1, select: { imageUrl: true, isFeatured: true } },
      };
    }

    return this.prisma.product.findMany(query);
  }

  async count(
    searchTerm?: string,
    brandIds?: string,
    categoryIds?: string,
    tag?: string,
    ratingCount?: number,
    reviewCount?: number,
    statuses?: ProductStatus[],
    isBestCollection?: boolean,
  ) {
    // Build where clause (same as findAll)
    const where: Prisma.ProductWhereInput = {};

    // Handle statuses filter; default to ACTIVE when not provided.
    if (statuses && statuses.length > 0) {
      where.status = { in: statuses };
    }

    if (brandIds) {
      const brandIdArray = brandIds.split(',').map(id => id.trim()).filter(id => id);
      if (brandIdArray.length > 0) {
        where.brandId = { in: brandIdArray };
      }
    }

    if (categoryIds) {
      const categoryIdArray = categoryIds.split(',').map(id => id.trim()).filter(id => id);
      if (categoryIdArray.length > 0) {
        where.categoryId = { in: categoryIdArray };
      }
    }

    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        {
          shortDescription: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        { tags: { has: searchTerm } },
      ];
    }

    if (tag) {
      where.tags = { has: tag };
    }

    if (ratingCount) {
      where.avgRating = { gte: ratingCount };
    }

    if (reviewCount) {
      where.reviewCount = { gte: reviewCount };
    }

    if (isBestCollection !== undefined) {
      where.isBestCollection = isBestCollection;
    }

    return this.prisma.product.count({ where });
  }

  async findById(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        brand: true,
        category: true,
        images: true,
        dimension: true,
        faqs: {
          orderBy: { sortOrder: 'asc' },
        },
        variants: {
          include: {
            attributes: {
              include: {
                attributeValue: {
                  include: {
                    attribute: true,
                  },
                },
              },
            },
          },
        },
        reviews: {
          where: { isApproved: true },
          include: {
            customer: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        relations: {
          include: {
            relatedTo: {
              select: {
                id: true,
                name: true,
                images: {
                  where: { isFeatured: true },
                  take: 1,
                  select: {
                    imageUrl: true,
                  },
                },
              },
            },
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });
  }

  async findByIdActive(id: string) {
    return this.prisma.product.findFirst({
      where: { id, status: ProductStatus.ACTIVE },
      include: {
        brand: true,
        category: true,
        images: true,
        dimension: true,
        faqs: {
          orderBy: { sortOrder: 'asc' },
        },
        variants: {
          include: {
            attributes: {
              include: {
                attributeValue: {
                  include: {
                    attribute: true,
                  },
                },
              },
            },
          },
        },
        reviews: {
          where: { isApproved: true },
          include: {
            customer: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        relations: {
          include: {
            relatedTo: {
              select: {
                id: true,
                name: true,
                images: {
                  where: { isFeatured: true },
                  take: 1,
                  select: {
                    imageUrl: true,
                  },
                },
              },
            },
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.product.findFirst({
      where: { slug },
    });
  }

  async findBySlugExcludingId(slug: string, excludeId: string) {
    return this.prisma.product.findFirst({
      where: { slug, id: { not: excludeId } },
    });
  }

  async findExistingProductIds(ids: string[]) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });

    return products.map((product) => product.id);
  }

  async create(data: Prisma.ProductCreateInput) {
    return this.prisma.product.create({
      data,
      include: {
        images: true,
        variants: true,
        dimension: true,
        faqs: true,
      },
    });
  }

  async update(id: string, data: Prisma.ProductUpdateInput) {
    return this.prisma.product.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string) {
    return this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.DISCONTINUED },
    });
  }

  async incrementViewCount(id: string) {
    return this.prisma.product.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    });
  }

  // ========================================
  // SKU VALIDATION METHODS
  // ========================================

  async findBySku(sku: string) {
    return this.prisma.productVariant.findUnique({
      where: { sku },
    });
  }

  async findBySkuExcludingProduct(sku: string, excludeProductId: string) {
    return this.prisma.productVariant.findFirst({
      where: {
        sku,
        productId: { not: excludeProductId },
      },
    });
  }

  async findProductVariantByIdAndProduct(productId: string, variantId: string) {
    return this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId,
      },
    });
  }

  // ========================================
  // PRODUCT IMAGE METHODS
  // ========================================

  async deleteProductImages(productId: string) {
    return this.prisma.productImage.deleteMany({
      where: { productId },
    });
  }

  async createProductImages(
    productId: string,
    images: Array<{ imageUrl: string; isFeatured: boolean }>,
  ) {
    return this.prisma.productImage.createMany({
      data: images.map((img) => ({
        productId,
        imageUrl: img.imageUrl,
        isFeatured: img.isFeatured,
      })),
    });
  }

  async findProductImageByIdAndProduct(productId: string, imageId: string) {
    return this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
      },
    });
  }

  async setFeaturedImage(productId: string, imageId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.productImage.updateMany({
        where: { productId, isFeatured: true },
        data: { isFeatured: false },
      });

      return tx.productImage.update({
        where: { id: imageId },
        data: { isFeatured: true },
      });
    });
  }

  async replaceRelatedProducts(
    productId: string,
    relatedProductIds: string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.productRelation.deleteMany({
        where: {
          productId,
          type: ProductRelationType.RELATED,
        },
      });

      if (relatedProductIds.length === 0) {
        return { count: 0 };
      }

      return tx.productRelation.createMany({
        data: relatedProductIds.map((relatedToId) => ({
          productId,
          relatedToId,
          type: ProductRelationType.RELATED,
          priority: 0,
        })),
        skipDuplicates: true,
      });
    });
  }

  // ========================================
  // PRODUCT DIMENSION METHODS
  // ========================================

  async deleteProductDimension(productId: string) {
    return this.prisma.productDimension.deleteMany({
      where: { productId },
    });
  }

  async createProductDimension(
    productId: string,
    dimension: {
      length?: number;
      width?: number;
      height?: number;
      unit?: ProductDimensionUnit;
    },
  ) {
    return this.prisma.productDimension.create({
      data: {
        productId,
        length: dimension.length,
        width: dimension.width,
        height: dimension.height,
        unit: dimension.unit || ProductDimensionUnit.CM,
      },
    });
  }

  // ========================================
  // PRODUCT FAQ METHODS
  // ========================================

  async deleteProductFaqs(productId: string) {
    return this.prisma.productFaq.deleteMany({
      where: { productId },
    });
  }

  async createProductFaqs(
    productId: string,
    faqs: Array<{
      question: string;
      answer: string;
      sortOrder: number;
    }>,
  ) {
    return this.prisma.productFaq.createMany({
      data: faqs.map((faq) => ({
        productId,
        question: faq.question,
        answer: faq.answer,
        sortOrder: faq.sortOrder,
      })),
    });
  }

  // ========================================
  // PRODUCT VARIANT METHODS
  // ========================================

  async getProductVariants(productId: string) {
    return this.prisma.productVariant.findMany({
      where: { productId },
    });
  }

  async deleteProductVariants(productId: string) {
    return this.prisma.productVariant.deleteMany({
      where: { productId },
    });
  }

  async createProductVariants(
    productId: string,
    variants: Array<{
      sku: string;
      price: number;
      cost?: number;
      stockQuantity: number;
      stockAlertThreshold: number;
      isDefault: boolean;
    }>,
  ) {
    const createdVariants: Array<{
      id: string;
      sku: string;
      price: any;
      cost: any;
      stockQuantity: number;
      stockAlertThreshold: number;
      isDefault: boolean;
      productId: string;
      createdAt: Date;
    }> = [];
    for (const variant of variants) {
      const created = await this.prisma.productVariant.create({
        data: {
          productId,
          sku: variant.sku,
          price: variant.price,
          cost: variant.cost,
          stockQuantity: variant.stockQuantity,
          stockAlertThreshold: variant.stockAlertThreshold,
          isDefault: variant.isDefault,
        },
      });
      createdVariants.push(created);
    }
    return createdVariants;
  }

  async updateProductVariant(
    variantId: string,
    data: Prisma.ProductVariantUpdateInput,
  ) {
    return this.prisma.productVariant.update({
      where: { id: variantId },
      data,
    });
  }

  async deleteVariantAttributes(variantId: string) {
    return this.prisma.productVariantAttribute.deleteMany({
      where: { variantId },
    });
  }

  async createVariantAttributes(
    variantId: string,
    attributeValueIds: string[],
  ) {
    return this.prisma.productVariantAttribute.createMany({
      data: attributeValueIds.map((attributeValueId) => ({
        variantId,
        attributeValueId,
      })),
    });
  }

  // ========================================
  // METADATA OPERATIONS
  // ========================================

  async countTotal() {
    return this.prisma.product.count();
  }

  async countByStatus(status: ProductStatus) {
    return this.prisma.product.count({
      where: { status },
    });
  }

  async countByStatusNot(status: ProductStatus) {
    return this.prisma.product.count({
      where: { status: { not: status } },
    });
  }

  async sumTotalSales() {
    const result = await this.prisma.product.aggregate({
      _sum: {
        totalSales: true,
      },
    });
    return result._sum.totalSales || 0;
  }
}
