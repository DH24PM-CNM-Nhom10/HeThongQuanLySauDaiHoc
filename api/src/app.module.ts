import { Module } from '@nestjs/common';
import { StoreService } from './store/store.service';
import { EntitiesController } from './entities/entities.controller';
import { EntitiesService } from './entities/entities.service';
import { TeacherAuthController } from './teacher-auth/teacher-auth.controller';
import { TeacherAuthService } from './teacher-auth/teacher-auth.service';
import { TrainingOfficeController } from './training-office/training-office.controller';
import { TrainingOfficeService } from './training-office/training-office.service';

@Module({
  imports: [],
  controllers: [TeacherAuthController, TrainingOfficeController, EntitiesController],
  providers: [StoreService, EntitiesService, TeacherAuthService, TrainingOfficeService],
})
export class AppModule {}