# Music Library Viewer - Style Guide

## Color Theme Overview

The Music Library Viewer uses a **modern dark theme** with a **violet accent system** designed for optimal music library browsing experience.

## Color Palette

### Background Colors
- **Primary Background:** `#121212` - Very dark gray for main app background
- **Secondary Background:** `#1A1A1A` - Slightly lighter dark gray for elevated surfaces
- **Tertiary Background:** `#2A2A2A` - Medium dark gray for cards and interactive elements

### Primary Accent (Violet System)
- **Default:** `#8B5CF6` (violet-500) - Main accent color for buttons, highlights, and active states
- **Light:** `#A78BFA` - Lighter violet for hover states and subtle highlights
- **Dark:** `#7C3AED` - Darker violet for pressed states and emphasis

### Text Colors
- **Primary Text:** `#FFFFFF` - White for main headings and primary content
- **Secondary Text:** `#B3B3B3` - Light gray for secondary information and descriptions
- **Tertiary Text:** `#727272` - Medium gray for subtle text and metadata

## Design Philosophy

### Visual Hierarchy
The color system creates clear visual hierarchy through:
- **High contrast** between text and backgrounds for excellent readability
- **Layered backgrounds** that provide depth and separate content areas
- **Violet highlights** that guide attention to interactive and important elements

### User Experience
- **Professional appearance** suitable for extended music browsing sessions
- **Consistent theming** across all components and states
- **Accessible contrast ratios** for users with visual impairments
- **Modern aesthetic** that feels current and polished

## Implementation

### Tailwind CSS Integration
Colors are defined in `tailwind.config.js` as custom theme extensions:
```javascript
colors: {
  background: {
    DEFAULT: '#121212',
    secondary: '#1A1A1A',
    tertiary: '#2A2A2A',
  },
  primary: {
    DEFAULT: '#8B5CF6',
    light: '#A78BFA',
    dark: '#7C3AED',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#B3B3B3',
    tertiary: '#727272',
  },
}
```

### CSS Variables
Additional CSS variables in `globals.css` provide consistent theming:
```css
:root {
  --background: #121212;
  --background-secondary: #1A1A1A;
  --background-tertiary: #2A2A2A;
  --primary: #8B5CF6;
  --primary-light: #A78BFA;
  --primary-dark: #7C3AED;
  --text-primary: #FFFFFF;
  --text-secondary: #B3B3B3;
  --text-tertiary: #727272;
}
```

## Component-Specific Usage

### Interactive Elements
- **Buttons:** Use `primary` color with `primary-light` on hover, `primary-dark` when pressed
- **Selected States:** Violet border (`primary`) with subtle background highlighting
- **Active Filters:** Violet background with white text for clear indication

### Content Areas
- **Cards:** `background-secondary` with `background-tertiary` on hover
- **Panels:** `background-secondary` with subtle shadows for elevation
  - **Rounded Corners:** `rounded-3xl` (24px border radius) for modern appearance
  - **Light Borders:** `border-white/10` (10% opacity white) for subtle definition
  - **Glass Morphism:** Glass effects with `backdrop-blur` and gradient backgrounds
- **Headers:** `background` with consistent spacing and violet accents

### Custom Scrollbar
- **Track:** `background-secondary`
- **Thumb:** `background-tertiary` with `primary-dark` on hover
- **Size:** 8px width/height with 4px border-radius

## Responsive Considerations

The color theme maintains consistency across all device sizes while supporting:
- **Dynamic header heights** (64px desktop, 96px mobile)
- **Responsive layouts** that adapt color usage appropriately
- **Touch-friendly** color contrast for mobile interactions

## Accessibility

The color palette ensures:
- **WCAG AA compliance** for contrast ratios
- **Colorblind-friendly** design with sufficient luminance differences
- **Focus indicators** using violet accents for keyboard navigation
- **High contrast mode** compatibility