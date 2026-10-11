import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { IconMenu2 } from '@tabler/icons-react';
import Sidebar from '../Sidebar/Sidebar';
import styles from './Layout.module.css';

const Layout = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setIsMenuOpen(false), [pathname]);

  return (
    <div className={styles.layout}>
      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <div className={styles.content}>
        <header className={styles.topbar}>
          <button
            type='button'
            className={styles.menuButton}
            onClick={() => setIsMenuOpen(true)}
            aria-label='פתיחת תפריט'
          >
            <IconMenu2 size={22} />
          </button>
          <span className={styles.topbarTitle}>שואלים בבראשית</span>
        </header>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
