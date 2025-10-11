# UI Refresh Plan

## Design Principles
- Embrace a bright, optimistic aesthetic inspired by community sharing.
- Balance soft glassmorphism panels with bold gradient accents to differentiate key actions.
- Maintain high contrast and accessible color ratios for text and calls to action.
- Layer micro-interactions (hover, focus, transitions) to make navigation feel responsive.
- Ensure dark-mode parity with thoughtful hue shifts instead of simple inversion.

## Theming Targets
- **Colors**: Expand palette with aurora gradients (emerald → cyan → violet) alongside warm supporting hues (amber, rose). Use muted slates for text, with accent glows on focus states.
- **Typography**: Pair existing `Inter` body font with a display face (`Clash Display`) for headlines. Increase letter spacing on nav items and uppercase small labels.
- **Spacing & Layout**: Introduce consistent section padding (clamp-based), rounded 2xl cards, and layered backgrounds using gradients + subtle noise textures.

## Feature Areas
1. **Global Shell**
   - Update background gradient, header glass treatment, and footer layout.
   - Add animated gradient border on active nav links and indicator for SSE reconnect state.
   - Style scrollbar and selection colors.
2. **Home / Landing**
   - Showcase hero with split layout (copy + illustrative card stack).
   - Add marquee of categories and new testimonial-like highlight cards.
3. **Search Experience**
   - Convert filter panel into pill-based controls with floating action bar.
   - Use sticky results header with result count, view toggles, and interactive cards.
   - Enhance map card with neon border and live location pulse.
4. **Dashboard (overview + favorites + profile)**
   - Standardize page headers with gradient pill and action buttons.
   - Improve cards with icon badges, progress bars, and hover lifts.
5. **Reusable Components**
   - Create `PageHeader`, `MetricCard`, `InteractiveCard`, `PrimaryButton`, and `GradientPill` components to reuse across pages.

## Interaction Layer
- Transition durations default to 250–350ms with `ease-out` or custom bezier.
- Apply `animate-` utilities for entrance (slide/fade) and highlight pulses.
- Introduce skeleton placeholders for lists and shimmering gradient for loading states.

## Accessibility & QA
- Minimum contrast ratio 4.5:1 for primary text; 3:1 for interactive UI states.
- Provide focus-visible styling with ring offsets and gradient glows.
- Re-test responsiveness at breakpoints: 375px, 768px, 1280px.

## Deliverables
- Updated Tailwind theme & global tokens.
- Refreshed layout shell and key pages (home, search, dashboard, profile).
- Documented smoke-test plan outlining critical paths (nav, search, favorites, map interactions).
