import { Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService
    ) {}

    async register (createUserDto: CreateUserDto) {
        return this.usersService.create(createUserDto);
    }
}
