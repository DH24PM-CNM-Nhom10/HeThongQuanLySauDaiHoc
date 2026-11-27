const {test}=require('node:test');const assert=require('node:assert/strict');
const {prepareSchedule:rawPrepareSchedule}=require('../../shared/schedule-import.cjs');
const terms=[{schoolYear:'2026-2027',semester:'1',startDate:'2026-08-01',endDate:'2027-01-31'}];
const prepareSchedule=(rows,a,existing=[])=>rawPrepareSchedule(rows,a,existing,terms);
const {applyWorkflow}=require('../../shared/thesis-workflow.cjs');
const policy={id:'P1',name:'Quy chế thử kiểm thử',processWeight:.3,examWeight:.7,passScore:5,thresholds:[{min:8,letter:'A',gpa:4},{min:5,letter:'C',gpa:2},{min:0,letter:'F',gpa:0}]};
function fixture(){return {students:[{maHocVien:'S1',lop:'L1',tenLuanVan:'Đề tài',gvHuongDan1:'Hướng dẫn'}],teachers:[{shcc:'T1',hoten:'Hướng dẫn'},{shcc:'T2',hoten:'Chủ tịch'},{shcc:'T3',hoten:'Phản biện'}],academicPolicies:[policy],academicPlans:[{classCode:'L1',policyId:'P1',requiredCredits:3,courses:[{code:'C1',name:'Môn 1',credits:3,required:true}]}],teachingAssignments:[{id:'A1',classCode:'L1',teacherId:'T1',schoolYear:'2026-2027',semester:'1',courseCode:'C1'}],gradebooks:[],thesisWorkflows:[],thesisHistory:[]};}
test('Excel timetable validates linked assignment, duplicates and teacher/class/room conflicts',()=>{
 const s=fixture(),row={'Mã phân công':'A1','Ngày học':'30/11/2026','Tiết bắt đầu':1,'Tiết kết thúc':3,'Phòng':'P1'};
 const first=prepareSchedule([row],s.teachingAssignments);assert.equal(first.errors.length,0);assert.equal(first.additions[0].date,'2026-11-30');
 assert.equal(prepareSchedule([row,row],s.teachingAssignments).duplicates,1);
 const overlap={...row,'Tiết bắt đầu':2,'Tiết kết thúc':4};assert.equal(prepareSchedule([overlap],s.teachingAssignments,first.additions).errors.length,1);
 assert.equal(prepareSchedule([{...row,'Mã phân công':'BAD'}],s.teachingAssignments).errors.length,1);
 assert.equal(prepareSchedule([{...row,'Ngày học':'31/02/2026'}],s.teachingAssignments).errors.length,1);
 assert.equal(prepareSchedule([{...row,'Tiết kết thúc':21}],s.teachingAssignments).errors.length,1);
});



test('Thesis approval checks role, revision, pending request, council conflicts and stores history',()=>{
 const s=fixture(),student={manager:false,name:'S1'},manager={manager:true,name:'office'};
 const first=applyWorkflow(s,'S1',student,{action:'topic_request',revision:0,title:'Đề tài mới',reason:'Xin đăng ký'});
 assert.equal(first.revision,1);assert.throws(()=>applyWorkflow(s,'S1',student,{action:'approve',revision:1,requestId:first.requests[0].id,reason:'x'}));
 assert.throws(()=>applyWorkflow(s,'S1',manager,{action:'approve',revision:0,requestId:first.requests[0].id,reason:'Duyệt',decisionDate:'2026-11-26'}));
 applyWorkflow(s,'S1',manager,{action:'approve',revision:1,requestId:first.requests[0].id,reason:'Duyệt',decisionDate:'2026-11-26'});assert.equal(s.students[0].tenLuanVan,'Đề tài mới');
 assert.throws(()=>applyWorkflow(s,'S1',manager,{action:'council',revision:2,chair:'T1',reviewer:'T3',decision:'Q1'}));
 applyWorkflow(s,'S1',manager,{action:'council',revision:2,chair:'T2',reviewer:'T3',decision:'Q1'});
 const req=applyWorkflow(s,'S1',student,{action:'defense_request',revision:3,reason:'Đề nghị bảo vệ'});
 assert.throws(()=>applyWorkflow(s,'S1',manager,{action:'approve',revision:4,requestId:req.requests[1].id,reason:'Duyệt'}));
 applyWorkflow(s,'S1',manager,{action:'approve',revision:4,requestId:req.requests[1].id,reason:'Đã đối chiếu hồ sơ và quy chế',eligibilityConfirmed:true});
 assert.equal(s.students[0].trangThaiLv,'Chờ bảo vệ');assert.equal(s.thesisHistory.length,5);
});

test('Approved extensions restore overdue enrollment status and retain student change history',()=>{
 const s=fixture();s.students[0].trangThai='Quá hạn';s.students[0].ngayHetHan='2020-01-01';
 const w=applyWorkflow(s,'S1',{manager:false,name:'S1'},{action:'extension_request',revision:0,deadline:'2099-01-01',reason:'Xin gia hạn'});
 applyWorkflow(s,'S1',{manager:true,name:'office'},{action:'approve',revision:1,requestId:w.requests[0].id,reason:'Theo quyết định gia hạn'});
 assert.equal(s.students[0].ngayHetHan,'2099-01-01');assert.equal(s.students[0].trangThai,'Đang học');assert.equal(s.studentHistory[0].before.trangThai,'Quá hạn');
 const {councilConflict}=require('../../shared/thesis-workflow.cjs');s.thesisWorkflows[0].council={chair:'T2',reviewer:'T3'};assert.equal(councilConflict(s,'S1',['Chủ tịch']),true);assert.equal(councilConflict(s,'S1',['Hướng dẫn']),false);
});

test('Schedule rejects dates outside the configured term or missing academic calendar',()=>{
 const s=fixture(),row={'Mã phân công':'A1','Ngày học':'2099-01-01','Tiết bắt đầu':1,'Tiết kết thúc':2,'Phòng':'P1'};
 assert.ok(rawPrepareSchedule([row],s.teachingAssignments,[],terms).errors.length);
 assert.ok(rawPrepareSchedule([{...row,'Ngày học':'2026-11-30'}],s.teachingAssignments,[],[]).errors.length);
 assert.equal(rawPrepareSchedule([{...row,'Ngày học':'2026-11-30'}],s.teachingAssignments,[],terms).errors.length,0);
});

test('Program semesters support late-entry cohorts and doctoral duration beyond four terms',()=>{
 const {programSemester}=require('../../shared/program-period.cjs');assert.equal(programSemester('2026-2027','1',2022,2,8),8);assert.equal(programSemester('2026-2027','2',2022,2,8),null);assert.equal(programSemester('2026-2027','1',2023),7);
});

test('Masters operations exclude doctoral learners while retaining original records',()=>{const {isMasterStudent,isMasterAssignment}=require('../../shared/masters-scope.cjs');const s=fixture();s.students.push({maHocVien:'NCS1',lop:'NCS01',trinhDo:'Tiến sĩ'});assert.equal(s.students.filter(isMasterStudent).length,1);assert.equal(isMasterAssignment(s,{classCode:'NCS01'}),false);assert.equal(s.students.length,2);});
