import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ThanaService } from './thana.service';
import { CreateThanaDto, UpdateThanaDto } from './thana.dto';
import sendResponse from 'src/utils/sendResponse';
import type { Response } from 'express';
import { IdDto } from 'src/common/id.dto';
import { AuthGuard } from 'src/guard/auth.guard';
import { RoleGuardWith } from 'src/utils/RoleGuardWith';
import { UserRole } from 'src/generated/prisma';

@Controller('thana')
export class ThanaController {
  constructor(private readonly thanaService: ThanaService) { }

  // Add Thana
  @Post()
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async addThana(@Body() dto: CreateThanaDto, @Res() res: Response) {
    const result = await this.thanaService.addThana(dto);
    sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Thana created successfully',
      data: result,
    });
  }

  // Get All Thanas
  @Get()
  async getAllThanas(
    @Query('pageNumber') pageNumber: string,
    @Query('pageSize') pageSize: string,
    @Query('sortBy') sortBy: string,
    @Query('sortOrder') sortOrder: string,
    @Query('fields') fields: string,
    @Query('searchTerm') searchTerm: string,
    @Query('countryId') countryId: string,
    @Query('divisionId') divisionId: string,
    @Query('districtId') districtId: string,
    @Res() res: Response,
  ) {
    const page = parseInt(pageNumber) || 1;
    const size = parseInt(pageSize) || 20;

    const result = await this.thanaService.getAllThanas(
      page,
      size,
      sortBy,
      sortOrder as 'asc' | 'desc',
      fields,
      searchTerm,
      countryId,
      divisionId,
      districtId,
    );
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Thanas fetched successfully',
      meta: result.meta,
      data: result.data,
    });
  }

  // Update Thana
  @Put(':id')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async updateThana(
    @Param() param: IdDto,
    @Body() updateThanaDto: UpdateThanaDto,
    @Res() res: Response,
  ) {
    updateThanaDto.id = param.id;
    const result = await this.thanaService.updateThana(updateThanaDto);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Thana updated successfully',
      data: result,
    });
  }

  // Delete Thana
  @Delete(':id')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async deleteThana(@Param() param: IdDto, @Res() res: Response) {
    const result = await this.thanaService.deleteThana(param.id);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Thana deleted successfully',
      data: result,
    });
  }
}
