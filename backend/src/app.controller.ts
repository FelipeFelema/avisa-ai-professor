import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { HealthResponseDto } from './common/dto/health-response.dto';

@ApiTags('health')
@Controller({ version: '1' })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({
    operationId: 'health.check',
    summary: 'Verificar saúde da API',
  })
  @ApiOkResponse({
    description: 'API disponível',
    type: HealthResponseDto,
  })
  getHealth(): HealthResponseDto {
    return this.appService.getHealth();
  }
}
