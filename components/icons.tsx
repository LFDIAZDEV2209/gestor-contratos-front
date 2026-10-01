import { 
  Home, Folder, Shield, Settings, Search, Bell, AlertTriangle, CheckCircle, 
  ChevronRight, ChevronDown, Menu, User, FileText, Activity, AlertOctagon, Info
} from 'lucide-react';

export const Icon = ({ name, className }: { name: string, className?: string }) => {
  const m: Record<string, any> = {
    'home': Home, 'folder': Folder, 'shield': Shield, 'cog': Settings,
    'search': Search, 'bell': Bell, 'exclamation-triangle': AlertTriangle,
    'check-circle': CheckCircle, 'chevron-right': ChevronRight, 'chevron-down': ChevronDown,
    'bars': Menu, 'user': User, 'file-contract': FileText, 'chart-line': Activity,
    'exclamation-circle': AlertOctagon, 'info-circle': Info
  };
  const C = m[name] || Info;
  return <C className={className} />;
};
