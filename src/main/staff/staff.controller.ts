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
import { StaffService } from './staff.service';
import { AuthGuard } from 'src/guard/auth.guard';
import sendResponse from 'src/utils/sendResponse';
import type { Response } from 'express';
import { UploadInterceptor } from 'src/common/upload.interceptor';
import { plainToInstance } from 'class-transformer';
import { LibService } from 'src/lib/lib.service';
import { validate } from 'class-validator';
import { CreateStaffDto } from './staff.dto';
import { RoleGuardWith } from 'src/utils/RoleGuardWith';
import { UserRole } from 'src/generated/prisma';

@Controller('staff')
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly lib: LibService,
  ) {}

  // Get all staffs
  @Get()
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  async getAllStaffs(@Res() res: Response) {
    const result = await this.staffService.getAllStaffs();
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'All Staff profiles fetched Successfully',
      data: result,
    });
  }

  // Add a Staff
  @Post('register')
  @UseGuards(AuthGuard, RoleGuardWith([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
  @UploadInterceptor('file')
  async registerStaff(
    @Body('text') text: string,
    @UploadedFile() file: any,
    @Res() res: Response,
  ) {
    // Parse text and transform to DTO instance
    const parsed = JSON.parse(text);
    const createStaffDto = plainToInstance(CreateStaffDto, parsed);

    // If file is uploaded, attach URL
    if (file) {
      try {
        const uploaded = await this.lib.uploadToCloudinary({
          fileName: file.filename,
          path: file.path,
        });
        if (uploaded?.secure_url) {
          createStaffDto.profilePicture = uploaded.secure_url;
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
    const errors = await validate(createStaffDto);
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
    const result = await this.staffService.addAStaff(createStaffDto);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Staff registered successfully!',
      data: result,
    });
  }
}
