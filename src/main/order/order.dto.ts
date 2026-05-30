import { IsString, IsUUID, IsOptional, IsEnum, IsNumber, Min, IsBoolean } from 'class-validator';
import { OrderStatus } from 'src/generated/prisma';

export class PlaceOrderDto {
    // Option 1: Use existing address
    @IsOptional()
    @IsUUID()
    addressId?: string;

    // Option 2: Create new address (required if addressId not provided)
    @IsOptional()
    @IsString()
    street?: string;

    @IsOptional()
    postalCode?: number;

    @IsOptional()
    @IsUUID()
    thanaId?: string;

    @IsOptional()
    @IsBoolean()
    saveAddress?: boolean; // Save address to user's address book

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsString()
    couponCode?: string;
}

export class UpdateOrderStatusDto {
    @IsEnum(OrderStatus)
    status!: OrderStatus;

    @IsOptional()
    @IsString()
    internalNotes?: string;
}
