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
import { CountryService } from './country.service';
import { CreateCountryDto, UpdateCountryDto } from './country.dto';
import sendResponse from 'src/utils/sendResponse';
import type { Response } from 'express';
import { IdDto } from 'src/common/id.dto';
import { AuthGuard } from 'src/guard/auth.guard';
import { RoleGuardWith } from 'src/utils/RoleGuardWith';
import { UserRole } from 'src/generated/prisma';

@Controller('country')
export class CountryController {
  constructor(private readonly countryService: CountryService) { }

  // Add Country
  @Post()
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async addCountry(
    @Body() createCountryDto: CreateCountryDto,
    @Res() res: Response,
  ) {
    const result = await this.countryService.addCountry(createCountryDto);
    sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Country created successfully',
      data: result,
    });
  }

  // Get All Countries
  @Get()
  async getAllCountries(
    @Query('pageNumber') pageNumber: string,
    @Query('pageSize') pageSize: string,
    @Query('sortBy') sortBy: string,
    @Query('sortOrder') sortOrder: string,
    @Query('fields') fields: string,
    @Query('searchTerm') searchTerm: string,
    @Res() res: Response,
  ) {
    const page = parseInt(pageNumber) || 1;
    const size = parseInt(pageSize) || 20;

    const result = await this.countryService.getAllCountries(
      page,
      size,
      sortBy,
      sortOrder as 'asc' | 'desc',
      fields,
      searchTerm,
    );
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Countries fetched successfully',
      meta: result.meta,
      data: result.data,
    });
  }

  // Get Single Country
  @Get(':id')
  async getSingleCountry(@Param() param: IdDto, @Res() res: Response) {
    const result = await this.countryService.getSingleCountry(param.id);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Country fetched successfully',
      data: result,
    });
  }

  // Update Country
  @Put(':id')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async updateCountry(
    @Param() param: IdDto,
    @Body() updateCountryDto: UpdateCountryDto,
    @Res() res: Response,
  ) {
    updateCountryDto.id = param.id;
    const result = await this.countryService.updateCountry(updateCountryDto);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Country updated successfully',
      data: result,
    });
  }

  // Delete Country
  @Delete(':id')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async deleteCountry(@Param() param: IdDto, @Res() res: Response) {
    const result = await this.countryService.deleteCountry(param.id);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Country deleted successfully',
      data: result,
    });
  }
}
