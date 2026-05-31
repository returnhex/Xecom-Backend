import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DistrictRepository } from './district.repository';
import { CreateDistrictDto, UpdateDistrictDto } from './district.dto';
import calculatePagination from 'src/utils/calculatePagination';

@Injectable()
export class DistrictService {
  constructor(private readonly districtRepository: DistrictRepository) { }

  // ------------------------------- Add District -------------------------------
  public async addDistrict(createDistrictDto: CreateDistrictDto) {
    const { name, divisionId } = createDistrictDto;

    // Check if division exists
    const division = await this.districtRepository.findDivisionById(divisionId);

    if (!division) {
      throw new HttpException('Division not found', HttpStatus.NOT_FOUND);
    }

    // Check if district already exists in this division
    const existingDistrict =
      await this.districtRepository.findByNameAndDivision(name, divisionId);

    if (existingDistrict) {
      throw new HttpException(
        'District with this name already exists in this division',
        HttpStatus.CONFLICT,
      );
    }

    const district = await this.districtRepository.create({
      name,
      division: {
        connect: { id: divisionId },
      },
    });

    return district;
  }

  // ------------------------------- Get All Districts -------------------------------
  public async getAllDistricts(
    pageNumber: number,
    pageSize: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    fields?: string,
    searchTerm?: string,
    countryId?: string,
    divisionId?: string,
  ) {
    const { skip, take } = calculatePagination({
      page: pageNumber,
      take: pageSize,
    });

    const selectedFields = fields
      ? fields.split(',').map((field) => field.trim()).filter(Boolean)
      : undefined;

    const [districts, total] = await Promise.all([
      this.districtRepository.findAll(
        skip,
        take,
        sortBy,
        sortOrder,
        selectedFields,
        searchTerm,
        countryId,
        divisionId,
      ),
      this.districtRepository.count(searchTerm, countryId, divisionId),
    ]);

    return {
      data: districts,
      meta: {
        pageNumber,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        totalCount: total,
      },
    };
  }

  // ------------------------------- Get Single District -------------------------------
  public async getSingleDistrict(id: string) {
    const district = await this.districtRepository.findByIdWithRelations(id);

    if (!district) {
      throw new HttpException('District not found', HttpStatus.NOT_FOUND);
    }

    return district;
  }

  // ------------------------------- Update District -------------------------------
  public async updateDistrict(updateDistrictDto: UpdateDistrictDto) {
    const { id, name, divisionId } = updateDistrictDto;

    // Check if district exists
    const existingDistrict = await this.districtRepository.findById(id);

    if (!existingDistrict) {
      throw new HttpException('District not found', HttpStatus.NOT_FOUND);
    }

    // Check if division exists (if being changed)
    if (divisionId) {
      const division = await this.districtRepository.findDivisionById(divisionId);

      if (!division) {
        throw new HttpException('Division not found', HttpStatus.NOT_FOUND);
      }
    }

    // Check if district name already exists in the division (if being changed)
    if (name || divisionId) {
      const targetDivisionId = divisionId || existingDistrict.divisionId;
      const targetName = name || existingDistrict.name;

      const duplicateDistrict =
        await this.districtRepository.findByNameAndDivision(
          targetName,
          targetDivisionId,
        );

      if (duplicateDistrict && duplicateDistrict.id !== id) {
        throw new HttpException(
          'District with this name already exists in this division',
          HttpStatus.CONFLICT,
        );
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (divisionId) {
      updateData.division = {
        connect: { id: divisionId },
      };
    }

    const district = await this.districtRepository.update(id, updateData);

    return district;
  }

  // ------------------------------- Delete District -------------------------------
  public async deleteDistrict(id: string) {
    // Check if district exists
    const existingDistrict = await this.districtRepository.findById(id);

    if (!existingDistrict) {
      throw new HttpException('District not found', HttpStatus.NOT_FOUND);
    }

    // Soft delete the district
    const district = await this.districtRepository.delete(id);

    return district;
  }
}
