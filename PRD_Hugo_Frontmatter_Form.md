# Product Requirements Document: Hugo Frontmatter Form

## Project Overview

Transform the current Monaco editor-based frontmatter interface in the settings modal into a user-friendly form system using react-jsonschema-form. This will enable non-technical users to manage their Hugo page frontmatter through a structured, theme-aware interface while maintaining support for complex Hugo frontmatter patterns.

## Current State Analysis

### Existing System
- **Frontmatter Interface**: Monaco editor in modal dialog (`components/modals/settings-modal.tsx`)
- **Document Management**: Zustand store with frontmatter parsing (`hooks/use-document.ts`)
- **Frontmatter Handling**: Supports YAML, TOML, and JSON frontmatter formats
- **Integration**: Connected to document store with real-time updates

### Current Limitations
- Requires technical knowledge of YAML/TOML/JSON syntax
- No validation or guidance for frontmatter fields
- Complex Hugo frontmatter patterns are difficult to manage
- No theme-specific field suggestions or validation
- No categorization or grouping of related frontmatter fields

## Goals & Objectives

### Primary Goals
1. **User-Friendly Interface**: Replace Monaco editor with intuitive form controls
2. **Theme-Aware Forms**: Provide customized frontmatter fields based on selected Hugo theme
3. **Format Flexibility**: Support YAML, TOML, and JSON frontmatter formats
4. **Dynamic Categorization**: Organize frontmatter fields into logical groups
5. **Seamless Integration**: Maintain existing document store integration

### Success Metrics
- Reduce frontmatter editing errors by 80%
- Increase user engagement with page settings by 60%
- Support for 100% of existing Hugo frontmatter patterns
- Zero breaking changes to existing document workflow

## Technical Requirements

### 1. Database Schema Extensions

#### 1.1 Update hugoTemplates Table
```typescript
hugoTemplates: defineTable({
    // ... existing fields ...
    settingsJsonSchema: v.optional(v.record(v.string(), v.any())), // Site-wide settings (existing)
    settingsUiSchema: v.optional(v.record(v.string(), v.any())),   // Site-wide UI schema (existing)
    pageSettingsJsonSchema: v.optional(v.record(v.string(), v.any())), // Page frontmatter schema (NEW)
    pageSettingsUiSchema: v.optional(v.record(v.string(), v.any())),   // Page frontmatter UI schema (NEW)
})
```

**Implementation Details**: 
- **pageSettingsJsonSchema**: Stores the complete JSON Schema for frontmatter form generation
- **pageSettingsUiSchema**: Stores the UI Schema for react-jsonschema-form customization
- **Theme-specific schemas**: Each Hugo theme can have its own frontmatter schema
- **Default values**: Included within the JSON schema structure

### 2. Frontmatter Schema Structure

#### 2.1 Hugo Page Types and Conditional Fields
```json
{
  "type": "object",
  "title": "Hugo Page Settings",
  "properties": {
    "pageType": {
      "type": "string",
      "title": "Page Type",
      "enum": ["homepage", "docs", "blog", "contact", "general"],
      "enumNames": ["Homepage", "Documentation", "Blog Post", "Contact", "General Page"],
      "default": "general"
    },
    "title": {
      "type": "string",
      "title": "Page Title",
      "description": "The title of your page"
    },
    "date": {
      "type": "string",
      "format": "date-time",
      "title": "Publication Date"
    },
    "draft": {
      "type": "boolean",
      "title": "Draft",
      "description": "Mark as draft to prevent publication",
      "default": false
    },
    "weight": {
      "type": "integer",
      "title": "Page Weight",
      "description": "Used for ordering pages (lower numbers appear first)",
      "minimum": 0
    }
  },
  "allOf": [
    {
      "if": {
        "properties": { "pageType": { "const": "homepage" } }
      },
      "then": {
        "properties": {
          "banner": {
            "type": "object",
            "title": "Homepage Banner",
            "properties": {
              "title": { "type": "string", "title": "Banner Title" },
              "subtitle": { "type": "string", "title": "Banner Subtitle" },
              "image": { "type": "string", "title": "Banner Image" }
            }
          }
        }
      }
    },
    {
      "if": {
        "properties": { "pageType": { "const": "blog" } }
      },
      "then": {
        "properties": {
          "author": { "type": "string", "title": "Author" },
          "tags": {
            "type": "array",
            "title": "Tags",
            "items": { "type": "string" }
          },
          "categories": {
            "type": "array", 
            "title": "Categories",
            "items": { "type": "string" }
          }
        }
      }
    }
  ],
  "required": ["title", "pageType"]
}
```

