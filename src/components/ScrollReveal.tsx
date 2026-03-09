'use client';

import { useRef, useEffect, useState, type ReactNode, type CSSProperties } from 'react';

interface ScrollRevealProps {
    children: ReactNode;
    className?: string;
    delay?: number;
    direction?: 'up' | 'down' | 'left' | 'right' | 'none';
    distance?: number;
    duration?: number;
    once?: boolean;
}

export default function ScrollReveal({
    children,
    className = '',
    delay = 0,
    direction = 'up',
    distance = 32,
    duration = 700,
    once = true,
}: ScrollRevealProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    if (once) observer.unobserve(node);
                } else if (!once) {
                    setVisible(false);
                }
            },
            { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [once]);

    const translate = {
        up: `translateY(${distance}px)`,
        down: `translateY(-${distance}px)`,
        left: `translateX(${distance}px)`,
        right: `translateX(-${distance}px)`,
        none: 'none',
    }[direction];

    const style: CSSProperties = {
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : translate,
        transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: 'opacity, transform',
    };

    return (
        <div ref={ref} className={className} style={style}>
            {children}
        </div>
    );
}
