import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export default function Home() { redirect(currentUser() ? '/dashboard' : '/login'); }
