import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, UserStatus } from 'src/generated/prisma';
import { ChangePasswordDto } from './auth.dto';
import { MailerService } from 'src/utils/sendMail';
import { TUser } from 'src/interface/token.type';
import { AuthRepository } from './auth.repository';
import { LibService } from 'src/lib/lib.service';

@Injectable()
export class AuthService {
  constructor(
    private authRepository: AuthRepository,
    private jwtService: JwtService,
    private lib: LibService,
    private configService: ConfigService,
    private mailerService: MailerService,
  ) { }

  // Login
  public async loginUser(data: { email: string; password: string }) {
    const { email, password } = data;
    const user = await this.authRepository.findUserByEmail(email);

    if (!user) throw new HttpException('User not found', 401);
    if (user.provider === AuthProvider.GOOGLE) {
      throw new HttpException(
        'This account is registered with Google. Please try to login with Google.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (user.status === UserStatus.BLOCKED) {
      throw new HttpException('This user is blocked!', HttpStatus.FORBIDDEN);
    }

    if (!user.password) {
      throw new HttpException('Password not set for this user. Please use Google login.', HttpStatus.BAD_REQUEST);
    }
    const isCorrectPassword = await this.lib.comparePassword({
      password,
      hashedPassword: user.password,
    });

    if (!isCorrectPassword) throw new HttpException('Invalid credentials', 401);

    return this.generateTokens(user);
  }

  public async googleLogin(data: {
    email: string;
    name: string;
    profilePicture: string;
  }) {
    let user = await this.authRepository.findUserByEmail(data.email);

    if (user) {
      if (user.provider === AuthProvider.EMAIL_PASSWORD) {
        throw new HttpException(
          'This account is registered with email and password. Please try email/password login.',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (user.status === UserStatus.BLOCKED) {
        throw new HttpException('This user is blocked!', HttpStatus.FORBIDDEN);
      }
    } else {
      user = await this.authRepository.createGoogleUser(data);
    }

    return this.generateTokens(user);
  }

  private generateTokens(user: {
    email: string;
    role: string;
    id: string;
  }) {

    const payload = { email: user.email, role: user.role, id: user.id };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow('ACCESS_SECRET'),
      expiresIn: this.configService.getOrThrow('ACCESS_SECRET_EXPIRES_IN'),
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow('REFRESH_SECRET'),
      expiresIn: this.configService.getOrThrow('REFRESH_SECRET_EXPIRES_IN'),
    });
    return {
      accessToken,
      refreshToken,
    };
  }

  // Refresh Token
  public async refreshToken(token: string) {
    // Verify the refresh token
    let decoded: any;
    try {
      decoded = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow('REFRESH_SECRET'),
      });
    } catch (error: any) {
      throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }

    // Check if the user exists
    const user = await this.authRepository.findUserById(decoded.id);

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Check if the user is blocked
    if (user.status === UserStatus.BLOCKED) {
      throw new HttpException('This user is blocked!', HttpStatus.FORBIDDEN);
    }

    // Generate new access token
    const payload = { email: user.email, role: user.role, id: user.id };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow('ACCESS_SECRET'),
      expiresIn: this.configService.getOrThrow('ACCESS_SECRET_EXPIRES_IN'),
    });

    return {
      accessToken,
    };
  }

  // ----------------------------------------------Change Password-------------------------------------------------
  public async changePassword(user: TUser, payload: ChangePasswordDto) {
    const userData = await this.authRepository.findActiveUserByEmailOrThrow(
      user?.email,
    );

    const isCorrectPassword = await this.lib.comparePassword({
      password: payload.password,
      hashedPassword: userData.password as string,
    });

    if (!isCorrectPassword) {
      throw new HttpException('Password is incorrect', HttpStatus.BAD_REQUEST);
    }

    const hashedPassword: string = await this.lib.hashPassword({
      password: payload.newPassword,
    });

    // Update operation
    await this.authRepository.updateUserByEmail(userData?.email, {
      password: hashedPassword,
    });
    return null;
  }

  // ---------------------------------------------------Forgot Password-------------------------------------------------
  async forgotPassword(email: string) {
    const user = await this.authRepository.findActiveUserByEmail(email);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    const payload = { email: user.email, role: user.role, id: user.id };
    const token = this.jwtService.sign(payload, {
      secret: this.configService.get('ACCESS_SECRET'),
      expiresIn: this.configService.get('ACCESS_SECRET_EXPIRES_IN'),
    });
    const resetPassLink = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`;
    await this.mailerService.sendMail(
      user.email,
      `<div>
          <p>Dear User,</p>
          <p>Click on this Button to reset your password. Link expires in 10 minutes.</p> 
          <p>
              <a href="${resetPassLink}">
                  <button>
                      Reset Password
                  </button>
              </a>
          </p>
      </div>`,
      'Reset Password Link 🔗',
      'Click on the link to reset your password. Link expires in 10 minutes.',
    );
    return null;
  }

  public async resetPassword(payload: { newPassword: string }, token: string) {
    // 1. Decode token
    const decoded: any = this.jwtService.verify(token, {
      secret: this.configService.get('ACCESS_SECRET'),
    });

    // 2. Fetch user
    const user = await this.authRepository.findUserById(decoded.id);

    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    if (user.status === UserStatus.BLOCKED) {
      throw new HttpException('This user is blocked!', HttpStatus.FORBIDDEN);
    }

    // 3. Hash new password
    const newHashedPassword = await this.lib.hashPassword({
      password: payload.newPassword,
    });

    // 4. Update user
    await this.authRepository.updateUser(user.id, {
      password: newHashedPassword,
      updatedAt: new Date(),
    });

    return null;
  }
}
