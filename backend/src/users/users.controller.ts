import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';

interface JwtRequest extends Express.Request {
  user: { id: string; email: string; role: string; sid: string };
}

@Controller({
  path: 'users',
  version: '1',
})
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: JwtRequest) {
    return await this.usersService.getProfile(req.user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Request() req: JwtRequest,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return await this.usersService.updateProfile(
      req.user.id,
      req.user.sid,
      updateProfileDto,
    );
  }
}
