import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Circle,
  LayoutDashboard,
  Users,
  Receipt,
  FileText,
  BarChart3,
  Layers,
  ShieldCheck,
  Settings,
  X
} from 'lucide-react';
import { MENU_ICONS } from '../utils/menuIcons';
import clsx from 'clsx';
import api from '../api';
import fullLogo from '../assets/logo.png';

// The menu itself (names, order, links, which privilege shows each page) lives
// in the database `modules` table and comes from GET /users/modules/menu.
// This table only turns the icon *name* stored on a module into a component.
const ICONS = MENU_ICONS;

// Only modules that open a page of this panel belong in the sidebar.
const isPanelRoute = (route) => typeof route === 'string' && route.startsWith('/dashboard');

const leaves = (node) => {
  const kids = node.submodules || [];
  return kids.length ? kids.flatMap(leaves) : isPanelRoute(node.route) ? [node] : [];
};

const toMenuItems = (nodes) =>
  (nodes || [])
    .map((node) => {
      const Icon = ICONS[node.icon] || Circle;
      const children = (node.submodules || []).flatMap(leaves);
      if (children.length) {
        return {
          name: node.name,
          icon: Icon,
          submenus: children.map((c) => ({ name: c.name, path: c.route })),
        };
      }
      return isPanelRoute(node.route) ? { name: node.name, icon: Icon, path: node.route } : null;
    })
    .filter(Boolean);

const RECEIPTS_SUBMENU_WEIGHT = {
  'Receipt Entry': 1,
  'Receipt Tracking': 2,
};

const REPORTS_SUBMENU_WEIGHT = {
  'Member Report': 1,
  'Member Reports': 1,
  'Labels Report': 2,
  'Label Print & Reports': 2,
  'Label Print': 2,
  'Membership Type Report': 3,
  'Membership Types Report': 3,
  'Magazine Returned Report': 4,
  'Magazine Returns Report': 4,
  'Magazine Reports': 4,
  'Receipt Reports': 5,
};

const MASTERS_SUBMENU_WEIGHT = {
  'Location Setup (States, Districts, Taluks)': 1,
  'Location Setup': 1,
  'Postal Codes': 2,
  'Membership Types & Price History': 3,
  'Membership Types': 3,
  'Receipt Particulars': 4,
  'Receipt Types': 4,
  'Bank/Payment Mode Setup': 5,
  'Payment Modes': 5,
  'Banks': 6,
};

const USERS_SUBMENU_WEIGHT = {
  'User Management': 1,
  'Users': 1,
  'Roles & Privileges': 2,
  'Roles': 2,
  'Modules': 3,
};

const ORDER_WEIGHT = {
  'Dashboard': 1,
  'Membership': 2,
  'Receipts': 3,
  'Receipt Entry': 3,
  'Receipt Tracking': 3,
  'Users & Permissions': 4,
  'Users': 4,
  'Magazine': 5,
  'Associates & Affiliations': 6,
  'Press & Media': 7,
  'Events': 8,
  'Managing Committee': 9,
  'Masters': 10,
  'Reports': 11,
  'WhatsApp Notifications': 12,
  'Activity Logs': 13,
  'Organisation Settings': 14,
};

const RECEIPTS_MENU_ITEM = {
  name: 'Receipts',
  icon: ICONS['receipt'] || Receipt,
  submenus: [
    { name: 'Receipt Entry', path: '/dashboard/receipts/entry' },
    { name: 'Receipt Tracking', path: '/dashboard/receipts/tracking' },
  ],
};

const REPORTS_MENU_ITEM = {
  name: 'Reports',
  icon: ICONS['bar-chart'] || BarChart3,
  submenus: [
    { name: 'Member Report', path: '/dashboard/reports/members' },
    { name: 'Labels Report', path: '/dashboard/reports/labels' },
    { name: 'Membership Type Report', path: '/dashboard/reports/membership-types' },
    { name: 'Magazine Returned Report', path: '/dashboard/reports/magazine-returns' },
    { name: 'Receipt Reports', path: '/dashboard/reports/receipts' },
  ],
};

const MASTERS_MENU_ITEM = {
  name: 'Masters',
  icon: ICONS['layers'] || Layers,
  submenus: [
    { name: 'Location Setup', path: '/dashboard/masters/location-setup' },
    { name: 'Membership Types', path: '/dashboard/masters/membership-types' },
    { name: 'Receipt Types', path: '/dashboard/masters/receipt-types' },
    { name: 'Payment Modes', path: '/dashboard/masters/payment-modes' },
    { name: 'Banks', path: '/dashboard/masters/banks' },
  ],
};

