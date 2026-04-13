import UserProfilePage from './user-profile';

export async function generateStaticParams() {
  return [{ userId: '_' }];
}

export default function Page() {
  return <UserProfilePage />;
}
