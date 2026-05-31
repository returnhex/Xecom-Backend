import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ProductRepository } from './product.repository';
import { CreateProductDto, UpdateProductDto } from './product.dto';
import calculatePagination from 'src/utils/calculatePagination';
import { BrandRepository } from '../brand/brand.repository';
import { CategoryRepository } from '../category/category.repository';
import { ProductDimensionUnit, ProductStatus } from 'src/generated/prisma';

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly brandRepository: BrandRepository,
    private readonly categoryRepository: CategoryRepository,
  ) { }

  // ------------------------------- Get All Products -------------------------------
  public async getAllProducts(
    pageNumber: number,
    pageSize: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    fields?: string,
    searchTerm?: string,
    brandIds?: string,
    categoryIds?: string,
    tag?: string,
    ratingCount?: number,
    reviewCount?: number,
    attributeValueIds?: string,
    priceStarts?: number,
    priceEnds?: number,
    statuses?: string,
    isBestCollection?: boolean,
  ) {
    const { skip, take } = calculatePagination({
      page: pageNumber,
      take: pageSize,
    });

    // Parse fields string into array
    const selectedFields = fields
      ? fields.split(',').map((field) => field.trim())
      : undefined;

    const parsedStatuses = statuses
      ? statuses
        .split(',')
        .map((status) => status.trim().toUpperCase())
        .filter((status): status is ProductStatus =>
          Object.values(ProductStatus).includes(status as ProductStatus),
        )
      : undefined;

    if (statuses && (!parsedStatuses || parsedStatuses.length === 0)) {
      throw new HttpException(
        'Invalid statuses query param. Provide one or more valid product statuses.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const [products, total] = await Promise.all([
      this.productRepository.findAll(
        skip,
        take,
        sortBy,
        sortOrder,
        selectedFields,
        searchTerm,
        brandIds,
        categoryIds,
        tag,
        ratingCount,
        reviewCount,
        attributeValueIds,
        priceStarts,
        priceEnds,
        parsedStatuses,
        isBestCollection,
      ),
      this.productRepository.count(
        searchTerm,
        brandIds,
        categoryIds,
        tag,
        ratingCount,
        reviewCount,
        parsedStatuses,
        isBestCollection,
      ),
    ]);

    return {
      data: products,
      meta: {
        pageNumber,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        totalCount: total,
      },
    };
  }

  // ------------------------------- Get Single Product -------------------------------
  public async getSingleProduct(id: string) {
    const product = await this.productRepository.findByIdActive(id);

    if (!product) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }

    // Increment view count
    await this.productRepository.incrementViewCount(id);

    // Return fresh data so response includes the incremented viewCount.
    const freshProduct = await this.productRepository.findByIdActive(id);

    if (!freshProduct) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }

    const relatedProducts = (freshProduct.relations || []).map((relation) => ({
      productId: relation.relatedTo.id,
      name: relation.relatedTo.name,
      featuredImage: relation.relatedTo.images?.[0]?.imageUrl || null,
    }));

    const { relations, ...productWithoutRelations } = freshProduct;

    return {
      ...productWithoutRelations,
      relatedProducts,
    };
  }

  // ------------------------------- Add Product -------------------------------
  public async addProduct(createProductDto: CreateProductDto) {
    const {
      slug,
      images,
      variants,
      dimension,
      faqs,
      brandId,
      categoryId,
      relatedProductIds,
    } = createProductDto;

    console.log("Creating product with DTO:", createProductDto)

    // Validate brand exists and is active
    if (brandId) {
      const brand = await this.brandRepository.findByIdActive(brandId);
      if (!brand) {
        throw new HttpException(
          'Brand not found or inactive',
          HttpStatus.NOT_FOUND,
        );
      }
    }

    // Validate category exists and is active
    if (categoryId) {
      const category = await this.categoryRepository.findByIdActive(categoryId);
      if (!category) {
        throw new HttpException(
          'Category not found or inactive',
          HttpStatus.NOT_FOUND,
        );
      }
    }

    // Validate that at least one image is provided
    if (!images || images.length === 0) {
      throw new HttpException(
        'At least one product image is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate that at least one variant is provided
    if (!variants || variants.length === 0) {
      throw new HttpException(
        'At least one product variant is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate unique SKUs in variants
    const skus = variants.map((v) => v.sku);
    const uniqueSkus = new Set(skus);
    if (skus.length !== uniqueSkus.size) {
      throw new HttpException(
        'Duplicate SKUs found in variants',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if SKUs already exist in database
    for (const variant of variants) {
      const existingSku = await this.productRepository.findBySku(variant.sku!);
      if (existingSku) {
        throw new HttpException(
          `SKU '${variant.sku}' already exists`,
          HttpStatus.CONFLICT,
        );
      }
    }

    // Check if slug already exists
    const existingProduct = await this.productRepository.findBySlug(slug);

    if (existingProduct) {
      throw new HttpException(
        'Product with this slug already exists',
        HttpStatus.CONFLICT,
      );
    }

    if (relatedProductIds && relatedProductIds.length > 0) {
      const uniqueRelatedIds = [...new Set(relatedProductIds)];
      const existingRelatedIds = await this.productRepository.findExistingProductIds(
        uniqueRelatedIds,
      );

      if (existingRelatedIds.length !== uniqueRelatedIds.length) {
        throw new HttpException(
          'One or more related product IDs are invalid',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const product = await this.productRepository.create({
      name: createProductDto.name,
      slug: createProductDto.slug,
      shortDescription: createProductDto.shortDescription,
      fullDescription: createProductDto.fullDescription,
      brand: createProductDto.brandId
        ? { connect: { id: createProductDto.brandId } }
        : undefined,
      category: createProductDto.categoryId
        ? { connect: { id: createProductDto.categoryId } }
        : undefined,
      status: createProductDto.status || 'DRAFT',
      featured: createProductDto.featured || false,
      isBestCollection: createProductDto.isBestCollection ?? false,
      weight: createProductDto.weight,
      tags: createProductDto.tags || [],
      seoTitle: createProductDto.seoTitle,
      seoDescription: createProductDto.seoDescription,
      metaKeywords: createProductDto.metaKeywords || [],
      warranty: createProductDto.warranty,
      specifications: createProductDto.specifications || {},
      videoUrl: createProductDto.videoUrl,
      manualUrl: createProductDto.manualUrl,
      minOrderQty: createProductDto.minOrderQty ? parseFloat(createProductDto.minOrderQty.toFixed(2)) : 1,
      maxOrderQty: createProductDto.maxOrderQty ? parseFloat(createProductDto.maxOrderQty.toFixed(2)) : undefined,
      images: {
        create: images.map((img) => ({
          imageUrl: img.imageUrl,
          isFeatured: img.isFeatured || false,
        })),
      },
      variants: {
        create: variants.map((variant) => ({
          sku: variant.sku!,
          price: parseFloat(variant.price!.toFixed(2)),
          cost: variant.cost ? parseFloat(variant.cost.toFixed(2)) : undefined,
          stockQuantity: parseFloat(variant.stockQuantity!.toFixed(2)),
          stockAlertThreshold: variant.stockAlertThreshold ? parseFloat(variant.stockAlertThreshold.toFixed(2)) : 5,
          isDefault: variant.isDefault || false,
        })),
      },
      dimension: dimension
        ? {
          create: {
            length: dimension.length,
            width: dimension.width,
            height: dimension.height,
            unit: dimension.unit || ProductDimensionUnit.CM,
          },
        }
        : undefined,
      faqs: faqs && faqs.length > 0
        ? {
          create: faqs.map((faq, index) => ({
            question: faq.question,
            answer: faq.answer,
            sortOrder: faq.sortOrder ?? index,
          })),
        }
        : undefined,
    });

    // Create variant attributes separately
    if (product.variants && product.variants.length > 0) {
      for (let i = 0; i < variants.length; i++) {
        const variantData = variants[i];
        if (variantData.attributeValueIds && variantData.attributeValueIds.length > 0) {
          const variant = product.variants[i];
          await this.productRepository.createVariantAttributes(
            variant.id,
            variantData.attributeValueIds,
          );
        }
      }
    }

    if (relatedProductIds !== undefined) {
      const uniqueRelatedIds = [...new Set(relatedProductIds || [])].filter(
        (relatedId) => relatedId !== product.id,
      );

      await this.productRepository.replaceRelatedProducts(
        product.id,
        uniqueRelatedIds,
      );
    }

    return product;
  }

  // ------------------------------- Update Product -------------------------------
  public async updateProduct(updateProductDto: UpdateProductDto) {
    const {
      id,
      slug,
      images,
      variants,
      dimension,
      faqs,
      brandId,
      categoryId,
      relatedProductIds,
    } = updateProductDto;

    // Check if product exists
    const existingProduct = await this.productRepository.findById(id);

    if (!existingProduct) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }

    // Validate brand exists and is active if provided
    if (brandId) {
      const brand = await this.brandRepository.findByIdActive(brandId);
      if (!brand) {
        throw new HttpException(
          'Brand not found or inactive',
          HttpStatus.NOT_FOUND,
        );
      }
    }

    // Validate category exists and is active if provided
    if (categoryId) {
      const category = await this.categoryRepository.findByIdActive(categoryId);
      if (!category) {
        throw new HttpException(
          'Category not found or inactive',
          HttpStatus.NOT_FOUND,
        );
      }
    }

    // If images are provided, validate at least one
    if (images !== undefined && images.length === 0) {
      throw new HttpException(
        'At least one product image is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // If variants are provided, validate at least one
    if (variants !== undefined && variants.length === 0) {
      throw new HttpException(
        'At least one product variant is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate unique SKUs in request payload if provided
    if (variants && variants.length > 0) {
      const skus = variants
        .map((v) => v.sku)
        .filter((sku): sku is string => Boolean(sku));
      const uniqueSkus = new Set(skus);
      if (skus.length !== uniqueSkus.size) {
        throw new HttpException(
          'Duplicate SKUs found in variants',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // If slug is being updated, check if it's already in use
    if (slug && slug !== existingProduct.slug) {
      const slugExists = await this.productRepository.findBySlugExcludingId(
        slug,
        id,
      );

      if (slugExists) {
        throw new HttpException(
          'Product with this slug already exists',
          HttpStatus.CONFLICT,
        );
      }
    }

    if (relatedProductIds !== undefined) {
      const uniqueRelatedIds = [...new Set(relatedProductIds || [])];

      if (uniqueRelatedIds.some((relatedId) => relatedId === id)) {
        throw new HttpException(
          'Product cannot be related to itself',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (uniqueRelatedIds.length > 0) {
        const existingRelatedIds = await this.productRepository.findExistingProductIds(
          uniqueRelatedIds,
        );

        if (existingRelatedIds.length !== uniqueRelatedIds.length) {
          throw new HttpException(
            'One or more related product IDs are invalid',
            HttpStatus.BAD_REQUEST,
          );
        }
      }
    }

    const productUpdateData: any = {
      name: updateProductDto.name,
      slug: updateProductDto.slug,
      shortDescription: updateProductDto.shortDescription,
      fullDescription: updateProductDto.fullDescription,
      status: updateProductDto.status,
      featured: updateProductDto.featured,
      isBestCollection: updateProductDto.isBestCollection,
      weight: updateProductDto.weight,
      tags: updateProductDto.tags,
      seoTitle: updateProductDto.seoTitle,
      seoDescription: updateProductDto.seoDescription,
      metaKeywords: updateProductDto.metaKeywords,
      warranty: updateProductDto.warranty,
      specifications: updateProductDto.specifications,
      videoUrl: updateProductDto.videoUrl,
      manualUrl: updateProductDto.manualUrl,
      minOrderQty: updateProductDto.minOrderQty,
      maxOrderQty: updateProductDto.maxOrderQty,
    };

    if (updateProductDto.brandId !== undefined) {
      productUpdateData.brand = { connect: { id: updateProductDto.brandId } };
    }

    if (updateProductDto.categoryId !== undefined) {
      productUpdateData.category = {
        connect: { id: updateProductDto.categoryId },
      };
    }

    const product = await this.productRepository.update(id, productUpdateData);

    // Handle dimension replacement if provided
    if (dimension !== undefined) {
      // Delete existing dimension
      await this.productRepository.deleteProductDimension(id);
      // Create new dimension if data is provided
      if (dimension) {
        await this.productRepository.createProductDimension(id, {
          length: dimension.length,
          width: dimension.width,
          height: dimension.height,
          unit: dimension.unit || ProductDimensionUnit.CM,
        });
      }
    }

    // Handle FAQs replacement if provided
    if (faqs !== undefined) {
      // Delete existing FAQs
      await this.productRepository.deleteProductFaqs(id);
      // Create new FAQs if data is provided
      if (faqs && faqs.length > 0) {
        await this.productRepository.createProductFaqs(
          id,
          faqs.map((faq, index) => ({
            question: faq.question,
            answer: faq.answer,
            sortOrder: faq.sortOrder ?? index,
          })),
        );
      }
    }

    // Handle images replacement if provided
    if (images && images.length > 0) {
      // Delete existing images
      await this.productRepository.deleteProductImages(id);
      // Create new images
      await this.productRepository.createProductImages(
        id,
        images.map((img) => ({
          imageUrl: img.imageUrl,
          isFeatured: img.isFeatured || false,
        })),
      );
    }

    // Handle variants partial update if provided
    if (variants && variants.length > 0) {
      const isFullReplaceMode = variants.every(
        (v) => !v.id && v.sku !== undefined && v.price !== undefined && v.stockQuantity !== undefined,
      );

      if (isFullReplaceMode) {
        // Keep previous behavior for full payload updates.
        for (const variant of variants) {
          const existingSku = await this.productRepository.findBySkuExcludingProduct(
            variant.sku!,
            id,
          );

          if (existingSku) {
            throw new HttpException(
              `SKU '${variant.sku}' already exists`,
              HttpStatus.CONFLICT,
            );
          }
        }

        const existingVariants = await this.productRepository.getProductVariants(id);

        for (const variant of existingVariants) {
          await this.productRepository.deleteVariantAttributes(variant.id);
        }
        await this.productRepository.deleteProductVariants(id);

        const createdVariants = await this.productRepository.createProductVariants(
          id,
          variants.map((v) => ({
            sku: v.sku!,
            price: v.price!,
            cost: v.cost,
            stockQuantity: v.stockQuantity!,
            stockAlertThreshold: v.stockAlertThreshold || 5,
            isDefault: v.isDefault || false,
          })),
        );

        for (let i = 0; i < variants.length; i++) {
          const variantData = variants[i];
          if (variantData.attributeValueIds && variantData.attributeValueIds.length > 0) {
            const createdVariant = createdVariants[i];
            await this.productRepository.createVariantAttributes(
              createdVariant.id,
              variantData.attributeValueIds,
            );
          }
        }

        return product;
      }

      const existingVariants = await this.productRepository.getProductVariants(id);

      for (const variantData of variants as Array<{
        id?: string;
        sku?: string;
        price?: number;
        cost?: number;
        stockQuantity?: number;
        stockAlertThreshold?: number;
        isDefault?: boolean;
        attributeValueIds?: string[];
      }>) {
        let targetVariantId = variantData.id;

        if (!targetVariantId) {
          if (existingVariants.length === 1) {
            targetVariantId = existingVariants[0].id;
          } else {
            throw new HttpException(
              'variant id is required when product has multiple variants',
              HttpStatus.BAD_REQUEST,
            );
          }
        }

        const existingVariant = await this.productRepository.findProductVariantByIdAndProduct(
          id,
          targetVariantId,
        );

        if (!existingVariant) {
          throw new HttpException(
            `Variant '${targetVariantId}' not found for this product`,
            HttpStatus.NOT_FOUND,
          );
        }

        if (variantData.sku && variantData.sku !== existingVariant.sku) {
          const skuExists = await this.productRepository.findBySku(variantData.sku);
          if (skuExists && skuExists.id !== existingVariant.id) {
            throw new HttpException(
              `SKU '${variantData.sku}' already exists`,
              HttpStatus.CONFLICT,
            );
          }
        }

        const variantUpdateData: any = {
          sku: variantData.sku,
          price: variantData.price,
          cost: variantData.cost,
          stockQuantity: variantData.stockQuantity,
          stockAlertThreshold: variantData.stockAlertThreshold,
          isDefault: variantData.isDefault,
        };

        await this.productRepository.updateProductVariant(
          existingVariant.id,
          variantUpdateData,
        );

        if (variantData.attributeValueIds !== undefined) {
          await this.productRepository.deleteVariantAttributes(existingVariant.id);
          if (variantData.attributeValueIds.length > 0) {
            await this.productRepository.createVariantAttributes(
              existingVariant.id,
              variantData.attributeValueIds,
            );
          }
        }
      }
    }

    if (relatedProductIds !== undefined) {
      const uniqueRelatedIds = [...new Set(relatedProductIds || [])].filter(
        (relatedId) => relatedId !== id,
      );

      await this.productRepository.replaceRelatedProducts(
        id,
        uniqueRelatedIds,
      );
    }

    return product;
  }

  // ------------------------------- Delete Product -------------------------------
  public async deleteProduct(id: string) {
    // Check if product exists
    const product = await this.productRepository.findById(id);

    if (!product) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }

    // Soft delete by setting status to DISCONTINUED
    const deletedProduct = await this.productRepository.softDelete(id);

    return deletedProduct;
  }

  // ------------------------------- Set Featured Product Image -------------------------------
  public async setFeaturedProductImage(productId: string, imageId: string) {
    const product = await this.productRepository.findById(productId);

    if (!product) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }

    const image = await this.productRepository.findProductImageByIdAndProduct(
      productId,
      imageId,
    );

    if (!image) {
      throw new HttpException('Product image not found', HttpStatus.NOT_FOUND);
    }

    return this.productRepository.setFeaturedImage(productId, imageId);
  }

  // ------------------------------- Get Products Metadata -------------------------------
  public async getProductsMetadata() {
    const [
      totalProducts,
      totalActiveProducts,
      totalInactiveProducts,
      totalSalesCount,
    ] = await Promise.all([
      this.productRepository.countTotal(),
      this.productRepository.countByStatus('ACTIVE' as any),
      this.productRepository.countByStatusNot('ACTIVE' as any),
      this.productRepository.sumTotalSales(),
    ]);

    return {
      totalProducts,
      totalActiveProducts,
      totalInactiveProducts,
      totalSalesCount,
    };
  }
}
