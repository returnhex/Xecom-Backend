import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Res,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { BrandService } from './brand.service';
import { AuthGuard } from 'src/guard/auth.guard';
import sendResponse from 'src/utils/sendResponse';
import type { Response } from 'express';
import { UploadInterceptor } from 'src/common/upload.interceptor';
import { plainToInstance } from 'class-transformer';
import { LibService } from 'src/lib/lib.service';
import { validate } from 'class-validator';
import { CreateBrandDto, UpdateBrandDto } from './brand.dto';
import { RoleGuardWith } from 'src/utils/RoleGuardWith';
import { UserRole } from 'src/generated/prisma';
import { IdDto } from 'src/common/id.dto';

@Controller('brand')
export class BrandController {
  constructor(
    private readonly brandService: BrandService,
    private readonly lib: LibService,
  ) { }

  // Get all brands
  @Get()
  async getAllBrands(
    @Query('pageNumber') pageNumber: string,
    @Query('pageSize') pageSize: string,
    @Query('sortBy') sortBy: string,
    @Query('sortOrder') sortOrder: string,
    @Query('fields') fields: string,
    @Query('isActive') isActive: string,
    @Query('searchTerm') searchTerm: string,
    @Res() res: Response,
  ) {
    const page = parseInt(pageNumber) || 1;
    const size = parseInt(pageSize) || 20;

    const result = await this.brandService.getAllBrands(
      page,
      size,
      sortBy,
      sortOrder as 'asc' | 'desc',
      fields,
      isActive,
      searchTerm,
    );
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Brands fetched successfully',
      meta: result.meta,
      data: result.data,
    });
  }

  // Get brands metadata
  @Get('metadata')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async getBrandsMetadata(@Res() res: Response) {
    const result = await this.brandService.getBrandsMetadata();
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Brands metadata fetched successfully',
      data: result,
    });
  }

  // Get single brand
  @Get(':id')
  async getSingleBrand(@Param() params: IdDto, @Res() res: Response) {
    const result = await this.brandService.getSingleBrand(params.id);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Brand fetched successfully',
      data: result,
    });
  }

  // Add a Brand
  @Post()
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  @UploadInterceptor('file')
  async addBrand(
    @Body('text') text: string,
    @UploadedFile() file: any,
    @Res() res: Response,
  ) {
    // Parse text and transform to DTO instance
    const parsed = JSON.parse(text);
    const createBrandDto = plainToInstance(CreateBrandDto, parsed);

    // If file is uploaded, attach URL
    if (file) {
      try {
        const uploaded = await this.lib.uploadToCloudinary({
          fileName: file.filename,
          path: file.path,
        });
        if (uploaded?.secure_url) {
          createBrandDto.logoUrl = uploaded.secure_url;
        }
      } catch (error: any) {
        console.error('File upload failed:', error);
        return res.status(HttpStatus.REQUEST_TIMEOUT).json({
          success: false,
          statusCode: HttpStatus.REQUEST_TIMEOUT,
          message:
            'File upload failed. Please try again with a smaller file or check your connection.',
          error: error.message || 'Upload timeout',
        });
      }
    }

    // Validate the parsed DTO manually
    const errors = await validate(createBrandDto);
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

    const result = await this.brandService.addBrand(createBrandDto);
    sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Brand created successfully',
      data: result,
    });
  }

  // Update a Brand
  @Put(':id')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  @UploadInterceptor('file')
  async updateBrand(
    @Param() params: IdDto,
    @Body('text') text: string,
    @UploadedFile() file: any,
    @Res() res: Response,
  ) {
    // Parse text and transform to DTO instance
    const parsed = JSON.parse(text);

    if (!parsed.id) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'ID is required in request body',
      });
    }
    // Validate that ID in body matches ID in URL if provided
    if (parsed.id && parsed.id !== params.id) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'ID in request body does not match ID in URL',
      });
    }

    parsed.id = params.id;
    const updateBrandDto = plainToInstance(UpdateBrandDto, parsed);

    // If file is uploaded, attach URL
    if (file) {
      try {
        const uploaded = await this.lib.uploadToCloudinary({
          fileName: file.filename,
          path: file.path,
        });
        if (uploaded?.secure_url) {
          updateBrandDto.logoUrl = uploaded.secure_url;
        }
      } catch (error: any) {
        console.error('File upload failed:', error);
        return res.status(HttpStatus.REQUEST_TIMEOUT).json({
          success: false,
          statusCode: HttpStatus.REQUEST_TIMEOUT,
          message:
            'File upload failed. Please try again with a smaller file or check your connection.',
          error: error.message || 'Upload timeout',
        });
      }
    }

    // Validate the parsed DTO manually
    const errors = await validate(updateBrandDto);
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

    const result = await this.brandService.updateBrand(updateBrandDto);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Brand updated successfully',
      data: result,
    });
  }

  // Delete a Brand
  @Delete(':id')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async deleteBrand(@Param() params: IdDto, @Res() res: Response) {
    const result = await this.brandService.deleteBrand(params.id);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Brand deleted successfully',
      data: result,
    });
  }
}
