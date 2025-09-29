# Product Requirements Document: Hugo Settings Form

## Project Overview

Transform the current Monaco editor-based Hugo configuration interface into a user-friendly form system using react-jsonschema-form. This will enable non-technical users to manage their Hugo site settings through a structured, categorized interface while maintaining support for complex Hugo configuration patterns.

## Current State Analysis

### Existing System
- **Configuration Interface**: Monaco editor with tabs for multiple config files (`app/(main)/(routes)/documents/[documentId]/page.tsx`)
- **Database**: Convex with `documents` and `hugoTemplates` tables
- **Config Handling**: Supports both single config files (hugo.toml) and directory structures (config/_default/)
- **File Management**: GitHub integration for reading/writing config files

### Current Limitations
- Requires technical knowledge of TOML/YAML/JSON syntax
- No validation or guidance for configuration options
- Complex Hugo configuration patterns are difficult to manage
- No categorization or grouping of related settings

## Goals & Objectives

### Primary Goals
1. **User-Friendly Interface**: Replace code editor with intuitive form controls
2. **Non-Technical Accessibility**: Enable users without coding knowledge to configure sites
3. **Complex Config Support**: Handle Hugo's sophisticated configuration patterns
4. **Theme-Specific Schemas**: Provide customized settings based on selected theme
5. **Dynamic Categorization**: Organize settings from multiple files into logical groups

### Success Metrics
- Reduce configuration errors by 80%
- Increase user engagement with settings by 60%
- Support for 100% of existing Hugo configuration patterns
- Zero breaking changes to existing Hugo sites

## Technical Requirements

### 1. Database Schema Extensions

#### 1.1 Update hugoTemplates Table (Implemented)
```typescript
hugoTemplates: defineTable({
    // ... existing fields ...
    settingsJsonSchema: v.optional(v.record(v.string(), v.any())), // JSON Schema object
    settingsUiSchema: v.optional(v.record(v.string(), v.any())),   // UI Schema object
})
```

**Implementation Details**: 
- **settingsJsonSchema**: Stores the complete JSON Schema for form generation (as object, not string)
- **settingsUiSchema**: Stores the UI Schema for react-jsonschema-form customization (as object, not string)
- **Field path mappings**: Embedded in field names using the "filePath/configKey" convention
- **Default values**: Included within the JSON schema structure

**Benefits of Object Storage**:
- No JSON parsing/stringifying needed
- Direct object access in queries
- Better type safety with Convex
- Easier to update individual schema properties

### 2. Form Schema Structure

#### 2.1 Field Path Convention
Use dot notation combining file path and configuration key:
```typescript
interface FieldPath {
    format: "filePath/configKey" | "filePath/section.configKey"
    examples: [
        "hugo.toml/baseURL",
        "config/_default/params.toml/logo",
        "config/_default/params.toml/navigation_button.enable"
    ]
}
```

#### 2.2 Schema Structure
```json
{
  "type": "object",
  "properties": {
    "general": {
      "title": "General Settings",
      "type": "object",
      "properties": {
        "hugo.toml/baseURL": {
          "type": "string",
          "format": "uri",
          "title": "Site URL",
          "description": "The base URL of your website"
        },
        "hugo.toml/title": {
          "type": "string",
          "title": "Site Title",
          "description": "The title of your website"
        }
      }
    },
    "navigation": {
      "title": "Navigation Settings",
      "type": "object",
      "properties": {
        "config/_default/params.toml/navigation_button.enable": {
          "type": "boolean",
          "title": "Enable Navigation Button",
          "default": true
        },
        "config/_default/params.toml/navigation_button.label": {
          "type": "string",
          "title": "Button Label",
          "default": "Get Started"
        }
      }
    },
    "content": {
      "title": "Content Settings",
      "type": "object",
      "properties": {
        "config/_default/params.toml/blog.posts_per_page": {
          "type": "integer",
          "title": "Posts Per Page",
          "minimum": 1,
          "maximum": 50,
          "default": 10
        }
      }
    }
  }
}
```

#### 2.3 Hugo-Specific Pattern Support

##### TOML Tables
```json
{
  "config/_default/params.toml/social": {
    "type": "object",
    "title": "Social Media Links",
    "properties": {
      "twitter": {"type": "string", "format": "uri"},
      "facebook": {"type": "string", "format": "uri"},
      "linkedin": {"type": "string", "format": "uri"}
    },
    "additionalProperties": true
  }
}
```

