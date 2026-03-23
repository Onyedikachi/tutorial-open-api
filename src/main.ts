import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Rfc7807ValidationPipe } from './common/pipes/rfc7807-validation.pipe';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { AuditLogger } from './common/services/audit-logger.service';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global middleware
  app.use(helmet());
  app.enableCors();
  
  // Use RFC 7807 validation pipe
  app.useGlobalPipes(new Rfc7807ValidationPipe());
  
  // Use RFC 7807 exception filter
  app.useGlobalFilters(new ProblemDetailsFilter());
  
  // Keep existing interceptors
  app.useGlobalInterceptors(new LoggingInterceptor(app.get(AuditLogger)));

  // Swagger documentation with RFC 7807 schemas
  const config = new DocumentBuilder()
    .setTitle('Open Banking Nigeria API')
    .setDescription('CBN-compliant Open Banking API with RFC 7807 error handling')
    .setVersion('1.0')
    .addTag('auth', 'Authentication and consent')
    .addTag('payments', 'Payment initiation and processing')
    .addTag('accounts', 'Account information')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [
      // Add RFC 7807 models
      require('./common/exceptions/problem-details.dto').ProblemDetails,
      require('./common/exceptions/problem-details.dto').ValidationProblemDetails,
      require('./common/exceptions/problem-details.dto').PaymentProblemDetails,
    ],
  });

  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
}
bootstrap();