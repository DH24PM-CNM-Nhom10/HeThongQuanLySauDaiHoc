import { GradeStatisticsController } from './teacher-auth/grade-statistics.controller';
import { StudentDocumentsController } from './student-records/student-documents.controller';
import { StudentDocumentsService } from './student-records/student-documents.service';
import { Module } from '@nestjs/common';
import { OfficeNoticesController } from './office-notices/office-notices.controller';
import { OfficeNoticesService } from './office-notices/office-notices.service';
import { StoreService } from './store/store.service';
import { EntitiesController } from './entities/entities.controller';
import { EntitiesService } from './entities/entities.service';
import { TeacherAuthController } from './teacher-auth/teacher-auth.controller';
import { TeacherAuthService } from './teacher-auth/teacher-auth.service';
import { TeacherGradesService } from './teacher-auth/teacher-grades.service';
import { StudentRecordsService } from './student-records/student-records.service';
import { StudentRecordsController } from './student-records/student-records.controller';
import { TrainingOfficeController } from './training-office/training-office.controller';
import { TrainingOfficeService } from './training-office/training-office.service';

@Module({
  imports: [],
  controllers: [GradeStatisticsController, StudentDocumentsController, OfficeNoticesController, TeacherAuthController, TrainingOfficeController, StudentRecordsController, EntitiesController],
  providers: [StudentDocumentsService, OfficeNoticesService, StoreService, EntitiesService, TeacherAuthService, TeacherGradesService, TrainingOfficeService, StudentRecordsService],
})
export class AppModule {}
