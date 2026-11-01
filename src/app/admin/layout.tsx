// Admin layout with navigation
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import { isAdminEmail } from '@/lib/admin-email';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  if (!isAdminEmail(user.email)) {
    redirect('/');
  }

  return <AdminShell email={user.email}>{children}</AdminShell>;
}