const USERS_MENU_ITEM = {
  name: 'Users & Permissions',
  icon: ICONS['shield-check'] || ShieldCheck,
  submenus: [
    { name: 'User Management', path: '/dashboard/users/list' },
    { name: 'Roles & Privileges', path: '/dashboard/users/roles' },
  ],
};

const DEFAULT_MENU_FALLBACK = [
  { name: 'Dashboard', icon: ICONS['layout-dashboard'] || LayoutDashboard, path: '/dashboard' },
  {
    name: 'Membership',
    icon: ICONS['users'] || Users,
    submenus: [
      { name: 'Membership List', path: '/dashboard/membership/list' },
      { name: 'Unapproved Members', path: '/dashboard/membership/unapproved' },
      { name: 'Register New Member', path: '/dashboard/membership/register' },
    ],
  },
  RECEIPTS_MENU_ITEM,
  USERS_MENU_ITEM,
  MASTERS_MENU_ITEM,
  REPORTS_MENU_ITEM,
  { name: 'Organisation Settings', icon: ICONS['settings'] || Settings, path: '/dashboard/settings/organisation' },
];

const orderMenuItems = (items) => {
  const receiptSubmenus = [];
  const initialItems = [];

  (items || []).forEach((item) => {
    if (item.name === 'Receipt Entry' || item.name === 'Receipt Tracking') {
      if (item.submenus?.length) {
        receiptSubmenus.push(...item.submenus);
      } else if (item.path) {
        receiptSubmenus.push({ name: item.name, path: item.path });
      }
    } else {
      initialItems.push(item);
    }
  });

  let receiptsFound = false;
  let reportsFound = false;

  const processed = initialItems.map((item) => {
    if (item.name === 'Receipts') {
      receiptsFound = true;
      const existingSubs = item.submenus || [];
      const mergedSubs = [...existingSubs, ...receiptSubmenus];
      RECEIPTS_MENU_ITEM.submenus.forEach((req) => {
        if (!mergedSubs.some((s) => s.path === req.path || s.name === req.name)) {
          mergedSubs.push(req);
        }
      });
      mergedSubs.sort(
        (a, b) => (RECEIPTS_SUBMENU_WEIGHT[a.name] ?? 50) - (RECEIPTS_SUBMENU_WEIGHT[b.name] ?? 50)
      );
      return {
        ...item,
        icon: item.icon || RECEIPTS_MENU_ITEM.icon,
        submenus: mergedSubs,
      };
    }

    if (item.name === 'Reports') {
      reportsFound = true;
      return {
        ...item,
        icon: item.icon || REPORTS_MENU_ITEM.icon,
        submenus: REPORTS_MENU_ITEM.submenus,
      };
    }

    if (item.name === 'Masters') {
      const existingSubs = item.submenus || [];
      const sortedSubs = [...existingSubs].sort(
        (a, b) => (MASTERS_SUBMENU_WEIGHT[a.name] ?? 50) - (MASTERS_SUBMENU_WEIGHT[b.name] ?? 50)
      );
      return {
        ...item,
        icon: item.icon || MASTERS_MENU_ITEM.icon,
        submenus: sortedSubs,
      };
    }

    if (item.name === 'Users' || item.name === 'Users & Permissions') {
      const existingSubs = item.submenus || [];
      const sortedSubs = [...existingSubs].sort(
        (a, b) => (USERS_SUBMENU_WEIGHT[a.name] ?? 50) - (USERS_SUBMENU_WEIGHT[b.name] ?? 50)
      );
      return {
        ...item,
        name: 'Users & Permissions',
        icon: item.icon || USERS_MENU_ITEM.icon,
        submenus: sortedSubs,
      };
    }

    return item;
  });

  if (!receiptsFound && receiptSubmenus.length > 0) {
    receiptSubmenus.sort(
      (a, b) => (RECEIPTS_SUBMENU_WEIGHT[a.name] ?? 50) - (RECEIPTS_SUBMENU_WEIGHT[b.name] ?? 50)
    );
    processed.push({
      name: 'Receipts',
      icon: RECEIPTS_MENU_ITEM.icon,
      submenus: receiptSubmenus,
    });
  }

  if (!reportsFound) {
    processed.push(REPORTS_MENU_ITEM);
  }

  return processed.sort((a, b) => {
    const wa = ORDER_WEIGHT[a.name] ?? 50;
    const wb = ORDER_WEIGHT[b.name] ?? 50;
    return wa - wb;
  });
};

