import InviteHandlerPage from './invite-handler';

export async function generateStaticParams() {
  return [{ code: '_' }];
}

export default function Page(props: { params: Promise<{ code: string }> }) {
  return <InviteHandlerPage params={props.params} />;
}