#### 2.2 UI Schema for Enhanced UX
```json
{
  "pageType": {
    "ui:help": "Select your page type - this will show/hide relevant fields automatically"
  },
  "title": {
    "ui:placeholder": "Enter page title..."
  },
  "date": {
    "ui:help": "Leave empty to use current date/time"
  },
  "banner": {
    "ui:collapsible": true,
    "ui:collapsed": false,
    "title": {
      "ui:placeholder": "Welcome to our site"
    }
  },
  "tags": {
    "ui:help": "Press Enter after each tag to add it to the list"
  }
}
```

### 3. Frontend Components

#### 3.1 Enhanced Settings Modal
```typescript
// components/modals/settings-modal.tsx
interface SettingsModalProps {
  // Existing modal structure remains
}

interface FrontmatterFormData {
  [fieldKey: string]: any; // Direct frontmatter field mapping
}
```

**Key Features**:
- **Dual View**: Toggle between Form View and Raw Editor (Monaco)
- **Theme Integration**: Automatic schema loading based on document theme
- **Format Detection**: Auto-detect YAML/TOML/JSON and maintain format
- **Real-time Updates**: Immediate sync with document store
- **Validation**: Live validation with user-friendly error messages

#### 3.2 Data Flow Architecture
```
Document Store → Parse Frontmatter → Apply Schema → Generate Form → User Edit → Update Store → Save to GitHub
```

### 4. Backend Integration

#### 4.1 Convex Functions (New)
```typescript
// convex/hugoTemplates.ts
export const getPageSettingsSchema = query({
  args: { folderName: v.string() },
  handler: async (ctx, args) => {
    const template = await ctx.db
      .query("hugoTemplates")
      .filter(q => q.eq(q.field("folderName"), args.folderName))
      .first();
    
    return {
      jsonSchema: template?.pageSettingsJsonSchema,
      uiSchema: template?.pageSettingsUiSchema
    };
  }
});
```

#### 4.2 Document Store Extensions
```typescript
// hooks/use-document.ts (Enhanced)
interface DocumentStore {
  // ... existing methods ...
  
  // New frontmatter form methods
  getFrontmatterFormData: (path: string) => Record<string, any>;
  updateFrontmatterFromFormData: (path: string, formData: Record<string, any>) => void;
  mergeFrontmatterWithSchema: (path: string, schema: any) => Record<string, any>;
}
```

**Data Transformation Pipeline**:
1. **Parse Frontmatter**: Extract and parse YAML/TOML/JSON frontmatter
2. **Schema Merging**: Apply schema defaults to existing frontmatter
3. **Form Generation**: Create RJSF-compatible form data
4. **User Interaction**: Handle form changes and validation
5. **Format Preservation**: Convert back to original frontmatter format
6. **Document Update**: Sync with document store and GitHub

### 5. Format Handling Strategy

#### 5.1 Multi-Format Support
```typescript
interface FrontmatterParser {
  detectFormat(raw: string): 'yaml' | 'toml' | 'json';
  parse(raw: string, format: string): Record<string, any>;
  stringify(data: Record<string, any>, format: string): string;
}

// Format detection logic
const detectFrontmatterFormat = (raw: string) => {
  if (raw.trim().startsWith('{')) return 'json';
  if (raw.includes('+++')) return 'toml';
  return 'yaml'; // Default Hugo format
};
```

#### 5.2 Schema-Driven Defaults
```typescript
const applySchemaDefaults = (frontmatter: Record<string, any>, schema: any) => {
  // Apply schema defaults for missing fields
  // Preserve existing user values
  // Handle nested objects and arrays
};
```

## Migration Strategy

### Phase 1: Foundation (Week 1-2)
- [ ] Database schema updates (pageSettingsJsonSchema & pageSettingsUiSchema columns)
- [ ] Basic frontmatter parsing and form generation
- [ ] Settings modal dual-view implementation (Form + Raw Editor)
- [ ] Theme-based schema loading
- [ ] Document store integration

### Phase 2: Form Features (Week 3-4)
- [ ] Advanced field types (date pickers, tag inputs, image selectors)
- [ ] Conditional field display based on page type
- [ ] Real-time validation and error handling
- [ ] Format preservation (YAML/TOML/JSON)
- [ ] Default value injection from schema

### Phase 3: Theme Integration (Week 5-6)
- [ ] Theme-specific frontmatter schemas
- [ ] Popular Hugo theme schema creation (Ananke, Academic, etc.)
- [ ] Schema validation and testing
- [ ] Fallback handling for themes without schemas

### Phase 4: Advanced Features (Week 7-8)
- [ ] Frontmatter templates and presets
- [ ] Bulk frontmatter operations
- [ ] Import/export frontmatter configurations
- [ ] Advanced validation rules

## User Experience Design

