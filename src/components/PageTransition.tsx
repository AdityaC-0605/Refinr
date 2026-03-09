'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import styles from './PageTransition.module.css';

interface PageTransitionProps {
    children: ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
    const pathname = usePathname();

    return (
        <div className={styles.shell}>
            <div key={`${pathname}-beam`} className={styles.routeBeam} />
            <div key={pathname} className={styles.stage}>
                {children}
            </div>
        </div>
    );
}
