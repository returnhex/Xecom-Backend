import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CountryRepository } from './country.repository';
import { CreateCountryDto, UpdateCountryDto } from './country.dto';
import calculatePagination from 'src/utils/calculatePagination';

@Injectable()
export class CountryService {
  constructor(private readonly countryRepository: CountryRepository) { }

  // ------------------------------- Add Country -------------------------------
  public async addCountry(createCountryDto: CreateCountryDto) {
    const { name, code } = createCountryDto;

    // Check if country already exists
    const existingCountry = await this.countryRepository.findByNameOrCode(
      name,
      code,
    );

    if (existingCountry) {
      throw new HttpException(
        'Country with this name or code already exists',
        HttpStatus.CONFLICT,
      );
    }

    const country = await this.countryRepository.create({
      name,
      code,
    });

    return country;
  }

  // ------------------------------- Get All Countries -------------------------------
  public async getAllCountries(
    pageNumber: number,
    pageSize: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    fields?: string,
    searchTerm?: string,
  ) {
    const { skip, take } = calculatePagination({
      page: pageNumber,
      take: pageSize,
    });

    const selectedFields = fields
      ? fields.split(',').map((field) => field.trim()).filter(Boolean)
      : undefined;

    const [countries, total] = await Promise.all([
      this.countryRepository.findAll(
        skip,
        take,
        sortBy,
        sortOrder,
        selectedFields,
        searchTerm,
      ),
      this.countryRepository.count(searchTerm),
    ]);

    return {
      data: countries,
      meta: {
        pageNumber,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        totalCount: total,
      },
    };
  }

  // ------------------------------- Get Single Country -------------------------------
  public async getSingleCountry(id: string) {
    const country = await this.countryRepository.findByIdWithDivisions(id);

    if (!country) {
      throw new HttpException('Country not found', HttpStatus.NOT_FOUND);
    }

    return country;
  }

  // ------------------------------- Update Country -------------------------------
  public async updateCountry(updateCountryDto: UpdateCountryDto) {
    const { id, name, code } = updateCountryDto;

    // Check if country exists
    const existingCountry = await this.countryRepository.findById(id);

    if (!existingCountry) {
      throw new HttpException('Country not found', HttpStatus.NOT_FOUND);
    }

    // Check if name or code already exists (if being changed)
    if (name || code) {
      const duplicateCountry = await this.countryRepository.findByNameOrCode(
        name || existingCountry.name,
        code !== undefined ? code : existingCountry.code ?? undefined,
      );

      if (duplicateCountry && duplicateCountry.id !== id) {
        throw new HttpException(
          'Country with this name or code already exists',
          HttpStatus.CONFLICT,
        );
      }
    }

    const country = await this.countryRepository.update(id, {
      name,
      code,
    });

    return country;
  }

  // ------------------------------- Delete Country -------------------------------
  public async deleteCountry(id: string) {
    // Check if country exists
    const existingCountry = await this.countryRepository.findById(id);

    if (!existingCountry) {
      throw new HttpException('Country not found', HttpStatus.NOT_FOUND);
    }

    // Soft delete the country
    const country = await this.countryRepository.delete(id);

    return country;
  }
}
