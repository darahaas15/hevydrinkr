import ChallengesPage from './challenges';

export async function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <ChallengesPage params={props.params} />;
}
