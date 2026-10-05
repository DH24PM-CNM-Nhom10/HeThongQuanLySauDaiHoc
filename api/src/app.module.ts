import { Module } from '@nestjs/common';
import { StoreService } from './store/store.service';
import { EntitiesController } from './entities/entities.controller';
import { EntitiesService } from './entities/entities.service';

@Module({
  imports: [],
  controllers: [EntitiesController],
  providers: [StoreService, EntitiesService],
})
export class AppModule {}