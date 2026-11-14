import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/app/lib/auth';
import AdminDashboardClient from '@/app/components/AdminDashboardClient';

export const dynamic = 'force-dynamic';

export default async function PortalPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);

  if (!session.valid || !session.email) {
    redirect('/');
  }

  return <AdminDashboardClient initialEmail={session.email} />;
}
