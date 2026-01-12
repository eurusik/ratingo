/**
 * Layout for public pages with Header and Footer.
 */

import { Header, HeaderContextProvider, Footer } from '@/shared/components';
import { GlobalAuthModal } from '@/modules/auth';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <HeaderContextProvider>
      <Header />
      <main className="pt-16">{children}</main>
      <Footer />
      <GlobalAuthModal />
    </HeaderContextProvider>
  );
}
