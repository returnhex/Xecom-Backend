import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThanaRepository } from './thana.repository';
import { CreateThanaDto, UpdateThanaDto } from './thana.dto';
import calculatePagination from 'src/utils/calculatePagination';

@Injectable()
export class ThanaService {
  constructor(private readonly thanaRepository: ThanaRepository) { }

  // ------------------------------- Add Thana -------------------------------
  public async addThana(createThanaDto: CreateThanaDto) {
    const { name, districtId } = createThanaDto;

    // Check if district exists
    const district = await this.thanaRepository.findDistrictById(districtId);

    if (!district) {
      throw new HttpException('District not found', HttpStatus.NOT_FOUND);
    }

    // Check if thana already exists in this district
    const existingThana = await this.thanaRepository.findByNameAndDistrict(
      name,
      districtId,
    );

    if (existingThana) {
      throw new HttpException(
        'Thana with this name already exists in this district',
        HttpStatus.CONFLICT,
      );
    }

    const thana = await this.thanaRepository.create({
      name,
      district: {
        connect: { id: districtId },
      },
    });

    return thana;
  }

  // ------------------------------- Get All Thanas -------------------------------
  public async getAllThanas(
    pageNumber: number,
    pageSize: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    fields?: string,
    searchTerm?: string,
    countryId?: string,
    divisionId?: string,
    districtId?: string,
  ) {
    const { skip, take } = calculatePagination({
      page: pageNumber,
      take: pageSize,
    });

    const selectedFields = fields
      ? fields.split(',').map((field) => field.trim()).filter(Boolean)
      : undefined;

    const [thanas, total] = await Promise.all([
      this.thanaRepository.findAll(
        skip,
        take,
        sortBy,
        sortOrder,
        selectedFields,
        searchTerm,
        countryId,
        divisionId,
        districtId,
      ),
      this.thanaRepository.count(searchTerm, countryId, divisionId, districtId),
    ]);

    return {
      data: thanas,
      meta: {
        pageNumber,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        totalCount: total,
      },
    };
  }

  // ------------------------------- Update Thana -------------------------------
  public async updateThana(updateThanaDto: UpdateThanaDto) {
    const { id, name, districtId } = updateThanaDto;

    // Check if thana exists
    const existingThana = await this.thanaRepository.findById(id);

    if (!existingThana) {
      throw new HttpException('Thana not found', HttpStatus.NOT_FOUND);
    }

    // Check if district exists (if being changed)
    if (districtId) {
      const district = await this.thanaRepository.findDistrictById(districtId);

      if (!district) {
        throw new HttpException('District not found', HttpStatus.NOT_FOUND);
      }
    }

    // Check if thana name already exists in the district (if being changed)
    if (name || districtId) {
      const targetDistrictId = districtId || existingThana.districtId;
      const targetName = name || existingThana.name;

      const duplicateThana = await this.thanaRepository.findByNameAndDistrict(
        targetName,
        targetDistrictId,
      );

      if (duplicateThana && duplicateThana.id !== id) {
        throw new HttpException(
          'Thana with this name already exists in this district',
          HttpStatus.CONFLICT,
        );
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (districtId) {
      updateData.district = {
        connect: { id: districtId },
      };
    }

    const thana = await this.thanaRepository.update(id, updateData);

    return thana;
  }

  // ------------------------------- Delete Thana -------------------------------
  public async deleteThana(id: string) {
    // Check if thana exists
    const existingThana = await this.thanaRepository.findById(id);

    if (!existingThana) {
      throw new HttpException('Thana not found', HttpStatus.NOT_FOUND);
    }

    // Soft delete the thana
    const thana = await this.thanaRepository.delete(id);

    return thana;
  }
}
