import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function proxy(req: NextRequest, ctx: {params: Promise<{parts?: string[]}>}) {
  const {parts=[]} = await ctx.params;
  if (parts.some(p=> !/^[a-z0-9-]+$/i.test(p))) return NextResponse.json({message:'Đường dẫn không hợp lệ'}, {status:400});
  const base=(process.env.NEST_API_URL || 'http://127.0.0.1:3001').replace(/\/$/,'');
  const url=`${base}/api/office-notices${parts.length?'/'+parts.join('/'):''}`;
  try {
    const headers=new Headers();
    const cookie=req.headers.get('cookie'); if(cookie) headers.set('cookie',cookie);
    if(req.method!=='GET') {
      const origin=req.headers.get('origin');
      if(origin && origin!==req.nextUrl.origin) return NextResponse.json({message:'Origin không hợp lệ'},{status:403});
      headers.set('content-type','application/json');
    }
    const upstream=await fetch(url,{method:req.method,headers,body:req.method==='GET'?undefined:await req.text(),cache:'no-store'});
    return new NextResponse(await upstream.text(),{status:upstream.status,headers:{'content-type':'application/json','cache-control':'no-store'}});
  } catch {return NextResponse.json({message:'Không kết nối được NestJS API'},{status:502});}
}
export const GET=proxy;
export const POST=proxy;
export const PUT=proxy;
