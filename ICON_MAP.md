# Icon-First UI Icon Mapping

This document provides a comprehensive mapping of all icons used in the LMS application's icon-first user interface.

## Icon System Overview

The application uses an SVG sprite system with consistent icon mappings across all templates. Icons are designed to be universally intuitive and accessible, with proper ARIA labels and screen reader support.

## Icon Sprite Location

- **File**: `/static/icons/icons.svg`
- **CSS**: `/static/css/icon-ui.css`
- **Default Mode**: Icon-only (`.icon-only` class on `<html>`)
- **Text Mode**: Add `?text=1` query parameter to reveal labels

## Core Icon Mappings

### Navigation & Structure
| Action | Icon ID | aria-label | Selector | Description |
|--------|----------|-------------|----------|-------------|
| **Home/Main Page** | `#home` | "Home" | `.nav-icon[href="/"]` | House icon for main page |
| **Exercise List** | `#list` | "Exercise List" | `.nav-icon[href*="exercise_list"]` | List icon for exercise overview |
| **Create Exercise** | `#new-ex` | "Create New Exercise" | `.nav-icon[href*="exercise_create"]` | Plus icon for new exercise creation |
| **Back/Previous** | `#back` | "Cancel and return to exercise list" | `.btn[href*="exercise_list"]` | Left arrow for navigation back |
| **Settings/Account** | `#settings` | "Login"/"Logout" | `.nav-icon[href*="login"]` | Gear icon for account actions |

### Media Controls
| Action | Icon ID | aria-label | Selector | Description |
|--------|----------|-------------|----------|-------------|
| **Play Video** | `#play` | "View exercise details and X comments" | `.btn[href*="exercise_detail"]` | Play triangle for video playback |
| **Start Recording** | `#record` | "Start recording video" | `#start-recording` | Red circle for recording start |
| **Stop Recording** | `#stop` | "Stop recording video" | `#stop-recording` | Square for recording stop |
| **Camera/Webcam** | `#camera` | "Record with webcam"/"Record video again" | `#reset-recording` | Camera icon for webcam actions |
| **Upload/Submit** | `#upload` | "Upload video file"/"Submit video comment" | `#submit-btn` | Up arrow for file uploads |

### Content Actions
| Action | Icon ID | aria-label | Selector | Description |
|--------|----------|-------------|----------|-------------|
| **Save/Create** | `#save` | "Create exercise" | `#submit-btn` | Floppy disk for saving content |
| **Add Comment** | `#comment` | "Add Comment" | `.comment-form` | Speech bubble for comments |
| **Edit** | `#edit` | "Edit" | `.edit-btn` | Pencil for editing content |
| **Delete** | `#delete` | "Delete" | `.delete-btn` | Trash can for deletion |

### Information & Help
| Action | Icon ID | aria-label | Selector | Description |
|--------|----------|-------------|----------|-------------|
| **Show Icon Meanings** | `#info` | "Show icon meanings" | `.icon-legend-toggle` | Info circle for help overlay |
| **Settings** | `#settings` | "Login"/"Logout" | `.nav-icon` | Gear for account settings |

## Template-Specific Icon Usage

### Exercise List Page (`exercise_list.html`)
```html
<!-- View Exercise Details -->
<a href="{% url 'exercise_detail' exercise.id %}" class="btn btn-secondary">
    <svg class="icon"><use href="/static/icons/icons.svg#play"/></svg>
    <span class="label-text">View Details & Comments ({{ count }})</span>
</a>
```

### Exercise Detail Page (`exercise_detail.html`)
```html
<!-- Submit Comment -->
<button class="btn btn-success" onclick="submitComment()">
    <svg class="icon"><use href="/static/icons/icons.svg#upload"/></svg>
    <span class="label-text">Submit Comment</span>
</button>
```

### Create Exercise Page (`exercise_create.html`)
```html
<!-- Video Source Toggle -->
<button type="button" class="toggle-btn active" data-source="webcam">
    <svg class="icon"><use href="/static/icons/icons.svg#camera"/></svg>
    <span class="label-text">Webcam</span>
</button>

<!-- Recording Controls -->
<button type="button" id="start-recording" class="btn btn-primary btn-large">
    <svg class="icon icon-large"><use href="/static/icons/icons.svg#record"/></svg>
    <span class="label-text">Start Recording</span>
</button>

<!-- Form Actions -->
<button type="submit" id="submit-btn" class="btn btn-success btn-large">
    <svg class="icon icon-large"><use href="/static/icons/icons.svg#save"/></svg>
    <span class="label-text">Create Exercise</span>
</button>
```

