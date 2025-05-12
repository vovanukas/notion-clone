"use client";

import { File } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { Id } from "@/convex/_generated/dataModel";

interface TreeNode {
  name?: string;
  path?: string;
  type?: string;
  children?: TreeNode[];
  sha?: string;
}

interface FileItemProps {
  item: TreeNode;
}

export const FileItem = ({ item }: FileItemProps) => {
  const { name, path } = item;
  const router = useRouter();
  const params = useParams();

  const onRedirect = (documentId: string) => {
    router.push(`/documents/${documentId}/${path}`);
  };

  return (
    <SidebarMenuButton
      onClick={() => onRedirect(params.documentId as Id<"documents">)}
      className="data-[active=true]:bg-transparent"
    >
      <File />
      {name}
    </SidebarMenuButton>
  );
}; 