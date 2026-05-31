import {
    Body,
    Controller,
    Delete,
    Get,
    HttpStatus,
    Param,
    Post,
    Put,
    Query,
    Res,
    UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import sendResponse from 'src/utils/sendResponse';
import { IdDto } from 'src/common/id.dto';
import { AuthGuard } from 'src/guard/auth.guard';
import { RoleGuardWith } from 'src/utils/RoleGuardWith';
import { UserRole } from 'src/generated/prisma';
import { ShippingMethodService } from './shipping-method.service';
import {
    CreateShippingMethodDto,
    UpdateShippingMethodDto,
} from './shipping-method.dto';

@Controller('shipping-method')
export class ShippingMethodController {
    constructor(private readonly shippingMethodService: ShippingMethodService) { }

    // Add Shipping Method
    @Post()
    @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
    async addShippingMethod(
        @Body() createShippingMethodDto: CreateShippingMethodDto,
        @Res() res: Response,
    ) {
        const result = await this.shippingMethodService.addShippingMethod(
            createShippingMethodDto,
        );

        sendResponse(res, {
            statusCode: HttpStatus.CREATED,
            success: true,
            message: 'Shipping method created successfully',
            data: result,
        });
    }

    // Get All Shipping Methods
    @Get()
    async getAllShippingMethods(
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

        const result = await this.shippingMethodService.getAllShippingMethods(
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
            message: 'Shipping methods fetched successfully',
            meta: result.meta,
            data: result.data,
        });
    }

    // Get Single Shipping Method
    @Get(':id')
    async getSingleShippingMethod(@Param() param: IdDto, @Res() res: Response) {
        const result = await this.shippingMethodService.getSingleShippingMethod(
            param.id,
        );

        sendResponse(res, {
            statusCode: HttpStatus.OK,
            success: true,
            message: 'Shipping method fetched successfully',
            data: result,
        });
    }

    // Update Shipping Method
    @Put(':id')
    @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
    async updateShippingMethod(
        @Param() param: IdDto,
        @Body() updateShippingMethodDto: UpdateShippingMethodDto,
        @Res() res: Response,
    ) {
        updateShippingMethodDto.id = param.id;

        const result = await this.shippingMethodService.updateShippingMethod(
            updateShippingMethodDto,
        );

        sendResponse(res, {
            statusCode: HttpStatus.OK,
            success: true,
            message: 'Shipping method updated successfully',
            data: result,
        });
    }

    // Delete Shipping Method
    @Delete(':id')
    @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
    async deleteShippingMethod(@Param() param: IdDto, @Res() res: Response) {
        const result = await this.shippingMethodService.deleteShippingMethod(param.id);

        sendResponse(res, {
            statusCode: HttpStatus.OK,
            success: true,
            message: 'Shipping method deleted successfully',
            data: result,
        });
    }
}
