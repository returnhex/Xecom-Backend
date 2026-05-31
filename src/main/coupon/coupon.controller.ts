import {
    Body,
    Controller,
    Delete,
    Get,
    HttpStatus,
    Param,
    Patch,
    Post,
    Put,
    Query,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import sendResponse from 'src/utils/sendResponse';
import { IdDto } from 'src/common/id.dto';
import { AuthGuard } from 'src/guard/auth.guard';
import { RoleGuardWith } from 'src/utils/RoleGuardWith';
import { UserRole } from 'src/generated/prisma';
import { CouponService } from './coupon.service';
import {
    CreateCouponDto,
    SetCouponActiveDto,
    UpdateCouponDto,
    ValidateCouponDto,
} from './coupon.dto';

@Controller('coupon')
@UseGuards(AuthGuard)
export class CouponController {
    constructor(private readonly couponService: CouponService) { }

    private actor(req: Request) {
        const role = req.user?.role as UserRole;
        const userId = req.user?.id as string | undefined;
        return { role, userId };
    }

    // Add Coupon
    @Post()
    @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
    async addCoupon(
        @Body() createCouponDto: CreateCouponDto,
        @Res() res: Response,
    ) {
        const result = await this.couponService.addCoupon(createCouponDto);

        sendResponse(res, {
            statusCode: HttpStatus.CREATED,
            success: true,
            message: 'Coupon created successfully',
            data: result,
        });
    }

    // Get All Coupons
    @Get()
    async getAllCoupons(
        @Query('pageNumber') pageNumber: string,
        @Query('pageSize') pageSize: string,
        @Query('sortBy') sortBy: string,
        @Query('sortOrder') sortOrder: string,
        @Query('fields') fields: string,
        @Query('searchTerm') searchTerm: string,
        @Query('active') active: string,
        @Res() res: Response,
    ) {
        const page = parseInt(pageNumber) || 1;
        const size = parseInt(pageSize) || 20;

        const result = await this.couponService.getAllCoupons(
            page,
            size,
            sortBy,
            sortOrder as 'asc' | 'desc',
            fields,
            searchTerm,
            active,
        );

        sendResponse(res, {
            statusCode: HttpStatus.OK,
            success: true,
            message: 'Coupons fetched successfully',
            meta: result.meta,
            data: result.data,
        });
    }

    // Get Coupon by Code
    @Get('code/:code')
    async getCouponByCode(
        @Param('code') code: string,
        @Res() res: Response,
    ) {
        const result = await this.couponService.getCouponByCode(code);

        sendResponse(res, {
            statusCode: HttpStatus.OK,
            success: true,
            message: 'Coupon fetched successfully',
            data: result,
        });
    }

    // Validate Coupon (for checkout)
    @Post('validate')
    async validateCoupon(
        @Req() req: Request,
        @Body() validateCouponDto: ValidateCouponDto,
        @Res() res: Response,
    ) {
        const actor = this.actor(req);
        const result = await this.couponService.validateCoupon(
            validateCouponDto,
            actor.userId,
        );

        sendResponse(res, {
            statusCode: HttpStatus.OK,
            success: true,
            message: 'Coupon is valid',
            data: result,
        });
    }

    // Get Single Coupon
    @Get(':id')
    async getSingleCoupon(
        @Param() param: IdDto,
        @Res() res: Response,
    ) {
        const result = await this.couponService.getSingleCoupon(param.id);
        sendResponse(res, {
            statusCode: HttpStatus.OK,
            success: true,
            message: 'Coupon fetched successfully',
            data: result,
        });
    }

    // Update Coupon
    @Put(':id')
    @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
    async updateCoupon(
        @Param() param: IdDto,
        @Body() updateCouponDto: UpdateCouponDto,
        @Res() res: Response,
    ) {
        updateCouponDto.id = param.id;
        const result = await this.couponService.updateCoupon(updateCouponDto);
        sendResponse(res, {
            statusCode: HttpStatus.OK,
            success: true,
            message: 'Coupon updated successfully',
            data: result,
        });
    }

    // Activate/Deactivate Coupon
    @Patch(':id/active')
    @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
    async setCouponActive(
        @Param() param: IdDto,
        @Body() setCouponActiveDto: SetCouponActiveDto,
        @Res() res: Response,
    ) {
        const result = await this.couponService.setCouponActive(
            param.id,
            setCouponActiveDto,
        );
        sendResponse(res, {
            statusCode: HttpStatus.OK,
            success: true,
            message: 'Coupon status updated successfully',
            data: result,
        });
    }

    // Delete Coupon
    @Delete(':id')
    @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
    async deleteCoupon(
        @Param() param: IdDto,
        @Res() res: Response,
    ) {
        const result = await this.couponService.deleteCoupon(param.id);
        sendResponse(res, {
            statusCode: HttpStatus.OK,
            success: true,
            message: 'Coupon deleted successfully',
            data: result,
        });
    }
}
