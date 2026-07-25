import { Controller, Get } from '@nestjs/common';
import { JwksService } from './services/jwks.service';

@Controller('auth')
export class JwksController {
  constructor(private jwksService: JwksService) {}

  @Get('jwks')
  getJwks() {
    return this.jwksService.getJwks();
  }
}
