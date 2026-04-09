import PostDetailPage from './post-detail';

export async function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <PostDetailPage params={props.params} />;
}
