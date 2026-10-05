import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/response.interceptor';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Mở rộng bộ nhớ đệm cho phép upload dữ liệu Excel nhiều dòng
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.enableCors({ origin: '*', methods: 'GET,HEAD,PUT,PATCH,POST,DELETE' });
  app.useGlobalInterceptors(new ResponseInterceptor());

  const PORT = process.env.PORT || 3001;
  await app.listen(PORT);
  console.log(`🚀 NestJS Backend đang chạy tại: http://localhost:${PORT}`);
}
bootstrap();