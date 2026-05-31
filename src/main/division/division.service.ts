import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DivisionRepository } from './division.repository';
import { CreateDivisionDto, UpdateDivisionDto } from './division.dto';
import calculatePagination from 'src/utils/calculatePagination';

@Injectable()
export class DivisionService {
  constructor(private readonly divisionRepository: DivisionRepository) { }

  // ------------------------------- Add Division -------------------------------
  public async addDivision(createDivisionDto: CreateDivisionDto) {
    const { name, countryId } = createDivisionDto;

    // Check if country exists
    const country = await this.divisionRepository.findCountryById(countryId);

    if (!country) {
      throw new HttpException('Country not found', HttpStatus.NOT_FOUND);
    }

    // Check if division already exists in this country
    const existingDivision = await this.divisionRepository.findByNameAndCountry(
      name,
      countryId,
    );

    if (existingDivision) {
      throw new HttpException(
        'Division with this name already exists in this country',
        HttpStatus.CONFLICT,
      );
    }

    const division = await this.divisionRepository.create({
      name,
      country: {
        connect: { id: countryId },
      },
    });

    return division;
  }

  // ------------------------------- Get All Divisions -------------------------------
  public async getAllDivisions(
    pageNumber: number,
    pageSize: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    fields?: string,
    searchTerm?: string,
    countryId?: string,
  ) {
    const { skip, take } = calculatePagination({
      page: pageNumber,
      take: pageSize,
    });

    const selectedFields = fields
      ? fields.split(',').map((field) => field.trim()).filter(Boolean)
      : undefined;

    const [divisions, total] = await Promise.all([
      this.divisionRepository.findAll(
        skip,
        take,
        sortBy,
        sortOrder,
        selectedFields,
        searchTerm,
        countryId,
      ),
      this.divisionRepository.count(searchTerm, countryId),
    ]);

    return {
      data: divisions,
      meta: {
        pageNumber,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        totalCount: total,
      },
    };
  }

  // ------------------------------- Get Single Division -------------------------------
  public async getSingleDivision(id: string) {
    const division = await this.divisionRepository.findByIdWithRelations(id);

    if (!division) {
      throw new HttpException('Division not found', HttpStatus.NOT_FOUND);
    }

    return division;
  }

  // ------------------------------- Update Division -------------------------------
  public async updateDivision(updateDivisionDto: UpdateDivisionDto) {
    const { id, name, countryId } = updateDivisionDto;

    // Check if division exists
    const existingDivision = await this.divisionRepository.findById(id);

    if (!existingDivision) {
      throw new HttpException('Division not found', HttpStatus.NOT_FOUND);
    }

    // Check if country exists (if being changed)
    if (countryId) {
      const country = await this.divisionRepository.findCountryById(countryId);

      if (!country) {
        throw new HttpException('Country not found', HttpStatus.NOT_FOUND);
      }
    }

    // Check if division name already exists in the country (if being changed)
    if (name || countryId) {
      const targetCountryId = countryId || existingDivision.countryId;
      const targetName = name || existingDivision.name;

      const duplicateDivision =
        await this.divisionRepository.findByNameAndCountry(
          targetName,
          targetCountryId,
        );

      if (duplicateDivision && duplicateDivision.id !== id) {
        throw new HttpException(
          'Division with this name already exists in this country',
          HttpStatus.CONFLICT,
        );
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (countryId) {
      updateData.country = {
        connect: { id: countryId },
      };
    }

    const division = await this.divisionRepository.update(id, updateData);

    return division;
  }

  // ------------------------------- Delete Division -------------------------------
  public async deleteDivision(id: string) {
    // Check if division exists
    const existingDivision = await this.divisionRepository.findById(id);

    if (!existingDivision) {
      throw new HttpException('Division not found', HttpStatus.NOT_FOUND);
    }

    // Soft delete the division
    const division = await this.divisionRepository.delete(id);

    return division;
  }
}
