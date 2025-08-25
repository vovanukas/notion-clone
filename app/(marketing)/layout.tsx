"use client";

import { Navbar } from "./_components/navbar";
import { ConvexClientProvider } from "@/components/providers/convex-provider";

const MarketingLayout = ({
    children
}: {
    children: React.ReactNode;
}) => {
    return ( 
        <ConvexClientProvider>
            <div className="h-full dark:bg-[#1F1F1F]">
                <Navbar />
                <main className="h-full pt-40">
                    {children}
                </main>
            </div>
        </ConvexClientProvider>
     );
}
 
export default MarketingLayout;