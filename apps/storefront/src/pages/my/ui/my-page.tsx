import { DEFAULT_LIBRARY_LIST, isLibraryList } from '@/entities/library';
import { MyView } from './my-view';

export function MyPage({ list }: { list?: string }) {
  return <MyView list={isLibraryList(list) ? list : DEFAULT_LIBRARY_LIST} />;
}
