import {NextRequest,NextResponse} from 'next/server';
export function proxy(request:NextRequest){
  const nonce=Buffer.from(crypto.randomUUID()).toString('base64'),dev=process.env.NODE_ENV==='development';
  const policy=`default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev?" 'unsafe-eval'":''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co${dev?' ws:':''}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';`;
  const headers=new Headers(request.headers);headers.set('x-nonce',nonce);headers.set('Content-Security-Policy',policy);
  const response=NextResponse.next({request:{headers}});response.headers.set('Content-Security-Policy',policy);return response;
}
export const config={matcher:['/((?!api|_next/static|_next/image|fonts|favicon.ico).*)']};
