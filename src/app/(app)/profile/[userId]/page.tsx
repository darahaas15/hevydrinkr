import UserProfilePage from './user-profile';

export async function generateStaticParams() {
  return [{ userId: '_' }];
}

export default function Page(props: { params: Promise<{ userId: string }> }) {
  return <UserProfilePage params={props.params} />;
}
