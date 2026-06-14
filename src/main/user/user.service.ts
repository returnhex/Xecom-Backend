import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { TUser } from 'src/interface/token.type';
import {
  Admin,
  Customer,
  Staff,
  UserRole,
  UserStatus,
} from 'src/generated/prisma';
import calculatePagination from 'src/utils/calculatePagination';
import { CreateOrUpdateUserAddressDto, UpdateMeDto } from './user.dto';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) { }

  private mapAddressToResponse(address: any) {
    return {
      addressId: address.id,
      street: address.street,
      postalCode: address.postalCode,
      isDefault: address.isDefault,
      thanaId: address.thanaId,
      thanaName: address.thana.name,
      districtId: address.thana.districtId,
      districtName: address.thana.district.name,
      divisionId: address.thana.district.divisionId,
      divisionName: address.thana.district.division.name,
      countryId: address.thana.district.division.countryId,
      countryName: address.thana.district.division.country.name,
    };
  }

  // ------------------------------- Get Me -------------------------------
  public async getMe(user: TUser) {
    let result: Admin | Customer | Staff | null;
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.CUSTOMER &&
      user.role !== UserRole.STAFF &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      throw new HttpException(
        'Invalid User role provided',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (user.role == UserRole.ADMIN || user.role == UserRole.SUPER_ADMIN) {
      result = await this.userRepository.findAdminByUserId(user.id);
    } else if (user.role == UserRole.CUSTOMER) {
      result = await this.userRepository.findCustomerByUserId(user.id);
    } else if (user.role == UserRole.STAFF) {
      result = await this.userRepository.findStaffByUserId(user.id);
    } else result = null;
    return result;
  }

  // ------------------------------- Get All Users -------------------------------
  public async getAllUsers(
    pageNumber: number,
    pageSize: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    fields?: string,
    gender?: string,
    role?: string,
    emailVerified?: string,
    status?: string,
    searchTerm?: string,
  ) {
    const { skip, take } = calculatePagination({
      page: pageNumber,
      take: pageSize,
    });

    // Parse fields string into array
    const selectedFields = fields
      ? fields.split(',').map((field) => field.trim())
      : undefined;

    const [users, total] = await Promise.all([
      this.userRepository.findAll(
        skip,
        take,
        sortBy,
        sortOrder,
        selectedFields,
        gender,
        role,
        emailVerified,
        status,
        searchTerm,
      ),
      this.userRepository.count(gender, role, emailVerified, status, searchTerm),
    ]);

    return {
      data: users,
      meta: {
        pageNumber,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        totalCount: total,
      },
    };
  }

  // ------------------------------- Change User Status -------------------------------
  public async changeUserStatus(id: string, status: UserStatus) {
    const existingUser = await this.userRepository.findById(id);
    if (!existingUser)
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    const updatedUser = await this.userRepository.updateStatus(id, status);
    return updatedUser;
  }

  // ------------------------------- Get Users Metadata -------------------------------
  public async getUsersMetadata() {
    const [totalUsers, totalActiveUsers, totalInactiveUsers, totalVerifiedAccounts] =
      await Promise.all([
        this.userRepository.countTotal(),
        this.userRepository.countByStatus(UserStatus.ACTIVE),
        this.userRepository.countByStatusNot(UserStatus.ACTIVE),
        this.userRepository.countVerified(),
      ]);

    return {
      totalUsers,
      totalActiveUsers,
      totalInactiveUsers,
      totalVerifiedAccounts,
    };
  }

  // ------------------------------- Update Me -------------------------------
  public async updateMe(requester: TUser, payload: UpdateMeDto) {
    const existingUser = await this.userRepository.findById(requester.id);
    if (!existingUser) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const updated = await this.userRepository.updateMe(requester.id, {
      name: payload.name,
      phoneNumber: payload.phoneNumber,
      profilePicture: payload.profilePicture,
    });

    return updated;
  }

  // ------------------------------- Address -------------------------------
  public async createOrUpdateUserAddress(
    requester: TUser,
    payload: CreateOrUpdateUserAddressDto,
  ) {
    const existingUser = await this.userRepository.findById(requester.id);
    if (!existingUser) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const existingThana = await this.userRepository.findThanaById(payload.thanaId);
    if (!existingThana) {
      throw new HttpException('Thana not found', HttpStatus.NOT_FOUND);
    }

    const createdOrUpdated =
      await this.userRepository.createOrUpdateAddressByUserAndThana({
        userId: requester.id,
        thanaId: payload.thanaId,
        postalCode: payload.postalCode,
        street: payload.street,
        isDefault: payload.isDefault,
      });

    return this.mapAddressToResponse(createdOrUpdated);
  }

  public async getUserAddresses(requester: TUser) {

    const existingUser = await this.userRepository.findById(requester.id);
    if (!existingUser) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const addresses = await this.userRepository.findAddressesByUserId(requester.id);
    return addresses.map((a) => this.mapAddressToResponse(a));
  }

  /*
  Make registration for three roles seperately on their own modules. No common endpoint like register user

    1. Register customer - access open. flexible dto with  lot of optional field
    2. Register stuff - can be accessed by sup, and admin. a bit rigid dto with some fields to fill up
    3. Register admin - can be accessed by sup. Rigid dto
  */
}
