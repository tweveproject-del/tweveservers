import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, verifySessionToken } from './lib/auth';
import LoginGateClient from './components/LoginGateClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);

  if (session.valid && session.email) {
    redirect('/portal');
  }

  return <LoginGateClient />;
}
