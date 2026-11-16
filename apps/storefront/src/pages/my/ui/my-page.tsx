import { resolveMyRoute } from '../model/my-route';
import { MyView } from './my-view';

export function MyPage({ list }: { list?: string }) {
  return <MyView {...resolveMyRoute(list)} />;
}
