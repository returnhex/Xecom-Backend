import {
  Controller,
  Get,
  Put,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Res,
  Req,
  HttpStatus,
  UploadedFile,
} from '@nestjs/common';
import { UserService } from './user.service';
import {
  CreateOrUpdateUserAddressDto,
  ChangeUserStatusDto,
  UpdateMeDto,
} from './user.dto';
import sendResponse from 'src/utils/sendResponse';
import { AuthGuard } from 'src/guard/auth.guard';
import type { Request, Response } from 'express';
import { RoleGuardWith } from 'src/utils/RoleGuardWith';
import { UserRole } from 'src/generated/prisma';
import { IdDto } from 'src/common/id.dto';
import { UploadInterceptor } from 'src/common/upload.interceptor';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LibService } from 'src/lib/lib.service';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly lib: LibService,
  ) { }

  // Get me
  @Get('me')
  @UseGuards(AuthGuard)
  async getUser(@Req() req: Request, @Res() res: Response) {
    const result = await this.userService.getMe(req.user);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User profile fetched Successfully',
      data: result,
    });
  }

  // Update my profile
  @Patch('me')
  @UseGuards(AuthGuard)
  @UploadInterceptor('file')
  async updateMe(
    @Req() req: Request,
    @Body('text') text: string,
    @UploadedFile() file: any,
    @Res() res: Response,
  ) {
    const parsed = text ? JSON.parse(text) : {};
    const updateMeDto = plainToInstance(UpdateMeDto, parsed);

    if (file) {
      try {
        const uploaded = await this.lib.uploadToCloudinary({
          fileName: file.filename,
          path: file.path,
        });
        if (uploaded?.secure_url) {
          updateMeDto.profilePicture = uploaded.secure_url;
        }
      } catch (error: any) {
        console.error('File upload failed:', error);
        return res.status(HttpStatus.REQUEST_TIMEOUT).json({
          success: false,
          statusCode: HttpStatus.REQUEST_TIMEOUT,
          message:
            'File upload failed. Please try again with a smaller file or check your connection.',
          error: error.message || 'Upload timeout',
        });
      }
    }

    const errors = await validate(updateMeDto);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message:
          Object.values(errors[0].constraints || {})[0] || 'Validation failed',
        errorDetails: errors.map((err) => ({
          property: err.property,
          constraints: err.constraints,
        })),
      });
    }

    const result = await this.userService.updateMe(req.user, updateMeDto);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User profile updated successfully',
      data: result,
    });
  }

  // Get all users
  @Get()
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.SUPER_ADMIN]))
  async getAllUsers(
    @Query('pageNumber') pageNumber: string,
    @Query('pageSize') pageSize: string,
    @Query('sortBy') sortBy: string,
    @Query('sortOrder') sortOrder: string,
    @Query('fields') fields: string,
    @Query('gender') gender: string,
    @Query('role') role: string,
    @Query('emailVerified') emailVerified: string,
    @Query('status') status: string,
    @Query('searchTerm') searchTerm: string,
    @Res() res: Response,
  ) {
    const page = parseInt(pageNumber) || 1;
    const size = parseInt(pageSize) || 20;

    const result = await this.userService.getAllUsers(
      page,
      size,
      sortBy,
      sortOrder as 'asc' | 'desc',
      fields,
      gender,
      role,
      emailVerified,
      status,
      searchTerm,
    );
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'All Users fetched Successfully',
      meta: result.meta,
      data: result.data,
    });
  }

  // Get users metadata
  @Get('metadata')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async getUsersMetadata(@Res() res: Response) {
    const result = await this.userService.getUsersMetadata();
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Users metadata fetched successfully',
      data: result,
    });
  }

  // Change User Status
  @Patch('change-status/:id')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async changeUserStatus(
    @Param() param: IdDto,
    @Res() res: Response,
    @Body() changeUserStatusDto: ChangeUserStatusDto,
  ) {
    const result = await this.userService.changeUserStatus(
      param.id,
      changeUserStatusDto.status,
    );
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User status updated successfully',
      data: result,
    });
  }

  // Create or update user address
  @Put('address')
  @UseGuards(AuthGuard)
  async createOrUpdateUserAddress(
    @Req() req: Request,
    @Res() res: Response,
    @Body() createOrUpdateUserAddressDto: CreateOrUpdateUserAddressDto,
  ) {
    const result = await this.userService.createOrUpdateUserAddress(
      req.user,
      createOrUpdateUserAddressDto,
    );
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User address created/updated successfully',
      data: result,
    });
  }

  // Get user addresses
  @Get('address')
  @UseGuards(AuthGuard)
  async getUserAddresses(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.userService.getUserAddresses(req.user);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User addresses fetched successfully',
      data: result,
    });
  }
}
