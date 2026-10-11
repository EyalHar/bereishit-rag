import { NavLink } from 'react-router-dom';
import { IconBook2, IconInfoCircle, IconMessageQuestion, IconX } from '@tabler/icons-react';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { to: '/', label: 'שאלו שאלה', icon: IconMessageQuestion },
  { to: '/about', label: 'אודות ומקורות', icon: IconInfoCircle },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => (
  <>
    <div
      className={`${styles.backdrop} ${isOpen ? styles.backdropVisible : ''}`}
      onClick={onClose}
    />

    <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
      <div className={styles.brand}>
        <span className={styles.brandIcon}>
          <IconBook2 size={22} />
        </span>
        <div>
          <div className={styles.brandName}>שואלים בבראשית</div>
          <div className={styles.brandTagline}>תשובות מתוך לשון המקרא</div>
        </div>
        <button
          type='button'
          className={styles.closeButton}
          onClick={onClose}
          aria-label='סגירת תפריט'
        >
          <IconX size={20} />
        </button>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.active : ''}`
            }
          >
            <Icon size={20} stroke={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>

      <footer className={styles.footer}>
        נוסח המקרא: ספריא · CC BY-SA
      </footer>
    </aside>
  </>
);

export default Sidebar;