### 1. Modal Structure
```
Settings Modal Layout:
├── Header (Toggle: Form View / Raw Editor)
├── Form Content (react-jsonschema-form)
│   ├── Basic Fields (title, date, draft)
│   ├── Page Type Selector
│   ├── Conditional Fields (based on page type)
│   └── Advanced Fields (collapsible)
├── Validation Messages
└── Footer (Save, Cancel)
```

### 2. Form UX Patterns
- **Smart Defaults**: Pre-filled based on page type and theme
- **Progressive Disclosure**: Advanced fields collapsed by default
- **Inline Validation**: Real-time feedback with helpful error messages
- **Format Preservation**: Maintain user's preferred frontmatter format
- **Quick Toggle**: Easy switch between form and raw editor

### 3. Theme Integration
- **Auto-Detection**: Detect theme from document and load appropriate schema
- **Fallback Handling**: Graceful degradation when no schema is available
- **Schema Inheritance**: Common fields + theme-specific extensions

## Data Flow Architecture

### 1. Schema Loading
```
Document Load → Detect Theme → Fetch Page Schema → Generate Form Fields
```

### 2. Form Interaction
```
User Input → Validate Field → Update Form State → Sync with Document Store
```

### 3. Save Process
```
Form Data → Convert to Frontmatter Format → Update Document → Save to GitHub
```

### 4. Format Preservation
```
Original Format Detection → Form Editing → Convert Back to Original Format
```

## Technical Dependencies

### New Dependencies
```json
{
  "@rjsf/core": "^6.0.0-beta.18",        // Already installed
  "@rjsf/utils": "^6.0.0-beta.18",       // Already installed
  "@rjsf/validator-ajv8": "^6.0.0-beta.18", // Already installed
  "@rjsf/mui": "^6.0.0-beta.18",         // Already installed
  "gray-matter": "^4.0.3",               // Already installed
  "smol-toml": "^1.4.2",                 // Already installed
  "flat": "^6.0.1"                       // Already installed
}
```

**Note**: All required dependencies are already installed from the Hugo Settings Form implementation.

### Infrastructure Requirements
- Enhanced Convex queries for page schema retrieval
- Additional database storage for page-specific schemas
- Integration with existing document save pipeline

## Risk Assessment

### High Risk
1. **Format Compatibility**: Different frontmatter formats may have parsing edge cases
   - **Mitigation**: Comprehensive testing with real Hugo sites, fallback to raw editor

2. **Schema Complexity**: Complex conditional schemas may be difficult to manage
   - **Mitigation**: Start with simple schemas, gradual complexity increase

### Medium Risk
1. **Theme Coverage**: Not all Hugo themes will have schemas initially
   - **Mitigation**: Generic schema for common fields, community schema contributions

2. **Performance**: Large frontmatter objects may cause slow form rendering
   - **Mitigation**: Field virtualization, lazy loading, schema optimization

### Low Risk
1. **User Adoption**: Users may prefer raw editing for complex cases
   - **Mitigation**: Dual-view approach, easy toggle between form and raw editor

## Success Criteria

### Functional Requirements
- [ ] Support for YAML, TOML, and JSON frontmatter formats
- [ ] Theme-aware form generation
- [ ] Seamless integration with existing document workflow
- [ ] Format preservation during editing

### Performance Requirements
- [ ] Form renders in < 1 second
- [ ] No performance degradation compared to Monaco editor
- [ ] Smooth transitions between form and raw views

### User Experience Requirements
- [ ] 90% task completion rate for common frontmatter editing
- [ ] Reduced support requests related to frontmatter syntax
- [ ] Positive user feedback on ease of use

## Future Considerations

### Phase 2 Features
- [ ] Frontmatter templates based on content type
- [ ] Bulk frontmatter operations across multiple pages
- [ ] Integration with Hugo content types and archetypes
- [ ] Advanced field types (color picker, rich text, file browser)

### Technical Debt
- [ ] Optimize schema storage and caching
- [ ] Implement schema versioning
- [ ] Add comprehensive audit logging for frontmatter changes

---

## Implementation Summary

### Key Differences from Hugo Settings Form
1. **Single Document Focus**: Frontmatter editing affects one document, not multiple config files
2. **Format Preservation**: Must maintain original frontmatter format (YAML/TOML/JSON)
3. **Simpler Data Flow**: No multi-file coordination or complex key escaping needed
4. **Theme Integration**: Schema selection based on document theme, not site theme
5. **Modal Interface**: Embedded in modal dialog, not dedicated page

### Reusable Components from Settings Form
- RJSF form integration and MUI theming
- Schema loading and validation logic
- Form state management patterns
- Error handling and user feedback systems

### New Components Needed
- Frontmatter format detection and preservation
- Document store integration for frontmatter
- Theme-based schema selection
- Modal-specific form layout and navigation

---

**Document Version**: 1.0  
**Created**: December 19, 2024  
**Status**: 📋 **PLANNING**  
**Next Review**: December 26, 2024