##### TOML Arrays (Hugo Menus)
```json
{
  "config/_default/menus.toml/main": {
    "type": "array",
    "title": "Main Navigation Menu",
    "items": {
      "type": "object",
      "properties": {
        "name": {"type": "string", "title": "Menu Item Name"},
        "url": {"type": "string", "title": "URL"},
        "weight": {"type": "integer", "title": "Order", "minimum": 1}
      },
      "required": ["name", "url", "weight"]
    }
  }
}
```

### 3. Frontend Components ✅ IMPLEMENTED

#### 3.1 Implemented Components Structure
```
app/(main)/(routes)/documents/[documentId]/settings/
  page.tsx                    # Main settings page with RJSF form

app/(main)/_components/
  app-sidebar.tsx             # Updated with dynamic settings navigation

hooks/
  use-settings.tsx            # Simplified Zustand store for settings state
  
components/ui/
  skeleton.tsx                # Loading states for settings page
```

#### 3.2 Key Implementation Details
- **Settings Page**: `/documents/[documentId]/settings` route with react-jsonschema-form
- **Navigation**: Hash-based navigation (`#general`, `#appearance`, etc.)
- **Schema Loading**: Direct integration with Convex `getTemplateByFolder` query
- **State Management**: Simplified Zustand store with `currentSection` and `formData`
- **Theme Integration**: MUI dark theme optimized for form readability
- **Loading States**: Skeleton components while schema loads
- **Section Ordering**: Uses UI schema `ui:order` array for proper section sequence

#### 3.2 Settings Form Component
```typescript
interface SettingsFormProps {
  documentId: Id<"documents">;
  theme: string;
  onSave: (formData: any) => Promise<void>;
}

interface FormData {
  [categoryKey: string]: {
    [fieldPath: string]: any;
  };
}
```

#### 3.3 Configuration Mapping Logic
```typescript
interface ConfigFileMapping {
  filePath: string;
  format: 'toml' | 'yaml' | 'json';
  content: Record<string, any>;
}

function mapFormDataToConfigFiles(
  formData: FormData,
  schema: JSONSchema7
): ConfigFileMapping[] {
  // Logic to convert form data back to individual config files
  // Handle nested objects, arrays, and Hugo-specific patterns
}
```

### 4. Backend API Extensions

#### 4.1 New Convex Functions
```typescript
// convex/hugoTemplates.ts (Updated)
export const getTemplateWithSchema = query({
  args: { folderName: v.string() },
  handler: async (ctx, args) => {
    const template = await ctx.db
      .query("hugoTemplates")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter((q) => q.eq(q.field("folderName"), args.folderName))
      .first();
    
    return template; // Includes settingsJsonSchema and settingsUiSchema
  }
});

export const updateTemplateSchema = mutation({
  args: { 
    templateId: v.id("hugoTemplates"),
    settingsJsonSchema: v.optional(v.record(v.string(), v.any())),
    settingsUiSchema: v.optional(v.record(v.string(), v.any()))
  },
  handler: async (ctx, args) => {
    const { templateId, ...schemaData } = args;
    return await ctx.db.patch(templateId, schemaData);
  }
});

// New settings-specific functions
export const saveFormSettings = action({
  args: { 
    documentId: v.id("documents"),
    formData: v.any(),
    jsonSchema: v.record(v.string(), v.any())
  },
  handler: async (ctx, args) => {
    // Convert form data to config files and save via GitHub API
  }
});
```

#### 4.2 Configuration Parser Service (Using grey-matter)
```typescript
import matter from 'grey-matter';

class HugoConfigParser {
  static parseConfigFile(content: string, filePath: string): {
    data: Record<string, any>;
    content: string;
    matter: string;
  } {
    // Use grey-matter to parse TOML/YAML frontmatter and content
    const parsed = matter(content, {
      engines: {
        toml: matter.engines.toml,
        yaml: matter.engines.yaml
      }
    });
    return parsed;
  }

  static updateConfigValue(
    originalContent: string, 
    keyPath: string, 
    newValue: any,
    format: 'toml' | 'yaml' | 'json'
  ): string {
    // Strategy: Full file rewrite for MVP simplicity
    // Parse entire file, update specific key, regenerate
    const parsed = this.parseConfigFile(originalContent, '');
    
    // Update nested key using dot notation
    this.setNestedValue(parsed.data, keyPath, newValue);
    
    // Regenerate file content
    return matter.stringify('', parsed.data, { language: format });
  }

  private static setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }
}
```

