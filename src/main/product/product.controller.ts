import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Res,
  UseGuards,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ProductService } from './product.service';
import { LibService } from 'src/lib/lib.service';
import { AuthGuard } from 'src/guard/auth.guard';
import sendResponse from 'src/utils/sendResponse';
import type { Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductDto, UpdateProductDto, CreateProductImageDto } from './product.dto';
import { RoleGuardWith } from 'src/utils/RoleGuardWith';
import { UserRole } from 'src/generated/prisma';
import { IdDto } from 'src/common/id.dto';

@Controller('product')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly lib: LibService,
  ) { }

  // Get all products
  @Get()
  async getAllProducts(
    @Query('pageNumber') pageNumber: string,
    @Query('pageSize') pageSize: string,
    @Query('sortBy') sortBy: string,
    @Query('sortOrder') sortOrder: string,
    @Query('fields') fields: string,
    @Query('searchTerm') searchTerm: string,
    @Query('brandIds') brandIds: string,
    @Query('categoryIds') categoryIds: string,
    @Query('tag') tag: string,
    @Query('ratingCount') ratingCount: string,
    @Query('reviewCount') reviewCount: string,
    @Query('attributeValueIds') attributeValueIds: string,
    @Query('priceStarts') priceStarts: string,
    @Query('priceEnds') priceEnds: string,
    @Query('statuses') statuses: string,
    @Query('isBestCollection') isBestCollection: string,
    @Res() res: Response,
  ) {
    const page = parseInt(pageNumber) || 1;
    const size = parseInt(pageSize) || 20;

    const result = await this.productService.getAllProducts(
      page,
      size,
      sortBy,
      sortOrder as 'asc' | 'desc',
      fields,
      searchTerm,
      brandIds,
      categoryIds,
      tag,
      ratingCount ? parseInt(ratingCount) : undefined,
      reviewCount ? parseInt(reviewCount) : undefined,
      attributeValueIds,
      priceStarts ? parseFloat(priceStarts) : undefined,
      priceEnds ? parseFloat(priceEnds) : undefined,
      statuses,
      isBestCollection === undefined
        ? undefined
        : isBestCollection.toLowerCase() === 'true',
    );
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Products fetched successfully',
      meta: result.meta,
      data: result.data,
    });
  }

  // Get products metadata
  @Get('metadata')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async getProductsMetadata(@Res() res: Response) {
    const result = await this.productService.getProductsMetadata();
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Products metadata fetched successfully',
      data: result,
    });
  }

  // Get single product
  @Get(':id')
  async getSingleProduct(@Param() params: IdDto, @Res() res: Response) {
    const result = await this.productService.getSingleProduct(params.id);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Product fetched successfully',
      data: result,
    });
  }

  // Add a Product
  @Post()
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'images', maxCount: 10 },
        { name: 'videoUrl', maxCount: 1 },
        { name: 'manualUrl', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: './uploads',
          filename: (req, file, cb) => {
            const uniqueSuffix =
              Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname);
            cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
          },
        }),
      },
    ),
  )
  async addProduct(
    @Body('text') text: string,
    @UploadedFiles()
    files: {
      images?: Express.Multer.File[];
      videoUrl?: Express.Multer.File[];
      manualUrl?: Express.Multer.File[];
    },
    @Res() res: Response,
  ) {
    // Parse text and transform to DTO instance
    const parsed = JSON.parse(text);
    const createProductDto = plainToInstance(CreateProductDto, parsed);

    // Handle product image uploads to Cloudinary
    if (files?.images && files.images.length > 0) {
      const uploadedImages: Array<{ imageUrl: string; isFeatured: boolean }> = [];
      for (let i = 0; i < files.images.length; i++) {
        const imageFile = files.images[i];
        try {
          const uploaded = await this.lib.uploadToCloudinary({
            fileName: imageFile.filename,
            path: imageFile.path,
          });
          if (uploaded?.secure_url) {
            uploadedImages.push({
              imageUrl: uploaded.secure_url,
              isFeatured: i === 0, // First image is featured
            });
          }
        } catch (error: any) {
          console.error('Image upload failed:', error);
          return res.status(HttpStatus.REQUEST_TIMEOUT).json({
            success: false,
            statusCode: HttpStatus.REQUEST_TIMEOUT,
            message:
              'Image upload failed. Please try again with a smaller file or check your connection.',
            error: error instanceof Error ? error.message : 'Upload timeout',
          });
        }
      }
      // Merge with images from JSON body
      // Transform plain objects to DTO instances
      const transformedImages = uploadedImages.map(img =>
        plainToInstance(CreateProductImageDto, img)
      );
      createProductDto.images = [
        ...(createProductDto.images || []),
        ...transformedImages,
      ];
    }

    // Handle video file upload to Cloudinary
    if (files?.videoUrl?.[0]) {
      try {
        const uploaded = await this.lib.uploadToCloudinary({
          fileName: files.videoUrl[0].filename,
          path: files.videoUrl[0].path,
        });
        if (uploaded?.secure_url) {
          createProductDto.videoUrl = uploaded.secure_url;
        }
      } catch (error: any) {
        console.error('Video upload failed:', error);
        return res.status(HttpStatus.REQUEST_TIMEOUT).json({
          success: false,
          statusCode: HttpStatus.REQUEST_TIMEOUT,
          message:
            'Video upload failed. Please try again with a smaller file or check your connection.',
          error: error instanceof Error ? error.message : 'Upload timeout',
        });
      }
    }

    // Handle manual file upload to Cloudinary
    if (files?.manualUrl?.[0]) {
      try {
        const uploaded = await this.lib.uploadToCloudinary({
          fileName: files.manualUrl[0].filename,
          path: files.manualUrl[0].path,
        });
        if (uploaded?.secure_url) {
          createProductDto.manualUrl = uploaded.secure_url;
        }
      } catch (error: any) {
        console.error('Manual upload failed:', error);
        return res.status(HttpStatus.REQUEST_TIMEOUT).json({
          success: false,
          statusCode: HttpStatus.REQUEST_TIMEOUT,
          message:
            'Manual upload failed. Please try again with a smaller file or check your connection.',
          error: error instanceof Error ? error.message : 'Upload timeout',
        });
      }
    }

    // Validate the DTO
    console.log('Validating DTO:', createProductDto);
    const errors = await validate(createProductDto);
    console.log('Validation errors:', errors);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message:
          Object.values(errors[0].constraints || {})[0] || 'Validation failed',
        errorDetails: errors.map((err) => ({
          property: err.property,
          constraints: err.constraints,
        })),
      });
    }

    const result = await this.productService.addProduct(createProductDto);
    sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Product created successfully',
      data: result,
    });
  }

  // Update a Product
  @Put(':id')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'images', maxCount: 10 },
        { name: 'videoUrl', maxCount: 1 },
        { name: 'manualUrl', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: './uploads',
          filename: (req, file, cb) => {
            const uniqueSuffix =
              Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname);
            cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
          },
        }),
      },
    ),
  )
  async updateProduct(
    @Param() params: IdDto,
    @Body('text') text: string,
    @UploadedFiles()
    files: {
      images?: Express.Multer.File[];
      videoUrl?: Express.Multer.File[];
      manualUrl?: Express.Multer.File[];
    },
    @Res() res: Response,
  ) {
    // Parse text and transform to DTO instance
    const parsed = JSON.parse(text);

    // Validate that ID in body matches ID in URL if provided
    if (parsed?.id && parsed.id !== params.id) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'ID in request body does not match ID in URL',
      });
    }

    parsed.id = params.id;
    const updateProductDto = plainToInstance(UpdateProductDto, parsed);

    // Handle product image uploads to Cloudinary
    if (files?.images && files.images.length > 0) {
      const uploadedImages: Array<{ imageUrl: string; }> = [];
      for (let i = 0; i < files.images.length; i++) {
        const imageFile = files.images[i];
        try {
          const uploaded = await this.lib.uploadToCloudinary({
            fileName: imageFile.filename,
            path: imageFile.path,
          });
          if (uploaded?.secure_url) {
            uploadedImages.push({
              imageUrl: uploaded.secure_url,
            });
          }
        } catch (error: any) {
          console.error('Image upload failed:', error);
          return res.status(HttpStatus.REQUEST_TIMEOUT).json({
            success: false,
            statusCode: HttpStatus.REQUEST_TIMEOUT,
            message:
              'Image upload failed. Please try again with a smaller file or check your connection.',
            error: error instanceof Error ? error.message : 'Upload timeout',
          });
        }
      }
      // Merge with images from JSON body
      // Transform plain objects to DTO instances
      const transformedImages = uploadedImages.map(img =>
        plainToInstance(CreateProductImageDto, img)
      );
      updateProductDto.images = [
        ...(updateProductDto.images || []),
        ...transformedImages,
      ];
    }

    // Handle video file upload to Cloudinary
    if (files?.videoUrl?.[0]) {
      try {
        const uploaded = await this.lib.uploadToCloudinary({
          fileName: files.videoUrl[0].filename,
          path: files.videoUrl[0].path,
        });
        if (uploaded?.secure_url) {
          updateProductDto.videoUrl = uploaded.secure_url;
        }
      } catch (error: any) {
        console.error('Video upload failed:', error);
        return res.status(HttpStatus.REQUEST_TIMEOUT).json({
          success: false,
          statusCode: HttpStatus.REQUEST_TIMEOUT,
          message:
            'Video upload failed. Please try again with a smaller file or check your connection.',
          error: error instanceof Error ? error.message : 'Upload timeout',
        });
      }
    }

    // Handle manual file upload to Cloudinary
    if (files?.manualUrl?.[0]) {
      try {
        const uploaded = await this.lib.uploadToCloudinary({
          fileName: files.manualUrl[0].filename,
          path: files.manualUrl[0].path,
        });
        if (uploaded?.secure_url) {
          updateProductDto.manualUrl = uploaded.secure_url;
        }
      } catch (error: any) {
        console.error('Manual upload failed:', error);
        return res.status(HttpStatus.REQUEST_TIMEOUT).json({
          success: false,
          statusCode: HttpStatus.REQUEST_TIMEOUT,
          message:
            'Manual upload failed. Please try again with a smaller file or check your connection.',
          error: error instanceof Error ? error.message : 'Upload timeout',
        });
      }
    }

    // Validate the DTO
    const errors = await validate(updateProductDto);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message:
          Object.values(errors[0].constraints || {})[0] || 'Validation failed',
        errorDetails: errors.map((err) => ({
          property: err.property,
          constraints: err.constraints,
        })),
      });
    }

    const result = await this.productService.updateProduct(updateProductDto);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Product updated successfully',
      data: result,
    });
  }

  // Delete a Product
  @Delete(':id')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async deleteProduct(@Param() params: IdDto, @Res() res: Response) {
    const result = await this.productService.deleteProduct(params.id);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Product deleted successfully',
      data: result,
    });
  }

  // Set featured image of a product
  @Patch(':id/featured-image/:imageId')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async setFeaturedProductImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Res() res: Response,
  ) {
    const result = await this.productService.setFeaturedProductImage(id, imageId);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Featured image updated successfully',
      data: result,
    });
  }

  // =================== PRODUCT RELATIONS ENDPOINTS ===================
}
