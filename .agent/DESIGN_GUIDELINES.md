# CardioKinetic UI Design Guidelines

## Color System

### Dynamic Accent Colors (CSS Variables)
All accent colors are set via CSS custom properties for theming:

| Variable | Purpose | Usage |
|----------|---------|-------|
| `var(--accent)` | **Readiness/Primary** | Readiness scores, primary actions, success states |
| `var(--accent-alt)` | **Fatigue/Secondary** | Fatigue scores, secondary metrics, warnings |

### Usage Pattern
```tsx
// For readiness/primary elements
style={{ color: 'var(--accent)' }}
style={{ backgroundColor: 'var(--accent)' }}

// For fatigue/secondary elements  
style={{ color: 'var(--accent-alt)' }}
style={{ backgroundColor: 'var(--accent-alt)' }}

// For subtle backgrounds
style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)' }}
```

### Semantic Colors (Tailwind)
- **Green** (`text-green-500`): Improvements, positive changes
- **Red** (`text-red-500`): Negative changes, warnings
- **Amber/Orange**: Modifiers, triggers, attention items
- **Neutral**: Text, borders, backgrounds

## Typography

### Section Headers
```tsx
<h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
    <Icon size={14} style={{ color: 'var(--accent)' }} />
    Section Title
</h3>
```

### Stat Labels
```tsx
<div className="text-[10px] font-bold uppercase text-neutral-400">LABEL</div>
```

### Large Numbers
```tsx
<span className="text-2xl font-bold">123</span>
```

## Cards & Containers

### Standard Card
```tsx
<div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
```

### Accent Highlight Card
```tsx
<div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 
                rounded-2xl border border-amber-200 dark:border-amber-800/50 p-4">
```

## Buttons

### Primary Button
```tsx
<button className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider 
                   text-white hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--accent)' }}>
```

### Secondary Button
```tsx
<button className="px-4 py-2 rounded-lg text-xs font-medium
                   bg-neutral-100 dark:bg-neutral-800 
                   text-neutral-600 dark:text-neutral-400
                   hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
```

## Data Visualization

### Fatigue Display
- Use `var(--accent-alt)` as the primary color
- Pair with `text-red-500` for increases (bad)
- Pair with `text-green-500` for decreases (good)

### Readiness Display  
- Use `var(--accent)` as the primary color
- Pair with `text-green-500` for increases (good)
- Pair with `text-red-500` for decreases (bad)

### Charts (see SimulationCharts.tsx)
```tsx
// Fatigue line/bar
stroke="var(--accent-alt)"
fill="var(--accent-alt)"

// Readiness line/bar
stroke="var(--accent)"
fill="var(--accent)"
```

## Form Controls

### Select Input
```tsx
<select className="bg-neutral-50 dark:bg-neutral-800 
                   border border-neutral-200 dark:border-neutral-700 
                   rounded-lg px-3 py-2 text-sm">
```

## Icons
- Size 14-16 for inline with text
- Size 20-24 for standalone buttons
- Use `strokeWidth={1.5}` for nav, `strokeWidth={2.5}` for actions
- Accent color via inline style, not className

## Spacing
- `p-4` or `p-6` for card padding
- `gap-2` or `gap-3` for compact layouts
- `gap-4` for section separation
- `mb-4` between sections within cards