**Parsing Strategy Decision**: 
- **Full File Rewrite** for MVP: Simpler implementation, less error-prone
- grey-matter handles TOML/YAML parsing automatically
- Preserves file structure and comments where possible
- Future enhancement: In-place editing for better comment preservation

### 5. Migration Strategy

#### 5.1 Phase 1: Foundation (Week 1-2) ✅ COMPLETED
- [x] Database schema updates (settingsJsonSchema & settingsUiSchema columns added)
- [x] Basic form component structure with RJSF
- [x] Schema loading and validation using Convex
- [x] Simple field types (string, boolean, number, arrays, objects)
- [x] Ananke template seeded with complete schema
- [x] Settings state management with Zustand
- [x] Hash-based navigation system
- [x] Loading states and error handling
- [x] MUI dark theme integration

#### 5.2 Phase 2: Frontend Integration ✅ COMPLETED  
- [x] Dedicated `/settings` route implementation
- [x] Dynamic sidebar navigation based on schema sections
- [x] Schema-ordered section display (not alphabetical)
- [x] Smooth scrolling to specific settings sections
- [x] Settings form rendering with react-jsonschema-form
- [x] Form data state management and updates
- [x] Responsive loading skeletons
- [x] Client-side navigation with hash fragments

#### 5.3 Phase 3: Hugo Patterns (Week 3-4) - IN PROGRESS
- [ ] TOML table support
- [ ] TOML array support (Hugo menus)
- [ ] Configuration file mapping using grey-matter
- [ ] Form data to Hugo config file conversion
- [ ] Save functionality with GitHub API integration

#### 5.4 Phase 4: Advanced Features (Week 5-6)
- [ ] Theme-specific schemas for multiple themes
- [ ] Advanced field types (color picker, image upload)
- [ ] Configuration preview mode
- [ ] Enhanced validation and error handling

#### 5.5 Phase 5: Migration & Testing (Week 7-8)
- [ ] Existing config import functionality  
- [ ] A/B testing with current Monaco editor
- [ ] User testing and feedback
- [ ] Performance optimization

## User Experience Design

### 1. Page Structure
```
Settings Page Layout:
├── Header (Save Button, Theme Indicator)
├── Navigation Tabs (Based on Schema Categories)
│   ├── General
│   ├── Navigation  
│   ├── Content
│   ├── Design
│   └── Advanced
├── Form Content (react-jsonschema-form)
├── Preview Panel (Collapsible)
└── Footer (Reset, Export, Import)
```

### 2. Sidebar Integration
Update `app-sidebar.tsx` to dynamically populate settings menu:
```typescript
const settingsMenuItems = [
  { id: 'general', label: 'General Settings', icon: Settings },
  { id: 'navigation', label: 'Navigation', icon: Menu },
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'advanced', label: 'Advanced', icon: Code }
];
```

### 3. Form UX Patterns
- **Progressive Disclosure**: Advanced settings collapsed by default
- **Smart Defaults**: Pre-filled based on theme
- **Inline Validation**: Real-time feedback
- **Help System**: Contextual tooltips and documentation links
- **Preview Mode**: Show how settings affect the site

## Data Flow Architecture

### 1. Schema Loading
```
User selects theme → Fetch schema from DB → Parse JSON Schema → Generate form
```

### 2. Form Interaction
```
User modifies field → Validate input → Update form state → Show preview
```

### 3. Save Process
```
User clicks save → Validate form → Map to config files → Save via GitHub API → Trigger rebuild
```

### 4. Error Handling
```
Validation error → Show inline message → Prevent save
API error → Show toast notification → Retry mechanism
```

## Testing Strategy

### 1. Manual Testing (MVP Approach)
- [ ] Manual verification of form generation from schema
- [ ] Manual testing of configuration file updates
- [ ] Cross-browser compatibility testing
- [ ] Theme switching scenarios

### 2. Integration Tests
- [ ] End-to-end form submission
- [ ] GitHub API integration
- [ ] Database operations
- [ ] Theme switching scenarios

### 3. User Acceptance Tests
- [ ] Non-technical user can configure basic settings
- [ ] Complex Hugo patterns work correctly
- [ ] No data loss during migration
- [ ] Performance meets requirements

## Risk Assessment

### High Risk
1. **Data Loss**: During migration from Monaco editor to form
   - **Mitigation**: Backup system, gradual rollout, revert capability

