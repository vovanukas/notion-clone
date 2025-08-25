"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTemplateSelector } from "@/hooks/use-template-selector";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ExternalLink, Check, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface Template {
  _id: string;
  name: string;
  description: string;
  previewImage: string;
  demoLink?: string;
  repositoryUrl: string;
  folderName: string;
  features: string[];
  category: string;
  isActive: boolean;
}

interface TemplateSelectorModalProps {
  onConfirm?: () => void;
}

export const TemplateSelectorModal = ({ onConfirm }: TemplateSelectorModalProps) => {
  const templateSelector = useTemplateSelector();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  // Fetch all templates once
  const allTemplates = useQuery(api.hugoTemplates.getTemplates, {});
  
  // Fetch categories separately for better performance
  const dbCategories = useQuery(api.hugoTemplates.getTemplateCategories, {});
  
  // Filter templates based on selected category
  const filteredTemplates = useMemo(() => {
    if (!allTemplates) return [];
    if (selectedCategory === "all") return allTemplates;
    return allTemplates.filter((template: Template) => template.category === selectedCategory);
  }, [allTemplates, selectedCategory]);

  // Build categories array with "All Templates" option
  const categories = useMemo(() => {
    if (!dbCategories || !allTemplates) return [];
    
    return [
      { id: "all", name: "All Templates", count: allTemplates.length },
      ...dbCategories
    ];
  }, [dbCategories, allTemplates]);

  const handleTemplateSelect = (template: Template) => {
    templateSelector.onSelect(template.folderName);
  };

  const handlePreview = (demoLink: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(demoLink, "_blank");
  };

  const handleConfirm = () => {
    templateSelector.onConfirm();
    if (onConfirm) {
      onConfirm();
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  return (
    <Dialog open={templateSelector.isOpen} onOpenChange={templateSelector.onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Choose Your Template</DialogTitle>
          <DialogDescription className="text-base">
            Select a Hugo template to start building your website. Each template comes with a complete setup ready for customization.
          </DialogDescription>
        </DialogHeader>

        {/* Category Filter */}
        <div className="flex gap-2 mb-6">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => handleCategoryChange(category.id)}
              className="flex items-center gap-2"
            >
              {category.name}
              <Badge variant="secondary" className="ml-1">
                {category.count}
              </Badge>
            </Button>
          ))}
        </div>

        {/* Templates Grid (scrollable area) */}
        <div className="flex-1 overflow-y-auto">
          {!allTemplates ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-gray-500 dark:text-gray-400 mb-2">
                No templates found in this category
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedCategory("all")}
              >
                View All Templates
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
              {filteredTemplates.map((template: Template) => (
                <Card
                  key={template._id}
                  className={cn(
                    "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2 group",
                    templateSelector.selectedTemplate === template.folderName
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  )}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <div className="relative">
                    <Image
                      src={template.previewImage}
                      alt={`${template.name} preview`}
                      className="w-full h-48 object-cover rounded-t-lg"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "https://via.placeholder.com/400x300?text=Preview+Not+Available";
                      }}
                    />
                    {templateSelector.selectedTemplate === template.folderName && (
                      <div className="absolute top-3 right-3 bg-blue-500 text-white rounded-full p-1">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                    {template.demoLink && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handlePreview(template.demoLink!, e)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                    )}
                  </div>
                  
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg font-semibold">{template.name}</CardTitle>
                        <CardDescription className="mt-2 text-sm leading-relaxed">
                          {template.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1 mb-3">
                      {template.features.slice(0, 4).map((feature: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                      {template.features.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.features.length - 4} more
                        </Badge>
                      )}
                    </div>
                    
                    {template.demoLink && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        onClick={(e) => handlePreview(template.demoLink!, e)}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Demo
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-background border-t py-4 px-6">
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {templateSelector.selectedTemplate ? (
                <span>Selected: <strong>{allTemplates?.find((t: Template) => t.folderName === templateSelector.selectedTemplate)?.name}</strong></span>
              ) : (
                "Choose a template to continue"
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={templateSelector.onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={!templateSelector.selectedTemplate}
              >
                Create Website
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 