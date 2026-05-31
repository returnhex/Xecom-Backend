import { Test, TestingModule } from '@nestjs/testing';
import { CouponService } from './coupon.service';
import { CouponRepository } from './coupon.repository';
import { PrismaService } from 'src/prisma/prisma.service';

describe('CouponService', () => {
  let service: CouponService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponService,
        {
          provide: CouponRepository,
          useValue: {
            findByCode: jest.fn(),
            findByCodeAny: jest.fn(),
            create: jest.fn(),
            findAll: jest.fn(),
            count: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            incrementUsageCount: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            customer: {
              findUnique: jest.fn(),
            },
            order: {
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CouponService>(CouponService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
