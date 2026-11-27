const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');const XLSX=require('xlsx');const {NextRequest}=require('next/server');
process.env.AGU_SESSION_SECRET='extended-management-tests-secret-32-characters';const root=path.resolve(__dirname,'..'),cache=new Map();let store,writes;
function load(file){if(file.endsWith('.json'))return require(file);if(file.endsWith('.cjs'))return require(file);file+='.ts';if(file===path.join(root,'lib/store.ts'))return {getStore:()=>store,saveStoreToFile:()=>writes++};if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n)):require(n),module,module.exports);return module.exports;}
const auth=load(path.join(root,'lib/agu-auth')),teacher=load(path.join(root,'app/api/teachers/manage/route')),schedule=load(path.join(root,'app/api/schedule/import/route')),academic=load(path.join(root,'app/api/academic/route'));
function request(method,url,body,authorized=true){const headers={cookie:authorized?`${auth.AGU_SESSION_COOKIE}=${auth.createAguSession({role:'admin'})}`:''};if(!(body instanceof FormData))headers['content-type']='application/json';return new NextRequest('http://localhost:3000'+url,{method,headers,...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});}
function fixture(){store={students:[{maHocVien:'S1',hoTen:'HV',lop:'L1'}],teachers:[],teacherHistory:[],schedule:[],scheduleHistory:[],academicTerms:[{schoolYear:"2026-2027",semester:"1",startDate:"2026-08-01",endDate:"2027-01-31"}],teachingAssignments:[{id:'A1',classCode:'L1',teacherId:'T1',courseCode:'C1',schoolYear:'2026-2027',semester:'1'}],academicPolicies:[],academicPlans:[],academicHistory:[],thesisWorkflows:[]};writes=0;}
test('Teacher form creates/edits with uniqueness checks and refuses linked deletion',async()=>{
 fixture();let body={shcc:'T1',hoten:'Giảng viên 1',t_dvi:'Khoa 1',email:'gv1@example.edu.vn'};
 assert.equal((await teacher.POST(request('POST','/api/teachers/manage',body,false))).status,403);assert.equal(writes,0);
 assert.equal((await teacher.POST(request('POST','/api/teachers/manage',body))).status,200);assert.equal(writes,1);assert.equal((await teacher.POST(request('POST','/api/teachers/manage',body))).status,409);
 body={...store.teachers[0],t_dvi:'Khoa 2',previous:{...store.teachers[0]}};assert.equal((await teacher.PUT(request('PUT','/api/teachers/manage',body))).status,200);assert.equal(store.teachers[0].t_dvi,'Khoa 2');
 assert.equal((await teacher.PUT(request('PUT','/api/teachers/manage',body))).status,409);
 assert.equal((await teacher.DELETE(request('DELETE','/api/teachers/manage',{shcc:'T1',previous:store.teachers[0]}))).status,409);
 store.teachingAssignments=[];assert.equal((await teacher.DELETE(request('DELETE','/api/teachers/manage',{shcc:'T1',previous:store.teachers[0]}))).status,200);assert.equal(store.teachers.length,0);
});
function excel(rows,commit){const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(rows),'TKB');const form=new FormData();form.set('file',new File([XLSX.write(book,{type:'buffer',bookType:'xlsx'})],'tkb.xlsx'));form.set('commit',String(commit));return form;}
test('Actual Excel upload previews, commits, deduplicates and keeps old records on invalid input',async()=>{
 fixture();const rows=[{'Mã phân công':'A1','Ngày học':'30/11/2026','Tiết bắt đầu':1,'Tiết kết thúc':3,'Phòng':'P1'}];
 assert.equal((await schedule.POST(request('POST','/api/schedule/import',excel(rows,false),false))).status,403);
 let response=await schedule.POST(request('POST','/api/schedule/import',excel(rows,false)));assert.equal(response.status,200);assert.equal((await response.json()).added,1);assert.equal(writes,0);
 response=await schedule.POST(request('POST','/api/schedule/import',excel(rows,true)));assert.equal(response.status,200);assert.equal(store.schedule.length,1);assert.equal(writes,1);
 response=await schedule.POST(request('POST','/api/schedule/import',excel(rows,true)));assert.equal((await response.json()).duplicates,1);assert.equal(writes,1);
 response=await schedule.POST(request('POST','/api/schedule/import',excel([{...rows[0],'Tiết bắt đầu':2,'Tiết kết thúc':4}],true)));assert.equal(response.status,400);assert.equal(store.schedule.length,1);assert.equal(writes,1);
});


