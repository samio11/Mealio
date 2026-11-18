import {
  BarChart3,
  CalendarClock,
  CalendarRange,
  Carrot,
  CircleDollarSign,
  LayoutDashboard,
  PiggyBank,
  ReceiptText,
  ScrollText,
  ShoppingBasket,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  /** Path segment under `/m/<messId>/`. */
  segment: string;
  label: string;
  icon: LucideIcon;
  /** Hidden from plain members. */
  managerOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { segment: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { segment: "meals", label: "Meals & menu", icon: UtensilsCrossed },
  { segment: "bazar", label: "Bazar", icon: ShoppingBasket },
  { segment: "duties", label: "Bazar duty", icon: CalendarClock },
  { segment: "deposits", label: "Deposits", icon: PiggyBank },
  { segment: "expenses", label: "Expenses", icon: ReceiptText },
  { segment: "grocery", label: "Grocery & prices", icon: Carrot },
  { segment: "reports", label: "Reports", icon: BarChart3 },
  { segment: "members", label: "Members", icon: Users },
  { segment: "months", label: "Months & settings", icon: CalendarRange, managerOnly: true },
  { segment: "audit", label: "Activity log", icon: ScrollText, managerOnly: true },
];

export const ACCOUNT_ITEM = { label: "Account settings", icon: CircleDollarSign };
