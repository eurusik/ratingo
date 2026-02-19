/**
 * Layout for public pages with Header and Footer.
 */

import {
  Header,
  HeaderContextProvider,
  Footer,
  AnnouncementBarProvider,
  MobileDock,
} from '@/shared/components';
import { GlobalAuthModal } from '@/modules/auth';
import { MainContent } from './main-content';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <AnnouncementBarProvider>
      <HeaderContextProvider>
        <Header />
        <MainContent>{children}</MainContent>
        <Footer />
        <MobileDock />
        <GlobalAuthModal />
      </HeaderContextProvider>
    </AnnouncementBarProvider>
  );
}