test('Teacher edits preserve legacy alias fields and identifier case',async()=>{
 fixture();store.teachingAssignments=[];store.teachers=[{id:'legacy1',shcc:'t001',hoTen:'GV cũ',donVi:'Khoa cũ'}];
 const {normalizeTeacher}=require('../../shared/teacher-profile.cjs');const previous=normalizeTeacher(store.teachers[0]);
 const response=await teacher.PUT(request('PUT','/api/teachers/manage',{...previous,t_dvi:'Khoa mới',previous}));assert.equal(response.status,200);assert.equal(store.teachers[0].shcc,'t001');assert.equal(store.teachers[0].hoten,'GV cũ');
});


test('General upload/mapping endpoint is removed while schedule import remains separate',async()=>{
 const route=load(path.join(root,'app/api/upload/route'));assert.equal((await route.POST(request('POST','/api/upload',{}))).status,410);
});


test('Legacy teacher mutations cannot overwrite or remove linked records',async()=>{
 fixture();store.teachers=[{shcc:'T1',hoten:'Giảng viên'}];const generic=load(path.join(root,'app/api/[entity]/route')),ctx={params:Promise.resolve({entity:'teachers'})};
 assert.equal((await generic.POST(request('POST','/api/teachers',[]),ctx)).status,405);
 assert.equal((await generic.PUT(request('PUT','/api/teachers',{shcc:'T1',hoten:'Đổi tên'}),ctx)).status,405);
 assert.equal((await generic.DELETE(request('DELETE','/api/teachers?id=T1'),ctx)).status,405);
 assert.equal(store.teachers.length,1);assert.equal(store.teachingAssignments.length,1);assert.equal(writes,0);
});
test('Semester calendar requires valid year and dates and prevents stranding saved schedules',async()=>{
 fixture();const route=load(path.join(root,'app/api/schedule/terms/route'));
 const term={schoolYear:'2026-2027',semester:'2',startDate:'2027-02-01',endDate:'2027-07-31'};
 assert.equal((await route.POST(request('POST','/api/schedule/terms',{...term,startDate:'2099-01-01',endDate:'2099-02-01'}))).status,400);
 assert.equal((await route.POST(request('POST','/api/schedule/terms',term))).status,200);
 store.schedule.push({schoolYear:'2026-2027',semester:'2',date:'2027-06-01'});
 assert.equal((await route.POST(request('POST','/api/schedule/terms',{...term,endDate:'2027-05-31',revision:1}))).status,400);
 assert.equal(store.academicTerms.find(t=>t.semester==='2').endDate,'2027-07-31');
});

test('External program configuration is removed and course references are read only',async()=>{
 fixture();store.courses=[{code:'DOC',track:'tien_si',majorCode:'9620110'},{code:'C1',name:'Legacy',track:'nghien_cuu',credits:3,gpaWeight:2}];
 const route=load(path.join(root,'app/api/courses/route'));
 assert.equal((await academic.GET()).status,410);
 assert.equal((await academic.POST()).status,410);
 assert.equal((await route.POST()).status,410);
 const response=await route.GET(request('GET','/api/courses'));assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.readOnly,true);assert.ok(!body.courses.some(c=>c.code==='DOC'));assert.ok(body.courses.every(c=>c.gpaWeight===undefined));assert.equal(writes,0);assert.equal(store.courses.length,2);
});
