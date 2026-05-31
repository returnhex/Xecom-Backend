import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ProductRelationRepository } from './product-relation.repository';
import { ProductRepository } from '../product/product.repository';
import {
  CreateProductRelationDto,
  CreateBulkProductRelationsDto,
  UpdateProductRelationDto,
} from './product-relation.dto';
import { ProductRelationType } from 'src/generated/prisma';

@Injectable()
export class ProductRelationService {
  constructor(
    private readonly productRelationRepository: ProductRelationRepository,
    private readonly productRepository: ProductRepository,
  ) {}

  // ------------------------------- Add Single Relation -------------------------------
  async addRelation(dto: CreateProductRelationDto) {
    // Validate that both products exist
    const [product, relatedProduct] = await Promise.all([
      this.productRepository.findById(dto.productId),
      this.productRepository.findById(dto.relatedToId),
    ]);

    if (!product) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }

    if (!relatedProduct) {
      throw new HttpException(
        'Related product not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Prevent self-relation
    if (dto.productId === dto.relatedToId) {
      throw new HttpException(
        'Product cannot be related to itself',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.productRelationRepository.create({
      product: { connect: { id: dto.productId } },
      relatedTo: { connect: { id: dto.relatedToId } },
      type: dto.type,
      priority: dto.priority || 0,
    });
  }

  // ------------------------------- Add Bulk Relations -------------------------------
  async addBulkRelations(dto: CreateBulkProductRelationsDto) {
    // Validate product exists
    const product = await this.productRepository.findById(dto.productId);

    if (!product) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }

    // Filter out self-relations
    const validRelatedIds = dto.relatedProductIds.filter(
      (id) => id !== dto.productId,
    );

    if (validRelatedIds.length === 0) {
      throw new HttpException(
        'No valid related products provided',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Create relations
    const relations = validRelatedIds.map((relatedId) => ({
      productId: dto.productId,
      relatedToId: relatedId,
      type: dto.type,
      priority: dto.priority || 0,
    }));

    const result = await this.productRelationRepository.createMany(relations);

    return {
      created: result.count,
      skipped: dto.relatedProductIds.length - validRelatedIds.length,
    };
  }

  // ------------------------------- Get Relations -------------------------------
  async getRelations(productId: string, type?: ProductRelationType) {
    const product = await this.productRepository.findById(productId);

    if (!product) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }

    return this.productRelationRepository.findByProductAndType(productId, type);
  }

  // ------------------------------- Update Relation -------------------------------
  async updateRelation(dto: UpdateProductRelationDto) {
    const relation = await this.productRelationRepository.findById(dto.id);

    if (!relation) {
      throw new HttpException('Relation not found', HttpStatus.NOT_FOUND);
    }

    return this.productRelationRepository.update(dto.id, {
      priority: dto.priority,
    });
  }

  // ------------------------------- Delete Relation -------------------------------
  async deleteRelation(id: string) {
    const relation = await this.productRelationRepository.findById(id);

    if (!relation) {
      throw new HttpException('Relation not found', HttpStatus.NOT_FOUND);
    }

    return this.productRelationRepository.delete(id);
  }

  // ------------------------------- Delete All Relations -------------------------------
  async deleteAllRelations(productId: string, type?: ProductRelationType) {
    const product = await this.productRepository.findById(productId);

    if (!product) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }

    return this.productRelationRepository.deleteAllByProduct(productId, type);
  }
}
