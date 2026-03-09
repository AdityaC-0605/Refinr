'use client';

import { useEffect, useRef } from 'react';
import styles from './AmbientBackdrop.module.css';

export default function AmbientBackdrop() {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        const updatePointer = (event: PointerEvent) => {
            const x = (event.clientX / window.innerWidth) * 100;
            const y = (event.clientY / window.innerHeight) * 100;
            node.style.setProperty('--ambient-x', `${x}%`);
            node.style.setProperty('--ambient-y', `${y}%`);
        };

        window.addEventListener('pointermove', updatePointer, { passive: true });
        return () => window.removeEventListener('pointermove', updatePointer);
    }, []);

    return (
        <div
            ref={ref}
            className={styles.backdrop}
            aria-hidden="true"
        >
            <div className={styles.pointerGlow} />
            <div className={styles.mesh} />
            <div className={styles.noise} />
        </div>
    );
}
