// admin 판별: 둘 중 하나라도 비어 있으면 거짓 (undefined === undefined로 통과하지 않게)
export function isAdminEmail(
  email: string | null | undefined,
  adminEmail: string | undefined = process.env.NEXT_PUBLIC_ADMIN_EMAIL
): boolean {
  if (!email || !adminEmail) return false;
  return email.toLowerCase() === adminEmail.toLowerCase();
}
