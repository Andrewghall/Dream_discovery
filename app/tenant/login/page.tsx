import { redirect } from 'next/navigation';

// The tenant login has been merged into the unified login page.
// All users (admin and tenant) now sign in at /login.
export default function TenantLoginRedirect() {
  redirect('/login');
}
