import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from 'src/guard/auth.guard';
import sendResponse from 'src/utils/sendResponse';
import type { Response } from 'express';
import { UploadInterceptor } from 'src/common/upload.interceptor';
import { plainToInstance } from 'class-transformer';
import { LibService } from 'src/lib/lib.service';
import { validate } from 'class-validator';
import { CreateAdminDto } from './admin.dto';
import { RoleGuardWith } from 'src/utils/RoleGuardWith';
import { UserRole } from 'src/generated/prisma';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly lib: LibService,
  ) { }

  // Get all admins
  @Get()
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.SUPER_ADMIN]))
  async getAllAdmins(@Res() res: Response) {
    const result = await this.adminService.getAllAdmins();
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'All Admin profiles fetched Successfully',
      data: result,
    });
  }

  // Add an Admin
  @Post('register')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.SUPER_ADMIN]))
  @UploadInterceptor('file')
  async registerAdmin(
    @Body('text') text: string,
    @UploadedFile() file: any,
    @Res() res: Response,
  ) {
    // Parse text and transform to DTO instance
    const parsed = JSON.parse(text);
    const createAdminDto = plainToInstance(CreateAdminDto, parsed);

    // If file is uploaded, attach URL
    if (file) {
      try {
        const uploaded = await this.lib.uploadToCloudinary({
          fileName: file.filename,
          path: file.path,
        });
        if (uploaded?.secure_url) {
          createAdminDto.profilePicture = uploaded.secure_url;
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

    // Validate the parsed DTO manually
    const errors = await validate(createAdminDto);
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
    const result = await this.adminService.addAnAdmin(createAdminDto);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Admin registered successfully!',
      data: result,
    });
  }
}
