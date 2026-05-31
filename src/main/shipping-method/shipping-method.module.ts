import { Module } from '@nestjs/common';
import { ShippingMethodService } from './shipping-method.service';
import { ShippingMethodController } from './shipping-method.controller';
import { ShippingMethodRepository } from './shipping-method.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [ShippingMethodController],
    providers: [ShippingMethodService, ShippingMethodRepository],
})
export class ShippingMethodModule { }
