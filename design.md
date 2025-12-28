# CEREBRAL Mobile - Interface Design Plan

## Overview
CEREBRAL Mobile is a neuroimaging analysis application that brings advanced MRI brain scan analysis to iOS and Android devices. The app combines Claude's vision capabilities with HuggingFace MRI datasets for real-time pathology detection, segmentation, and visualization.

## Design Philosophy
- **Medical Professional Focus**: Clean, clinical interface suitable for healthcare professionals and researchers
- **One-Handed Operation**: All primary functions accessible with thumb reach
- **Portrait-First**: Optimized for 9:16 mobile portrait orientation
- **iOS HIG Compliance**: Follows Apple Human Interface Guidelines for native feel

## Color Scheme
- **Primary**: Deep medical blue (#0a7ea4) - Trust, professionalism, clinical environment
- **Background**: White (#ffffff) / Dark (#151718) - Clean, clinical
- **Surface**: Light gray (#f5f5f5) / Dark gray (#1e2022) - Card backgrounds
- **Accent Colors**:
  - Success: Green (#22C55E) - Normal findings
  - Warning: Amber (#F59E0B) - Uncertain findings
  - Error: Red (#EF4444) - Abnormal findings

## Screen List

### 1. Home Screen (Main Tab)
**Primary Content:**
- Quick action cards for primary workflows
- Recent analysis history (last 3-5 scans)
- Dataset quick access buttons

**Functionality:**
- Load MRI from HuggingFace datasets
- Upload custom MRI image from device
- View analysis history
- Access saved reports

**Layout:**
- Hero section with app branding
- Large, tappable action cards (minimum 60pt height)
- Horizontal scrolling dataset selector
- Vertical list of recent analyses

### 2. Analysis Screen (Modal/Stack)
**Primary Content:**
- MRI image viewer (large, zoomable)
- Analysis results display
- Anatomical findings table
- Impression and recommendations

**Functionality:**
- Display MRI scan with zoom/pan gestures
- Show structured analysis report
- Export report as PDF or share
- Save to history

**Layout:**
- Full-width image viewer at top (40% screen height)
- Scrollable content below with:
  - Quality score badge
  - Modality and view information
  - Anatomical findings table with status icons
  - Impression section (highlighted)
  - Differential diagnosis list
  - Recommendations checklist

### 3. Segmentation Screen (Modal/Stack)
**Primary Content:**
- Original MRI image
- Segmentation overlay (color-coded regions)
- Segmentation statistics
- Region of interest metrics

**Functionality:**
- Toggle overlay visibility
- Adjust overlay opacity
- View segmentation statistics
- Export segmented image

**Layout:**
- Split view: Original (left) / Overlay (right) or stacked
- Slider for opacity control
- Statistics cards below image
- Export button in header

### 4. Dataset Browser Screen (Tab)
**Primary Content:**
- List of available HuggingFace datasets
- Dataset descriptions and metadata
- Sample images from each dataset
- Quick load buttons

**Functionality:**
- Browse available MRI datasets
- View dataset information
- Load random sample from dataset
- Preview dataset samples

**Layout:**
- Vertical list of dataset cards
- Each card shows:
  - Dataset name and icon
  - Description (2 lines)
  - Sample count
  - "Load Sample" button

### 5. History Screen (Tab)
**Primary Content:**
- Chronological list of past analyses
- Thumbnail previews
- Quick status indicators (normal/abnormal/uncertain)
- Date and modality labels

**Functionality:**
- View past analysis reports
- Delete history items
- Re-analyze saved images
- Export multiple reports

**Layout:**
- List view with thumbnails
- Swipe actions (delete, share)
- Filter by status/modality
- Search bar at top

### 6. Settings Screen (Tab)
**Primary Content:**
- API configuration (Claude, HuggingFace)
- Analysis preferences
- Export settings
- About and help

**Functionality:**
- Configure API keys
- Set default modality detection
- Choose export format preferences
- View app information

**Layout:**
- Grouped list style (iOS Settings-like)
- Sections: API, Preferences, Export, About
- Toggle switches and text inputs
- Help/documentation links

## Key User Flows

### Flow 1: Quick Analysis from Dataset
1. User opens app → Home screen
2. Taps "Load from Dataset" card
3. Selects dataset (e.g., "Brain Tumor")
4. Taps "Load Random Sample"
5. Image appears → "Analyze" button appears
6. Taps "Analyze"
7. Loading indicator → Analysis screen appears
8. User reviews findings → Taps "Save" or "Share"

### Flow 2: Upload and Analyze Custom Image
1. User opens app → Home screen
2. Taps "Upload Image" card
3. Photo picker opens
4. Selects MRI image from device
5. Image preview appears → "Analyze" button
6. Taps "Analyze"
7. Analysis screen with results
8. User saves to history

### Flow 3: Segment Existing Analysis
1. User views analysis results
2. Taps "Segment" button in header
3. Segmentation screen appears
4. Modality selector (T1/T2/FLAIR)
5. Taps "Run Segmentation"
6. Overlay appears on image
7. User adjusts opacity slider
8. Views statistics → Exports or returns

### Flow 4: Review Past Analysis
1. User taps "History" tab
2. Scrolls through past analyses
3. Taps on an item
4. Full analysis report opens
5. Can re-segment or share
6. Swipes to delete if needed

## Component Patterns

### MRI Image Viewer
- Full-width, aspect-ratio preserved
- Pinch-to-zoom enabled
- Pan gesture for navigation
- Quality indicator overlay (top-right corner)

### Analysis Report Card
- White/dark surface background
- Rounded corners (16pt radius)
- Shadow for elevation
- Structured sections with clear typography hierarchy

### Status Badge
- Pill-shaped with icon
- Color-coded: Green (normal), Amber (uncertain), Red (abnormal)
- Used in findings table and history list

### Action Button
- Primary: Filled with primary color
- Secondary: Outlined
- Minimum 44pt tap target
- Haptic feedback on press

### Dataset Card
- Horizontal card with thumbnail
- Title, description, metadata
- "Load" button on right
- Subtle press animation

## Typography
- **Headers**: SF Pro Display (iOS) / Roboto (Android) - Bold, 24-32pt
- **Body**: SF Pro Text / Roboto - Regular, 16pt
- **Captions**: 14pt, muted color
- **Line Height**: 1.4x for readability

## Interactions
- **Press Feedback**: Scale 0.97 + light haptic for primary actions
- **Swipe Actions**: Delete and share on history items
- **Pull to Refresh**: On history and dataset lists
- **Loading States**: Skeleton screens for image loading, spinner for analysis

## Navigation Structure
```
TabBar (Bottom)
├─ Home (house.fill)
├─ Datasets (folder.fill)
├─ History (clock.fill)
└─ Settings (gear)

Modal Stacks
├─ Analysis Results
└─ Segmentation View
```

## Technical Considerations
- **Image Handling**: Use expo-image for efficient MRI display
- **API Integration**: Claude API for vision analysis, HuggingFace for datasets
- **Storage**: AsyncStorage for history and settings (local-first)
- **Export**: Generate PDF reports using react-native-pdf or similar
- **Performance**: Lazy load images, virtualized lists for history

## Accessibility
- Minimum 44pt tap targets
- High contrast mode support
- VoiceOver/TalkBack labels for all interactive elements
- Dynamic type support for text scaling
