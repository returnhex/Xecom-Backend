import { Test, TestingModule } from '@nestjs/testing';
import { ShippingMethodController } from './shipping-method.controller';
import { ShippingMethodService } from './shipping-method.service';

describe('ShippingMethodController', () => {
    let controller: ShippingMethodController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ShippingMethodController],
            providers: [ShippingMethodService],
        }).compile();

        controller = module.get<ShippingMethodController>(ShippingMethodController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
