import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';
import typography from '@tailwindcss/typography';

export default {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  plugins: [tailwindcssAnimate, typography],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'var(--font-inter)',
  				'system-ui',
  				'-apple-system',
  				'sans-serif'
  			]
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			// Cinematic black semantic colors - single source of truth
  			cinema: {
  				// Surfaces (light → dark)
  				page: '#0B0D10',        // Main background
  				surface: '#0F1217',     // Sections without card container
  				card: '#12151B',        // Card backgrounds
  				elevated: '#1A1D24',    // Popover, dropdown, hover states
  				// Borders
  				border: '#262A33',      // Component borders (inputs, cards)
  				borderSoft: '#1D212A',  // Dividers, subtle lines
  				// Overlays
  				overlay: 'rgba(0,0,0,0.55)',      // Card overlays
  				overlayHeavy: 'rgba(0,0,0,0.75)', // Hero/backdrop overlays
  				// Focus ring
  				focus: '#4EA1FF',       // Focus state accent
  				// Text hierarchy (use: text-cinema-text-primary, etc.)
  				text: {
  					primary: '#E7EAF0',   // ~93% - main content
  					secondary: '#B9C0CC', // ~76% - subtitles
  					muted: '#8A94A6',     // ~60% - meta/labels
  					disabled: '#5C6472',  // ~40% - disabled state
  				},
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'vote-pop': {
  				'0%': {
  					transform: 'scale(1)'
  				},
  				'50%': {
  					transform: 'scale(1.4)'
  				},
  				'100%': {
  					transform: 'scale(1)'
  				}
  			},
  			'vote-burst': {
  				'0%': {
  					transform: 'scale(0)',
  					opacity: '1'
  				},
  				'100%': {
  					transform: 'scale(2.5)',
  					opacity: '0'
  				}
  			},
  			'score-pulse': {
  				'0%': { transform: 'scale(1)' },
  				'50%': { transform: 'scale(1.08)' },
  				'100%': { transform: 'scale(1)' }
  			},
  			'score-commit': {
  				'0%': { transform: 'scale(1)' },
  				'40%': { transform: 'scale(1.15)' },
  				'100%': { transform: 'scale(1)' }
  			},
  			'bell-ring': {
  				'0%': { transform: 'rotate(0deg)' },
  				'10%': { transform: 'rotate(14deg)' },
  				'20%': { transform: 'rotate(-12deg)' },
  				'30%': { transform: 'rotate(10deg)' },
  				'40%': { transform: 'rotate(-8deg)' },
  				'50%': { transform: 'rotate(6deg)' },
  				'60%': { transform: 'rotate(-4deg)' },
  				'70%': { transform: 'rotate(2deg)' },
  				'80%, 100%': { transform: 'rotate(0deg)' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'vote-pop': 'vote-pop 0.3s ease-out',
  			'vote-burst': 'vote-burst 0.4s ease-out forwards',
  			'score-pulse': 'score-pulse 120ms ease-out',
  			'score-commit': 'score-commit 200ms ease-out',
  			'bell-ring': 'bell-ring 0.8s ease-in-out 1s 2'
  		}
  	}
  },
} satisfies Config;