2. **Complex Hugo Patterns**: Not all configurations can be form-ized
   - **Mitigation**: Hybrid approach, fallback to raw editor for complex cases

### Medium Risk
1. **Performance**: Large schemas may cause slow rendering
   - **Mitigation**: Lazy loading, field virtualization, caching

2. **Theme Compatibility**: Existing themes may not have schemas
   - **Mitigation**: Default schema generation, manual schema creation tools

### Low Risk
1. **User Adoption**: Users may prefer code editor
   - **Mitigation**: A/B testing, user feedback, optional toggle

## Success Criteria

### Functional Requirements
- [ ] Support for all Hugo configuration patterns
- [ ] Theme-specific form generation
- [ ] Error-free configuration saving
- [ ] Backward compatibility with existing sites

### Performance Requirements
- [ ] Form renders in < 2 seconds
- [ ] Save operation completes in < 10 seconds
- [ ] No memory leaks during long sessions

### User Experience Requirements
- [ ] 90% task completion rate for non-technical users
- [ ] < 5 support tickets per week related to configuration
- [ ] Positive user feedback (> 4.0/5.0 rating)

## Technical Dependencies

### New Dependencies ✅ INSTALLED
```json
{
  "@rjsf/core": "^6.0.0-beta.18",
  "@rjsf/utils": "^6.0.0-beta.18", 
  "@rjsf/validator-ajv8": "^6.0.0-beta.18",
  "@rjsf/mui": "^6.0.0-beta.18",
  "gray-matter": "^4.0.3"
}
```

**Implementation Notes**:
- Upgraded to RJSF v6 beta for better React 18+ compatibility
- Removed unused `@rjsf/shadcn` package
- MUI theme provides better dark mode support than shadcn variant

**Note**: grey-matter already includes TOML and YAML parsing engines, eliminating the need for separate parsing libraries.

### Infrastructure Requirements
- Additional Convex database storage for schemas
- Enhanced GitHub API rate limiting handling
- Caching layer for frequently accessed schemas

## Monitoring & Analytics

### Metrics to Track
1. **Usage Metrics**
   - Form completion rates
   - Time spent on settings page
   - Most/least used settings categories

2. **Error Metrics**
   - Validation error frequency
   - Save operation failures
   - Schema parsing errors

3. **Performance Metrics**
   - Form load times
   - Save operation duration
   - Memory usage patterns

### Alerting
- Settings save failure rate > 5%
- Form load time > 5 seconds
- Schema validation errors > 10/hour

## Future Considerations

### Phase 2 Features
- [ ] Visual theme customization
- [ ] Setting templates and presets
- [ ] Multi-language configuration support
- [ ] Collaborative editing capabilities

### Technical Debt
- [ ] Migrate from Monaco editor completely
- [ ] Optimize schema storage and retrieval
- [ ] Implement proper versioning for schemas
- [ ] Add comprehensive audit logging

---

## Implementation Summary ✅

### ✅ **Completed (Phase 1 & 2)**
The frontend form interface has been **successfully implemented** with the following key features:

#### **Core Implementation**
- **Database Schema**: `settingsJsonSchema` and `settingsUiSchema` columns added to `hugoTemplates`
- **Settings Route**: `/documents/[documentId]/settings` with full RJSF integration
- **Dynamic Navigation**: Sidebar automatically generates menu from schema sections
- **Schema Ordering**: Respects `ui:order` from UI schema (not alphabetical)
- **State Management**: Clean Zustand store with minimal complexity
- **Loading States**: Professional skeleton loading components
- **Hash Navigation**: Deep linking to specific sections (`#general`, `#appearance`)
- **Responsive Design**: Optimized for all screen sizes
- **Dark Mode**: Custom MUI theme for excellent readability

#### **Technical Architecture**
- **RJSF v6 Beta**: Latest version with React 18+ support
- **MUI Theme**: Superior dark mode experience vs shadcn
- **Convex Integration**: Direct schema loading via `getTemplateByFolder`
- **Code Quality**: Zero linting errors, optimized performance
- **Simplified State**: Removed unnecessary complexity from original design

### ⏳ **Next Phase: Backend Integration**
The next milestone is implementing the **save functionality**:
- Form data to Hugo config file mapping
- Integration with grey-matter for TOML/YAML parsing  
- GitHub API integration for file updates
- Configuration preview and validation

---

**Document Version**: 2.0  
**Last Updated**: September 29, 2025  
**Next Review**: October 13, 2025
