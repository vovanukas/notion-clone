"use client";

import { useParams } from "next/navigation";

import { Spinner } from "@/components/spinner";
import { useConvexAuth } from "convex/react";
import { redirect } from "next/navigation";
import { Navigation } from "./_components/navigation";
import { AppSidebar } from "./_components/app-sidebar";
import { SearchCommand } from "@/components/search-command";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Navbar } from "./_components/navbar";

const MainLayout = ({
    children
}: {
    children: React.ReactNode;
}) => {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const params = useParams();

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Spinner size="lg" />
            </div>
        )
    }

    if (!isAuthenticated) {
        return redirect("/");
    }
    return ( 
      <div className="[--header-height:calc(theme(spacing.14))]">
        <SidebarProvider className="flex flex-col">
          <Navbar />
          {/* <Navigation /> */}
          <div className="flex flex-1">
            <AppSidebar />
            <SidebarInset>
              <div className="h-full dark:bg-[#1F1F1F]">
                  <main className="flex-1 h-full overflow-y-auto">
                      <SearchCommand />
                      {children}
                  </main>
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </div>
     );
}
 
export default MainLayout;