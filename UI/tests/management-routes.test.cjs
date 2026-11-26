const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');const XLSX=require('xlsx');const {NextRequest}=require('next/server');
process.env.AGU_SESSION_SECRET='extended-management-tests-secret-32-characters';const root=path.resolve(__dirname,'..'),cache=new Map();let store,writes;
function load(file){if(file.endsWith('.cjs'))return require(file);file+='.ts';if(file===path.join(root,'lib/store.ts'))return {getStore:()=>store,saveStoreToFile:()=>writes++};if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n)):require(n),module,module.exports);return module.exports;}
const auth=load(path.join(root,'lib/agu-auth')),teacher=load(path.join(root,'app/api/teachers/manage/route')),schedule=load(path.join(root,'app/api/schedule/import/route')),academic=load(path.join(root,'app/api/academic/route'));
function request(method,url,body,authorized=true){const headers={cookie:authorized?`${auth.AGU_SESSION_COOKIE}=${auth.createAguSession({role:'admin'})}`:''};if(!(body instanceof FormData))headers['content-type']='application/json';return new NextRequest('http://localhost:3000'+url,{method,headers,...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});}
function fixture(){store={students:[{maHocVien:'S1',hoTen:'HV',lop:'L1'}],teachers:[],teacherHistory:[],schedule:[],scheduleHistory:[],teachingAssignments:[{id:'A1',classCode:'L1',teacherId:'T1',courseCode:'C1',schoolYear:'2026-2027',semester:'1'}],academicPolicies:[],academicPlans:[],academicHistory:[],thesisWorkflows:[]};writes=0;}
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
test('Academic configuration requires staff auth and revisions before changing class plan',async()=>{
 fixture();const policy={name:'Quy chế',processWeight:.3,examWeight:.7,passScore:5,thresholds:[{min:5,letter:'Đạt',gpa:2},{min:0,letter:'F',gpa:0}]};
 assert.equal((await academic.POST(request('POST','/api/academic',{kind:'policy',data:policy},false))).status,403);
 assert.equal((await academic.POST(request('POST','/api/academic',{kind:'policy',data:policy}))).status,200);
 store.courses=[{code:'C1',name:'Học phần 1',credits:3}];
 const plan={classCode:'L1',policyId:store.academicPolicies[0].id,requiredCredits:3,courses:[{code:'C1',name:'Học phần 1',credits:3,required:true}]};
 assert.equal((await academic.POST(request('POST','/api/academic',{kind:'plan',data:plan}))).status,200);
 assert.equal((await academic.POST(request('POST','/api/academic',{kind:'plan',data:plan,revision:0}))).status,409);
 assert.equal((await academic.POST(request('POST','/api/academic',{kind:'plan',data:plan,revision:1}))).status,200);
});

test('Teacher edits preserve legacy alias fields and identifier case',async()=>{
 fixture();store.teachingAssignments=[];store.teachers=[{id:'legacy1',shcc:'t001',hoTen:'GV cũ',donVi:'Khoa cũ'}];
 const {normalizeTeacher}=require('../../shared/teacher-profile.cjs');const previous=normalizeTeacher(store.teachers[0]);
 const response=await teacher.PUT(request('PUT','/api/teachers/manage',{...previous,t_dvi:'Khoa mới',previous}));assert.equal(response.status,200);assert.equal(store.teachers[0].shcc,'t001');assert.equal(store.teachers[0].hoten,'GV cũ');
});

test('Course creation stores per-course weights and refuses invalid totals or changes after grades exist',async()=>{
 fixture();const route=load(path.join(root,'app/api/courses/route'));store.courses=[];store.catalogs=[{kind:'major',code:'N1',name:'Ngành 1'}];store.academicPolicies=[{id:'P1',name:'Thang GPA',passScore:5,thresholds:[{min:0,letter:'F',gpa:0}]}];
 const data={code:'C1',name:'Môn 1',majorCode:'N1',track:'nghien_cuu',semesters:[1],credits:3,gpaWeight:2,processWeight:.3,examWeight:.7,policyId:'P1'};
 assert.equal((await route.POST(request('POST','/api/courses',{data},false))).status,403);
 assert.equal((await route.POST(request('POST','/api/courses',{data:{...data,examWeight:.6}}))).status,400);assert.equal(writes,0);
 assert.equal((await route.POST(request('POST','/api/courses',{data}))).status,200);assert.equal(store.courses[0].gpaWeight,2);assert.equal(store.courses[0].processWeight,.3);
 store.gradebooks=[{assignmentId:'A1',scores:[{maHocVien:'S1',totalScore:7}]}];
 assert.equal((await route.POST(request('POST','/api/courses',{data:{...data,gpaWeight:5},revision:1}))).status,409);assert.equal(store.courses[0].gpaWeight,2);
});
test('General upload/mapping endpoint is removed while schedule import remains separate',async()=>{
 const route=load(path.join(root,'app/api/upload/route'));assert.equal((await route.POST(request('POST','/api/upload',{}))).status,410);
});
test('Grade conversion scale can be configured without global component weights',async()=>{
 fixture();const policy={name:'Thang GPA chung',passScore:5,thresholds:[{min:5,letter:'C',gpa:2},{min:0,letter:'F',gpa:0}]};
 assert.equal((await academic.POST(request('POST','/api/academic',{kind:'policy',data:policy}))).status,200);assert.equal(store.academicPolicies[0].processWeight,undefined);
});