// Checks exact and nested routes
const isPathActive = (pathname, path) => {
  if (path === '/dashboard') {
    return pathname === '/dashboard';
  }
  if (
    path === '/dashboard/reports/members' &&
    (pathname === '/dashboard/reports' ||
      pathname === '/dashboard/reports/dashboard' ||
      pathname === '/dashboard/reports/summary' ||
      pathname === '/dashboard/reports/members' ||
      pathname === '/dashboard/reports/membership' ||
      pathname === '/dashboard/reports/membership-reports' ||
      pathname === '/dashboard/reports/approved-members' ||
      pathname === '/dashboard/reports/unapproved' ||
      pathname === '/dashboard/reports/unapproved-members' ||
      pathname === '/dashboard/reports/geography' ||
      pathname === '/dashboard/reports/gender')
  ) {
    return true;
  }
  if (
    path === '/dashboard/reports/labels' &&
    (pathname === '/dashboard/reports/labels' ||
      pathname === '/dashboard/reports/label-print' ||
      pathname === '/dashboard/receipts/labels' ||
      pathname === '/dashboard/receipts/label-list' ||
      pathname === '/dashboard/magazine/labels' ||
      pathname === '/label-print')
  ) {
    return true;
  }
  if (
    path === '/dashboard/reports/membership-types' &&
    (pathname === '/dashboard/reports/membership-types' ||
      pathname === '/dashboard/reports/membership-type')
  ) {
    return true;
  }
  if (
    path === '/dashboard/reports/magazine-returns' &&
    (pathname === '/dashboard/reports/magazine-returns' ||
      pathname === '/dashboard/reports/magazine-reports')
  ) {
    return true;
  }
  if (
    path === '/dashboard/reports/receipts' &&
    (pathname === '/dashboard/reports/receipts' ||
      pathname === '/dashboard/reports/receipts/by-member')
  ) {
    return true;
  }
  if (path === '/dashboard/membership/list' && pathname === '/dashboard/membership') {
    return true;
  }
  if (path === '/dashboard/receipts/entry' && pathname === '/dashboard/receipts') {
    return true;
  }
  return pathname === path || pathname.startsWith(`${path}/`);
};

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();

  const [visibleMenuItems, setVisibleMenuItems] = useState([]);
  const [menuState, setMenuState] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    let cancelled = false;
    const loadMenu = () =>
      api
        .get('/users/modules/menu')
        .then((res) => {
          if (cancelled) return;
          const items = toMenuItems(res.data);
          setVisibleMenuItems(items.length ? orderMenuItems(items) : DEFAULT_MENU_FALLBACK);
          setMenuState('ready');
        })
        .catch(() => {
          if (!cancelled) {
            setVisibleMenuItems(DEFAULT_MENU_FALLBACK);
            setMenuState('ready');
          }
        });
    loadMenu();
    // Module Master > Arrange menu announces a new order
    window.addEventListener('hms-menu-change', loadMenu);
    return () => {
      cancelled = true;
      window.removeEventListener('hms-menu-change', loadMenu);
    };
  }, []);

  // Submenus expansion state (keyed by menu item name)
  const [expandedMenus, setExpandedMenus] = useState({});

  // Automatically keep the active parent menu expanded when navigating to any of its submenus
  useEffect(() => {
    const activeParent = visibleMenuItems.find(
      (item) =>
        item.submenus &&
        item.submenus.some((sub) => isPathActive(location.pathname, sub.path))
    );

    if (activeParent) {
      setExpandedMenus((prev) => ({
        ...prev,
        [activeParent.name]: true,
      }));
    }
  }, [location.pathname, visibleMenuItems]);

  const toggleSubmenu = (menuName) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuName]: !prev[menuName],
    }));
  };

  const handleNavClick = () => {
    // Close mobile drawer on item click
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside
      className={clsx(
        'w-64 shrink-0 flex flex-col bg-[#200200] text-[#FAF7F2] select-none z-30 transition-transform duration-300 ease-in-out',
        // Desktop: Fixed/static expanded sidebar
        'lg:static lg:inset-auto lg:translate-x-0 lg:h-screen lg:shadow-none',
        // Mobile: Off-canvas slide-over drawer
        'fixed inset-y-0 left-0 shadow-2xl',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#8C1801] bg-[#200200] px-4 py-1.5">
        <NavLink
          to="/dashboard"
          onClick={handleNavClick}
          className="flex items-center justify-start flex-1 h-full min-w-0"
          title="Shri Akhila Havyaka Mahasabha"
        >
          <img
            src={fullLogo}
            alt="Shri Akhila Havyaka Mahasabha (R.)"
            className="w-full max-h-11 object-contain filter drop-shadow-sm"
          />
        </NavLink>

        {/* Close Button on Mobile Drawer */}
        <button
          type="button"
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 transition-colors ml-2 shrink-0 cursor-pointer"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto overflow-x-hidden">
        {menuState === 'loading' && (
          <p className="px-3.5 py-2 text-xs text-[#FAF7F2]/60">Loading menu…</p>
        )}
        {menuState === 'error' && (
          <p className="px-3.5 py-2 text-xs text-[#FFC107]">Menu could not be loaded. Please refresh.</p>
        )}
        {visibleMenuItems.map((item) => {
          const isParentActive =
            item.submenus?.some((sub) =>
              isPathActive(location.pathname, sub.path)
            ) ?? false;

          const isSingleActive =
            !item.submenus && isPathActive(location.pathname, item.path);

          const Icon = item.icon;
          const isItemExpanded = Boolean(expandedMenus[item.name]);

          return (
            <div key={item.name} className="relative">
              {item.submenus ? (
                <div>
                  {/* Parent Menu Item */}
                  <button
                    type="button"
                    onClick={() => toggleSubmenu(item.name)}
                    aria-expanded={isItemExpanded}
                    className={clsx(
                      'relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer group',
                      isParentActive
                        ? 'bg-[#8C1801] text-[#FFC107] font-semibold shadow-sm ring-1 ring-[#FFC107]/40'
                        : 'text-[#FAF7F2] hover:bg-[#8C1801]/60 hover:text-white'
                    )}
                  >
                    <div className="flex items-center min-w-0">
                      <Icon
                        className={clsx(
                          'h-5 w-5 shrink-0 mr-3 transition-colors',
                          isParentActive
                            ? 'text-[#FFC107]'
                            : 'text-[#FFC107]/80 group-hover:text-[#FFC107]'
                        )}
                      />
                      <span className="truncate text-left">{item.name}</span>
                    </div>

                    {/* Submenu Dropdown Chevron */}
                    <div className="shrink-0 transition-transform duration-200">
                      {isItemExpanded ? (
                        <ChevronDown className="h-4 w-4 text-[#FFC107]/90" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-stone-300" />
                      )}
                    </div>
                  </button>

                  {/* Submenu Items List */}
                  {isItemExpanded && (
                    <div className="space-y-1 py-1 pl-6 pr-1 animate-in fade-in-50 duration-200">
                      {item.submenus.map((sub) => {
                        const isSubActive = isPathActive(location.pathname, sub.path);

                        return (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            onClick={handleNavClick}
                            className={clsx(
                              'relative block rounded-lg px-3 py-2 text-sm transition-all truncate group',
                              isSubActive
                                ? 'bg-[#863221] text-white font-bold ring-1 ring-[#FFC107]/50 shadow-xs'
                                : 'text-[#FAF7F2]/80 font-medium hover:bg-[#8C1801]/60 hover:text-white'
                            )}
                          >
                            <span className="truncate">{sub.name}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Single Menu Item (e.g. Dashboard) */
                <NavLink
                  to={item.path}
                  end={item.path === '/dashboard'}
                  onClick={handleNavClick}
                  className={clsx(
                    'relative w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer group',
                    isSingleActive
                      ? 'bg-[#8C1801] text-[#FFC107] font-semibold shadow-sm ring-1 ring-[#FFC107]/40'
                      : 'text-[#FAF7F2] hover:bg-[#8C1801]/60 hover:text-white'
                  )}
                >
                  <Icon
                    className={clsx(
                      'h-5 w-5 shrink-0 mr-3 transition-colors',
                      isSingleActive
                        ? 'text-[#FFC107]'
                        : 'text-[#FFC107]/80 group-hover:text-[#FFC107]'
                    )}
                  />
                  <span className="truncate text-left">{item.name}</span>
                </NavLink>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}