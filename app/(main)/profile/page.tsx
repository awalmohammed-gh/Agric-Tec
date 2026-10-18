import { redirect } from 'next/navigation';

/** Profile now lives on the Profile & Settings page; old links land on its profile section. */
export default function ProfilePage() {
  redirect('/settings#profile');
}
