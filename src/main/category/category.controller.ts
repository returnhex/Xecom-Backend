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
import { CategoryService } from './category.service';
import { AuthGuard } from 'src/guard/auth.guard';
import sendResponse from 'src/utils/sendResponse';
import type { Response } from 'express';
import { UploadInterceptor } from 'src/common/upload.interceptor';
import { plainToInstance } from 'class-transformer';
import { LibService } from 'src/lib/lib.service';
import { validate } from 'class-validator';
import { CreateCategoryDto, UpdateCategoryDto } from './category.dto';
import { RoleGuardWith } from 'src/utils/RoleGuardWith';
import { UserRole } from 'src/generated/prisma';
import { IdDto } from 'src/common/id.dto';

@Controller('category')
export class CategoryController {
  constructor(
    private readonly categoryService: CategoryService,
    private readonly lib: LibService,
  ) { }

  // Get all categories
  @Get()
  async getAllCategories(
    @Query('pageNumber') pageNumber: string,
    @Query('pageSize') pageSize: string,
    @Query('sortBy') sortBy: string,
    @Query('sortOrder') sortOrder: string,
    @Query('fields') fields: string,
    @Query('isActive') isActive: string,
    @Query('searchTerm') searchTerm: string,
    @Query('targetAudience') targetAudience: string,
    @Res() res: Response,
  ) {
    const page = parseInt(pageNumber) || 1;
    const size = parseInt(pageSize) || 20;

    const result = await this.categoryService.getAllCategories(
      page,
      size,
      sortBy,
      sortOrder as 'asc' | 'desc',
      fields,
      isActive,
      searchTerm,
      targetAudience,
    );
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Categories fetched successfully',
      meta: result.meta,
      data: result.data,
    });
  }

  // Get categories metadata
  @Get('metadata')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async getCategoriesMetadata(@Res() res: Response) {
    const result = await this.categoryService.getCategoriesMetadata();
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Categories metadata fetched successfully',
      data: result,
    });
  }

  // Get single category
  @Get(':id')
  async getSingleCategory(@Param() params: IdDto, @Res() res: Response) {
    const result = await this.categoryService.getSingleCategory(params.id);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Category fetched successfully',
      data: result,
    });
  }

  // Add a Category
  @Post()
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  @UploadInterceptor('file')
  async addCategory(
    @Body('text') text: string,
    @UploadedFile() file: any,
    @Res() res: Response,
  ) {
    // Parse text and transform to DTO instance
    const parsed = JSON.parse(text);
    const createCategoryDto = plainToInstance(CreateCategoryDto, parsed);

    // If file is uploaded, attach URL
    if (file) {
      try {
        const uploaded = await this.lib.uploadToCloudinary({
          fileName: file.filename,
          path: file.path,
        });
        if (uploaded?.secure_url) {
          createCategoryDto.imageUrl = uploaded.secure_url;
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
    const errors = await validate(createCategoryDto);
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

    const result = await this.categoryService.addCategory(createCategoryDto);
    sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Category created successfully',
      data: result,
    });
  }

  // Update a Category
  @Put(':id')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  @UploadInterceptor('file')
  async updateCategory(
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
    const updateCategoryDto = plainToInstance(UpdateCategoryDto, parsed);

    // If file is uploaded, attach URL
    if (file) {
      try {
        const uploaded = await this.lib.uploadToCloudinary({
          fileName: file.filename,
          path: file.path,
        });
        if (uploaded?.secure_url) {
          updateCategoryDto.imageUrl = uploaded.secure_url;
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
    const errors = await validate(updateCategoryDto);
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

    const result = await this.categoryService.updateCategory(updateCategoryDto);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Category updated successfully',
      data: result,
    });
  }

  // Delete a Category
  @Delete(':id')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async deleteCategory(@Param() params: IdDto, @Res() res: Response) {
    const result = await this.categoryService.deleteCategory(params.id);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Category deleted successfully',
      data: result,
    });
  }
}
