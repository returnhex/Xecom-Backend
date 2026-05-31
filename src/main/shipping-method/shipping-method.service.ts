import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ShippingMethodRepository } from './shipping-method.repository';
import {
    CreateShippingMethodDto,
    UpdateShippingMethodDto,
} from './shipping-method.dto';
import calculatePagination from 'src/utils/calculatePagination';

@Injectable()
export class ShippingMethodService {
    constructor(
        private readonly shippingMethodRepository: ShippingMethodRepository,
    ) { }

    // ------------------------------- Add Shipping Method -------------------------------
    public async addShippingMethod(createShippingMethodDto: CreateShippingMethodDto) {
        const { code, name, description, cost, estimatedDays } =
            createShippingMethodDto;

        const existing = await this.shippingMethodRepository.findByCode(
            code,
        );

        if (existing) {
            throw new HttpException(
                'Shipping method with this code already exists',
                HttpStatus.CONFLICT,
            );
        }

        return this.shippingMethodRepository.create({
            code,
            name,
            description,
            cost,
            estimatedDays,
        });
    }

    // ------------------------------- Get All Shipping Methods -------------------------------
    public async getAllShippingMethods(
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
            ? fields
                .split(',')
                .map((field) => field.trim())
                .filter(Boolean)
            : undefined;

        const [shippingMethods, total] = await Promise.all([
            this.shippingMethodRepository.findAll(
                skip,
                take,
                sortBy,
                sortOrder,
                selectedFields,
                searchTerm,
            ),
            this.shippingMethodRepository.count(searchTerm),
        ]);

        return {
            data: shippingMethods,
            meta: {
                pageNumber,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
                totalCount: total,
            },
        };
    }

    // ------------------------------- Get Single Shipping Method -------------------------------
    public async getSingleShippingMethod(id: string) {
        const shippingMethod =
            await this.shippingMethodRepository.findByIdWithOrderCount(id);

        if (!shippingMethod) {
            throw new HttpException('Shipping method not found', HttpStatus.NOT_FOUND);
        }

        return shippingMethod;
    }

    // ------------------------------- Update Shipping Method -------------------------------
    public async updateShippingMethod(updateShippingMethodDto: UpdateShippingMethodDto) {
        const { id, code, name, description, cost, estimatedDays, isActive } =
            updateShippingMethodDto;

        const existing = await this.shippingMethodRepository.findById(id);

        if (!existing) {
            throw new HttpException('Shipping method not found', HttpStatus.NOT_FOUND);
        }

        if (code && code !== existing.code) {
            const duplicate = await this.shippingMethodRepository.findByCode(
                code,
            );

            if (duplicate && duplicate.id !== id) {
                throw new HttpException(
                    'Shipping method with this code already exists',
                    HttpStatus.CONFLICT,
                );
            }
        }

        return this.shippingMethodRepository.update(id, {
            code,
            name,
            description,
            cost,
            estimatedDays,
            isActive,
        });
    }

    // ------------------------------- Delete Shipping Method -------------------------------
    public async deleteShippingMethod(id: string) {
        const existing = await this.shippingMethodRepository.findById(id);

        if (!existing) {
            throw new HttpException('Shipping method not found', HttpStatus.NOT_FOUND);
        }

        return this.shippingMethodRepository.delete(id);
    }
}
