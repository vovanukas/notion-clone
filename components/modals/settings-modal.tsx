"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { useSettings } from "@/hooks/use-settings";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/mode-toggle";

export const SettingsModal = () => {
    const settings = useSettings();

    return(
        <Dialog open={settings.isOpen} onOpenChange={settings.onClose}>
            <DialogContent>
                <DialogTitle className="hidden">
                </DialogTitle>
                <DialogHeader className="border-b pb-3">
                    <h2 className="text-lg font-medium">
                        Settings
                    </h2>
                </DialogHeader>
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-y-1">
                        <Label>
                            Appearance
                        </Label>
                        <span>
                            Modify how Jotion looks on your device
                        </span>
                    </div>
                </div>
                <ModeToggle />
            </DialogContent>
        </Dialog>
    )
}