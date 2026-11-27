import {NextResponse} from 'next/server';
const removed=()=>NextResponse.json({message:'Quy chế GPA và kế hoạch chương trình đào tạo thuộc hệ thống riêng; chức năng cấu hình tại đây đã được bỏ.'},{status:410});
export const GET=removed,POST=removed;
