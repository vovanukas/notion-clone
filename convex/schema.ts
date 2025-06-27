import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    documents: defineTable({
        title: v.string(),
        userId: v.string(),
        isArchived: v.boolean(),
        parentDocument: v.optional(v.id("documents")),
        content: v.optional(v.string()),
        coverImage: v.optional(v.string()),
        icon: v.optional(v.string()),
        isPublished: v.boolean(),
        buildStatus: v.optional(v.union(v.literal("BUILDING"), v.literal("BUILT"), v.literal("ERROR"))),
        publishStatus: v.optional(v.union(v.literal("PUBLISHING"), v.literal("PUBLISHED"), v.literal("UNPUBLISHED"), v.literal("ERROR"))),
        websiteUrl: v.optional(v.any()),
    })
    .index("by_user", ["userId"])
    .index("by_user_parent", ["userId", "parentDocument"]),
    
    hugoTemplates: defineTable({
        name: v.string(),
        description: v.string(),
        previewImage: v.string(),
        demoLink: v.optional(v.string()),
        repositoryUrl: v.string(),
        folderName: v.string(),
        features: v.array(v.string()),
        category: v.string(),
        isActive: v.boolean(),
    })
    .index("by_active", ["isActive"])
    .index("by_category", ["category"])
})