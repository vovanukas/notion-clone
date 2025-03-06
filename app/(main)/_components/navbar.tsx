"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MenuIcon } from "lucide-react";

import { Title } from "./title";
import { Banner } from "./banner";
import { Menu } from "./menu";
import { Publish } from "./publish";
import { Button } from "@/components/ui/button";

export const Navbar = () => {
  const params = useParams();
  const { toggleSidebar } = useSidebar();

  if (!params.documentId) {
    return null;
  };

  const document = useQuery(api.documents.getById, {
    documentId: params.documentId as Id<"documents">,
  });

  if (document === undefined) {
    return (
      <nav className="bg-background sticky dark:bg-[#1f1f1f] px-3 py-2 w-full flex items-center justify-between">
        <Title.Skeleton />
        <div className="flex items-center gap-x-2">
          <Menu.Skeleton />
        </div>
      </nav>
    );
  };

  if (document === null) {
    return null;
  }

  return (
    <>
      <nav className="h-[--header-height] bg-background dark:bg-[#1f1f1f] px-3 py-2 w-full flex items-center gap-x-4">
        <div className="flex h-[--header-height] w-full items-center gap-2 px-4">
          <Button
            className="h-8 w-8"
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
          >
            <MenuIcon />
          </Button>
          <div className="flex items-center justify-between w-full">
            <Title initialData={document} />
            <div className="flex items-center gap-x-2">
              <Publish initialData={document} />
              <Menu documentId={document._id} />
            </div>
          </div>
        </div>
      </nav>
      {document.isArchived && <Banner documentId={document._id} />}
    </>
  );
};
