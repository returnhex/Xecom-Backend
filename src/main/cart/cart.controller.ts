import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Put,
  Delete,
  Param,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AuthGuard } from 'src/guard/auth.guard';
import sendResponse from 'src/utils/sendResponse';
import type { Request, Response } from 'express';
import {
  AddToCartDto,
  AddToGuestCartDto,
  GuestCartItemParamsDto,
  GuestTokenDto,
  MergeGuestCartDto,
  UpdateCartItemDto,
} from './cart.dto';
import { IdDto } from 'src/common/id.dto';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // Create guest token for browser localStorage
  @Post('guest/token')
  async createGuestToken(@Res() res: Response) {
    const result = this.cartService.createGuestToken();
    sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Guest token created successfully',
      data: result,
    });
  }

  // Get guest cart items
  @Get('guest/:guestToken')
  async getGuestCartItems(
    @Param() params: GuestTokenDto,
    @Res() res: Response,
  ) {
    const result = await this.cartService.getGuestCartItems(params.guestToken);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Guest cart items fetched successfully',
      data: result,
    });
  }

  // Add to guest cart
  @Post('guest')
  async addToGuestCart(
    @Body() addToGuestCartDto: AddToGuestCartDto,
    @Res() res: Response,
  ) {
    const result = await this.cartService.addToGuestCart(addToGuestCartDto);
    sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Item added to guest cart successfully',
      data: result,
    });
  }

  // Update guest cart item quantity
  @Put('guest/:guestToken/items/:id')
  async updateGuestCartItemQuantity(
    @Param() params: GuestCartItemParamsDto,
    @Body() updateCartItemDto: UpdateCartItemDto,
    @Res() res: Response,
  ) {
    const result = await this.cartService.updateGuestCartItemQuantity(
      params.guestToken,
      params.id,
      updateCartItemDto,
    );
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Guest cart item quantity updated successfully',
      data: result,
    });
  }

  // Delete guest cart item
  @Delete('guest/:guestToken/items/:id')
  async deleteGuestCartItem(
    @Param() params: GuestCartItemParamsDto,
    @Res() res: Response,
  ) {
    const result = await this.cartService.deleteGuestCartItem(
      params.guestToken,
      params.id,
    );
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: result.message,
      data: null,
    });
  }

  // Merge guest cart into authenticated user cart after login
  @Post('merge')
  @UseGuards(AuthGuard)
  async mergeGuestCart(
    @Req() req: Request,
    @Body() mergeGuestCartDto: MergeGuestCartDto,
    @Res() res: Response,
  ) {
    const userId = req.user.id;
    const result = await this.cartService.mergeGuestCart(
      userId,
      mergeGuestCartDto,
    );
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Guest cart merged successfully',
      data: result,
    });
  }

  // Get my cart items
  @Get()
  @UseGuards(AuthGuard)
  async getMyCartItems(@Req() req: Request, @Res() res: Response) {
    const userId = req.user.id;
    const result = await this.cartService.getMyCartItems(userId);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Cart items fetched successfully',
      data: result,
    });
  }

  // Add to cart
  @Post()
  @UseGuards(AuthGuard)
  async addToCart(
    @Req() req: Request,
    @Body() addToCartDto: AddToCartDto,
    @Res() res: Response,
  ) {
    const userId = req.user.id;
    const result = await this.cartService.addToCart(userId, addToCartDto);
    sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Item added to cart successfully',
      data: result,
    });
  }

  // Update cart item quantity
  @Put(':id')
  @UseGuards(AuthGuard)
  async updateCartItemQuantity(
    @Req() req: Request,
    @Param() params: IdDto,
    @Body() updateCartItemDto: UpdateCartItemDto,
    @Res() res: Response,
  ) {
    const userId = req.user.id;
    const result = await this.cartService.updateCartItemQuantity(
      userId,
      params.id,
      updateCartItemDto,
    );
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Cart item quantity updated successfully',
      data: result,
    });
  }

  // Delete cart item
  @Delete(':id')
  @UseGuards(AuthGuard)
  async deleteCartItem(
    @Req() req: Request,
    @Param() params: IdDto,
    @Res() res: Response,
  ) {
    const userId = req.user.id;
    const result = await this.cartService.deleteCartItem(userId, params.id);
    sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: result.message,
      data: null,
    });
  }
}