### Base Template (`base.html`)
```html
<!-- Navigation -->
<a href="{% url 'exercise_list' %}" class="nav-icon">
    <svg class="icon"><use href="/static/icons/icons.svg#list"/></svg>
    <span class="label-text">Exercises</span>
</a>

<!-- Icon Legend Toggle -->
<button class="icon-legend-toggle">
    <svg class="icon"><use href="/static/icons/icons.svg#info"/></svg>
</button>
```

## Icon-Only Mode Implementation

### CSS Classes
- **`.icon-only`**: Applied to `<html>` by default
- **`.label-text`**: Hidden when `.icon-only` is active
- **`.icon`**: Base icon styling (24x24px)
- **`.icon-large`**: Larger icons (32x32px)
- **`.icon-xl`**: Extra large icons (44x44px)

### JavaScript Toggle
```javascript
// Check for text mode query parameter
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('text') === '1') {
    document.documentElement.classList.remove('icon-only');
}
```

### Icon Legend Modal
- **Toggle**: Fixed ⓘ button in top-right corner
- **Content**: Grid of icon → meaning pairs
- **Accessibility**: Keyboard navigation (Escape to close)
- **Responsive**: Adapts to mobile screens

## Accessibility Features

### ARIA Labels
Every interactive element includes:
- `aria-label`: Screen reader description
- `title`: Tooltip on hover
- `role`: Proper semantic role

### Keyboard Navigation
- **Tab Order**: Logical tab sequence maintained
- **Focus Indicators**: High-contrast focus rings
- **Activation**: Enter/Space key support
- **Escape**: Close modals and overlays

### Screen Reader Support
- **Hidden Labels**: `.label-text` elements for screen readers
- **Icon Descriptions**: Meaningful aria-labels
- **State Changes**: Dynamic status updates

## Design Tokens

### CSS Variables
```css
:root {
  --icon-size: 24px;
  --icon-size-large: 32px;
  --icon-size-xl: 44px;
  --hit-target: 44px;
  --focus-ring: 3px solid #3498db;
  --focus-ring-offset: 2px;
}
```

### Color System
- **Primary**: Blue (#3498db) - Active states
- **Success**: Green (#27ae60) - Completed actions
- **Danger**: Red (#e74c3c) - Errors, destructive actions
- **Warning**: Orange (#f39c12) - Caution states
- **Muted**: Gray (#95a5a6) - Secondary actions

## Testing

### Accessibility Tests
- `tests/test_a11y_icons.py`: Icon presence and ARIA labels
- `tests/test_ui_nonreader_flow.py`: Icon-only form functionality

### Test Coverage
- ✅ Icon sprite loading
- ✅ CSS variable definitions
- ✅ ARIA label presence
- ✅ Keyboard navigation
- ✅ Form submission flows
- ✅ Icon legend functionality

## Browser Support

### Modern Browsers
- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

### Features Used
- CSS Grid
- CSS Custom Properties
- SVG `<use>` elements
- ES6+ JavaScript
- CSS Transitions

## Future Enhancements

### Planned Features
- **Icon Animation**: Micro-interactions for better UX
- **Custom Icon Sets**: Themeable icon collections
- **Icon Search**: Quick icon lookup in legend
- **Accessibility Audit**: Automated a11y testing

### Internationalization
- **Multi-language**: Icon meanings in different languages
- **Cultural Adaptation**: Region-specific icon interpretations
- **RTL Support**: Right-to-left language layouts

## Maintenance

### Adding New Icons
1. Add SVG symbol to `/static/icons/icons.svg`
2. Update icon legend in `base.html`
3. Add test coverage in accessibility tests
4. Update this documentation

### Icon Updates
1. Maintain consistent 24x24 viewBox
2. Use `currentColor` for fill
3. Test across different color schemes
4. Verify accessibility with screen readers

---

**Last Updated**: Current implementation
**Version**: 1.0.0
**Maintainer**: Development Team
