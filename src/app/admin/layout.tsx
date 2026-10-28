// Admin layout with navigation
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';

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

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  if (user.email !== adminEmail) {
    redirect('/');
  }

  return <AdminShell email={user.email}>{children}</AdminShell>;
}
