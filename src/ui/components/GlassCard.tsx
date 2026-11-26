/* GlassCard -- reusable glass-morphism container. */

import './GlassCard.css';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}

export function GlassCard({ children, className = '', as: Tag = 'div' }: GlassCardProps) {
  return (
    <Tag className={`glass-card ${className}`}>
      {children}
    </Tag>
  );
}
