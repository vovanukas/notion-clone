import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Seed templates with the available Hugo themes
export const seedTemplates = mutation({
    args: {},
    handler: async (ctx) => {
        const templates = [
            {
                name: "Ananke",
                description: "A clean, responsive theme for blogs and documentation sites. Features a modern design with excellent typography and navigation.",
                previewImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=300&fit=crop&crop=center",
                demoLink: "https://themes.gohugo.io/themes/gohugo-theme-ananke/",
                repositoryUrl: "https://github.com/vovanukas/hugo-sites",
                folderName: "ananke",
                features: ["Blog", "Documentation", "Responsive", "Clean Design", "Fast"],
                category: "blog",
                isActive: true,
            },
            {
                name: "Long Teng",
                description: "A beautiful, minimalist theme perfect for personal blogs and portfolios. Features elegant typography and smooth animations.",
                previewImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=300&fit=crop&crop=center",
                demoLink: "https://themes.gohugo.io/themes/hugo-theme-long-teng/",
                repositoryUrl: "https://github.com/vovanukas/hugo-sites",
                folderName: "long-teng",
                features: ["Portfolio", "Minimalist", "Elegant", "Personal Blog", "Smooth Animations"],
                category: "portfolio",
                isActive: true,
            },
            {
                name: "Dot Hugo",
                description: "A comprehensive documentation theme with advanced search, multi-language support, and clean design perfect for knowledge bases.",
                previewImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop&crop=center",
                demoLink: "https://themes.gohugo.io/themes/dot-hugo/",
                repositoryUrl: "https://github.com/vovanukas/hugo-sites",
                folderName: "dot-hugo",
                features: ["Documentation", "Search", "Multi-language", "Knowledge Base", "Clean Design"],
                category: "docs",
                isActive: true,
            }
        ];

        const results = [];
        for (const template of templates) {
            const existing = await ctx.db
                .query("hugoTemplates")
                .withIndex("by_active", (q) => q.eq("isActive", true))
                .filter((q) => q.eq(q.field("folderName"), template.folderName))
                .first();

            if (!existing) {
                const result = await ctx.db.insert("hugoTemplates", template);
                results.push(result);
            }
        }

        return results;
    }
});

export const getTemplates = query({
    args: {
        category: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        if (args.category) {
            return await ctx.db
                .query("hugoTemplates")
                .withIndex("by_category", (q) => q.eq("category", args.category!))
                .filter((q) => q.eq(q.field("isActive"), true))
                .collect();
        }

        return await ctx.db
            .query("hugoTemplates")
            .withIndex("by_active", (q) => q.eq("isActive", true))
            .collect();
    }
});

export const getTemplateByFolder = query({
    args: {
        folderName: v.string()
    },
    handler: async (ctx, args) => {
        const template = await ctx.db
            .query("hugoTemplates")
            .withIndex("by_active", (q) => q.eq("isActive", true))
            .filter((q) => q.eq(q.field("folderName"), args.folderName))
            .first();

        return template;
    }
});

export const getTemplateCategories = query({
    args: {},
    handler: async (ctx) => {
        const templates = await ctx.db
            .query("hugoTemplates")
            .withIndex("by_active", (q) => q.eq("isActive", true))
            .collect();

        // Get unique categories
        const uniqueCategories = [...new Set(templates.map(t => t.category))];
        
        // Create category objects with counts
        const categories = uniqueCategories.map(category => ({
            id: category,
            name: category.charAt(0).toUpperCase() + category.slice(1),
            count: templates.filter(t => t.category === category).length
        }));

        return categories;
    }
}); 

export const getPageSettingsSchema = query({
    args: {
        folderName: v.string()
    },
    handler: async (ctx, args) => {
        const template = await ctx.db
            .query("hugoTemplates")
            .withIndex("by_active", (q) => q.eq("isActive", true))
            .filter((q) => q.eq(q.field("folderName"), args.folderName))
            .first();

        if (!template) {
            return null;
        }

        return {
            jsonSchema: template.pageSettingsJsonSchema,
            uiSchema: template.pageSettingsUiSchema
        };
    }
});