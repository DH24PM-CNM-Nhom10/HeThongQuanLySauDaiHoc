import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // Nếu Controller đã trả về object chuẩn chứa success thì giữ nguyên
        if (data && typeof data === 'object' && !Array.isArray(data) && 'success' in data) {
          return data;
        }
        // Chuẩn hóa định dạng chung
        return {
          success: true,
          count: Array.isArray(data) ? data.length : undefined,
          data: data,
        };
      }),
    );
  }
}