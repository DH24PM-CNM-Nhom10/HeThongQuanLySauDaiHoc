import StudentPageSwitch from '../../components/students/StudentPageSwitch';
import ScheduleImport from '../../components/schedule/ScheduleImport';
export default function SchedulePage() { return <StudentPageSwitch section="schedule" adminView={<ScheduleImport />}/>; }
