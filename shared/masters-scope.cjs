const norm=v=>String(v??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
function isDoctoralStudent(row){return [row.trinhDo,row.loaiChuongTrinh,row.level].some(v=>norm(v).includes('tien si'))||/^NCS/i.test(String(row.maHocVien||row.ma_hoc_vien||''))||/^9\d{6}$/.test(String(row.maNganh||row.ma_nganh||''));}
function isMasterStudent(row){return !isDoctoralStudent(row);}
function isMasterAssignment(store,row){if(row.trainingTrack==='tien_si'||/^NCS/i.test(String(row.classCode||row.lop||''))||/^9\d{6}$/.test(String(row.majorCode||'')))return false;const students=(store.students||[]).filter(s=>String(s.lop||'')===String(row.classCode||row.lop||''));return !students.length||students.some(isMasterStudent);}
function isMasterSchedule(store,row){const assignment=(store.teachingAssignments||[]).find(a=>a.id===(row.assignmentId||row.maPhanCong));return assignment?isMasterAssignment(store,assignment):isMasterAssignment(store,row);}
module.exports={isDoctoralStudent,isMasterStudent,isMasterAssignment,isMasterSchedule};
