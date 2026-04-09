import GroupDetailPage from './group-detail';

export async function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <GroupDetailPage params={props.params} />;
}
