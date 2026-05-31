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
import { DivisionService } from './division.service';
import { CreateDivisionDto, UpdateDivisionDto } from './division.dto';
import sendResponse from 'src/utils/sendResponse';
import type { Response } from 'express';
import { IdDto } from 'src/common/id.dto';
import { AuthGuard } from 'src/guard/auth.guard';
import { RoleGuardWith } from 'src/utils/RoleGuardWith';
import { UserRole } from 'src/generated/prisma';

@Controller('division')
export class DivisionController {
  constructor(private readonly divisionService: DivisionService) { }

  // Add Division
  @Post()
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async addDivision(@Body() dto: CreateDivisionDto, @Res() res: Response) {
    const result = await this.divisionService.addDivision(dto);
    sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Division created successfully',
      data: result,
    });
  }

  // Get All Divisions
  @Get()
  async getAllDivisions(
    @Query('pageNumber') pageNumber: string,
    @Query('pageSize') pageSize: string,
    @Query('sortBy') sortBy: string,
    @Query('sortOrder') sortOrder: string,
    @Query('fields') fields: string,
    @Query('searchTerm') searchTerm: string,
    @Query('countryId') countryId: string,
    @Res() res: Response,
  ) {
    const page = parseInt(pageNumber) || 1;
    const size = parseInt(pageSize) || 20;

    const result = await this.divisionService.getAllDivisions(
      page,
      size,
      sortBy,
      sortOrder as 'asc' | 'desc',
      fields,
      searchTerm,
      countryId,
    );
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Divisions fetched successfully',
      meta: result.meta,
      data: result.data,
    });
  }

  // Get Single Division
  @Get(':id')
  async getSingleDivision(@Param() param: IdDto, @Res() res: Response) {
    const result = await this.divisionService.getSingleDivision(param.id);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Division fetched successfully',
      data: result,
    });
  }

  // Update Division
  @Put(':id')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async updateDivision(
    @Param() param: IdDto,
    @Body() updateDivisionDto: UpdateDivisionDto,
    @Res() res: Response,
  ) {
    updateDivisionDto.id = param.id;
    const result = await this.divisionService.updateDivision(updateDivisionDto);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Division updated successfully',
      data: result,
    });
  }

  // Delete Division
  @Delete(':id')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async deleteDivision(@Param() param: IdDto, @Res() res: Response) {
    const result = await this.divisionService.deleteDivision(param.id);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Division deleted successfully',
      data: result,
    });
  }
}
