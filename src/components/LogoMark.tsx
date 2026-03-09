interface LogoMarkProps {
    className?: string;
}

export default function LogoMark({ className }: LogoMarkProps) {
    return (
        <svg
            viewBox="0 0 64 64"
            aria-hidden="true"
            focusable="false"
            className={className}
        >
            <defs>
                <linearGradient id="refinr-logo-gradient" x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#ffe0bd" />
                    <stop offset="0.35" stopColor="#ffb36b" />
                    <stop offset="1" stopColor="#74e3ff" />
                </linearGradient>
            </defs>
            <rect x="6" y="6" width="52" height="52" rx="16" fill="url(#refinr-logo-gradient)" />
            <path d="M23 44 34.5 18h5.5L28.5 44z" fill="#082434" />
            <path d="M38 18h9.5L36 44h-9z" fill="#082434" opacity="0.88" />
            <circle cx="43.5" cy="18.5" r="4.5" fill="#fff6ea" />
        </svg>
    );
}
