import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { LibModule } from './lib/lib.module';
import { UserModule } from './main/user/user.module';
import { AuthModule } from './main/auth/auth.module';
import { AdminModule } from './main/admin/admin.module';
import { StaffModule } from './main/staff/staff.module';
import { CustomerModule } from './main/customer/customer.module';
import { CountryModule } from './main/country/country.module';
import { DivisionModule } from './main/division/division.module';
import { DistrictModule } from './main/district/district.module';
import { ThanaModule } from './main/thana/thana.module';
import { CategoryModule } from './main/category/category.module';
import { BrandModule } from './main/brand/brand.module';
import { ProductModule } from './main/product/product.module';
import { ProductRelationModule } from './main/product-relation/product-relation.module';
import { AttributeModule } from './main/attribute/attribute.module';
import { ProductVariantModule } from './main/product-variant/product-variant.module';
import { WishlistModule } from './main/wishlist/wishlist.module';
import { ReviewModule } from './main/review/review.module';
import { CartModule } from './main/cart/cart.module';
import { OrderModule } from './main/order/order.module';
import { CouponModule } from './main/coupon/coupon.module';
import { ShippingMethodModule } from './main/shipping-method/shipping-method.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LibModule,
    PrismaModule,
    UserModule,
    AuthModule,
    AdminModule,
    StaffModule,
    CustomerModule,
    CountryModule,
    DivisionModule,
    DistrictModule,
    ThanaModule,
    CategoryModule,
    BrandModule,
    ProductModule,
    ProductRelationModule,
    AttributeModule,
    ProductVariantModule,
    WishlistModule,
    ReviewModule,
    CartModule,
    OrderModule,
    CouponModule,
    ShippingMethodModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
