import { can } from './rbac';
export function needsMe(u: any, s: any) {
  return (s.status === 'diajukan' && can.verifRT(u.role) && u.rt_id === s.rt_id) || (s.status === 'diverifikasi_rt' && can.verifRW(u.role)) ||
    (s.status === 'diverifikasi_rw' && (s.butuh_kelurahan ? can.approveKel(u.role) : can.approveRW(u.role)));
}
