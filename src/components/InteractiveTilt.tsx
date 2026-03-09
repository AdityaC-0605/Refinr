'use client';

import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { useRef } from 'react';
import styles from './InteractiveTilt.module.css';

interface InteractiveTiltProps {
    children: ReactNode;
    className?: string;
    maxTilt?: number;
}

export default function InteractiveTilt({
    children,
    className = '',
    maxTilt = 12,
}: InteractiveTiltProps) {
    const ref = useRef<HTMLDivElement>(null);

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const node = ref.current;
        if (!node) return;

        const rect = node.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        const rotateY = (x - 0.5) * maxTilt;
        const rotateX = (0.5 - y) * maxTilt;

        node.style.setProperty('--pointer-x', `${x * 100}%`);
        node.style.setProperty('--pointer-y', `${y * 100}%`);
        node.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    };

    const handlePointerLeave = () => {
        const node = ref.current;
        if (!node) return;

        node.style.setProperty('--pointer-x', '50%');
        node.style.setProperty('--pointer-y', '50%');
        node.style.transform = 'rotateX(0deg) rotateY(0deg) translateY(0)';
    };

    return (
        <div
            ref={ref}
            className={`${styles.tilt} ${className}`.trim()}
            style={
                {
                    '--pointer-x': '50%',
                    '--pointer-y': '50%',
                } as CSSProperties
            }
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
        >
            {children}
        </div>
    );
}
