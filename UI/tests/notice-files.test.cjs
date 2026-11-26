const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');const {NextRequest}=require('next/server');
process.env.AGU_SESSION_SECRET='notice-file-tests-secret-at-least-32-characters';
const root=path.resolve(__dirname,'..'),cache=new Map();let store,writes,directory,published=false;
function load(file){if(file.endsWith('.cjs'))return require(file);file+='.ts';if(file===path.join(root,'lib/store.ts'))return {getStore:()=>store,saveStoreToFile:()=>writes++};if(file===path.join(root,'lib/notice-files.ts'))return {noticeFileDirectory:()=>directory};if(file===path.join(root,'lib/mysql.ts'))return {getDb:()=>({execute:async()=>[published?[{ma_thong_bao:1}]:[]]})};if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n)):require(n),module,module.exports);return module.exports;}
const auth=load(path.join(root,'lib/agu-auth')),upload=load(path.join(root,'app/api/thong-bao/files/route')),download=load(path.join(root,'app/api/thong-bao/files/[id]/route'));
function request(file,admin=true){const form=new FormData();form.set('file',file);return new NextRequest('http://localhost:3000/api/thong-bao/files',{method:'POST',headers:{cookie:admin?`${auth.AGU_SESSION_COOKIE}=${auth.createAguSession({role:'admin'})}`:''},body:form});}
test('Notice attachments save privately, reject invalid files and hide drafts from anonymous downloads',async()=>{
 directory=fs.mkdtempSync(path.join(os.tmpdir(),'qldt-notice-file-'));store={noticeAttachments:[]};writes=0;
 try {
 assert.equal((await upload.POST(request(new File(['%PDF-1.7 fixture'],'tb.pdf'),false))).status,403);
 assert.equal((await upload.POST(request(new File(['executable'],'tb.pdf')))).status,400);assert.equal(writes,0);
 const response=await upload.POST(request(new File(['%PDF-1.7 fixture'],'tb.pdf')));assert.equal(response.status,200);const data=await response.json();assert.match(data.duong_dan_file,/^\/api\/thong-bao\/files\/[a-f0-9-]+$/);assert.equal(writes,1);
 const id=store.noticeAttachments[0].id,ctx={params:Promise.resolve({id})};
 let r=await download.GET(new NextRequest('http://localhost:3000'+data.duong_dan_file),ctx);assert.equal(r.status,404);
 published=true;r=await download.GET(new NextRequest('http://localhost:3000'+data.duong_dan_file),ctx);assert.equal(r.status,200);assert.equal(await r.text(),'%PDF-1.7 fixture');assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 }finally{if(!path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'qldt-notice-file-'))throw new Error('Unsafe test cleanup');fs.rmSync(directory,{recursive:true});}
});
