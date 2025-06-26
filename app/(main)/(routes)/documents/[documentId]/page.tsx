"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Cover } from "@/components/cover";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsModal } from "@/components/modals/settings-modal";
import { use } from "react";
import Editor from "@monaco-editor/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAction } from "convex/react";
import { Spinner } from "@/components/spinner";
import Image from "next/image";
import { Loader } from "@/components/loader";

interface DocumentIdPageProps {
    params: Promise<{
        documentId: Id<"documents">;
    }>;
}
const DocumentIdPage = ({ params }: DocumentIdPageProps) => {
    const { documentId } = use(params);
    const document = useQuery(api.documents.getById, {
        documentId: documentId
    });

    // --- Config Editor State and Logic ---
    const [config, setConfig] = useState<string>("");
    const [configPath, setConfigPath] = useState<string>("");
    const [configLoading, setConfigLoading] = useState<boolean>(true);
    const [configError, setConfigError] = useState<string | null>(null);
    const fetchConfig = useAction(api.github.fetchConfigFile);
    const parseAndSaveSettingsObject = useAction(api.github.parseAndSaveSettingsObject);

    useEffect(() => {
        async function loadConfig() {
            try {
                setConfigLoading(true);
                setConfigError(null);
                const result = await fetchConfig({ id: documentId });
                if (result && result.content && result.path) {
                    setConfig(result.content);
                    setConfigPath(result.path);
                } else {
                    setConfigError("Could not load configuration file or file is empty.");
                }
            } catch (err) {
                setConfigError((err as Error).message);
            } finally {
                setConfigLoading(false);
            }
        }
        if (documentId && document && document.buildStatus && document.buildStatus === "BUILT") {
            loadConfig();
        }
    }, [documentId, fetchConfig, document?.buildStatus]);

    const handleConfigEditorChange = (value: string | undefined) => {
        setConfig(value || "");
    };

    const handleConfigSave = async () => {
        try {
            await parseAndSaveSettingsObject({
                id: documentId,
                newSettings: config,
                configPath: configPath,
            });
            // Optionally reload config after save
            setConfigError(null);
        } catch (err) {
            setConfigError("Invalid JSON: " + (err as Error).message);
        }
    };

    const getEditorLanguage = () => {
        if (!configPath) return "plaintext";
        const extension = configPath.split('.').pop()?.toLowerCase();
        switch (extension) {
            case "toml":
                return "ini";
            case "yaml":
            case "yml":
                return "yaml";
            case "json":
                return "json";
            default:
                return "plaintext";
        }
    };

    if (document === undefined) {
        return (
            <div>
                <Cover.Skeleton />
                <div className="md:max-w-3xl lg:max-w-4xl mx-auto mt-10">
                    <div className="space-y-4 pl-8 pt-4">
                        <Skeleton className="h-14 w-[50%]" />
                        <Skeleton className="h-4 w-[80%]" />
                        <Skeleton className="h-4 w-[40%]" />
                        <Skeleton className="h-4 w-[60%]" />
                    </div>
                </div>
            </div>
        );
    }

    if (document === null) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Image
                    src="/documents.png"
                    height="300"
                    width="300"
                    alt="Error"
                    className="dark:hidden"
                />
                <Image
                    src="/documents-dark.png"
                    height="300"
                    width="300"
                    alt="Error"
                    className="hidden dark:block"
                />
                <p className="text-muted-foreground text-lg">
                    We are having trouble loading your site. Please try again later.
                </p>
            </div>
        );
    }

    if (document.buildStatus === "BUILDING") {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-6">
                <div className="flex flex-col items-center gap-2">
                    <div className="p-8 bg-secondary/10 rounded-full w-[120px] h-[120px] flex items-center justify-center">
                        <Loader size="default" variant="muted" />
                    </div>
                    <h2 className="text-2xl font-bold mt-4">Building Your Website</h2>
                    <p className="text-muted-foreground text-center">
                        Please wait while we create your beautiful website.<br />
                        This will only take a few seconds...
                    </p>
                </div>
            </div>
        );
    }

    if (document.buildStatus === "ERROR") {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Image
                    src="/error.png"
                    height="300"
                    width="300"
                    alt="Error"
                    className="dark:hidden"
                />
                <Image
                    src="/error-dark.png"
                    height="300"
                    width="300"
                    alt="Error"
                    className="hidden dark:block"
                />
                <h2 className="text-2xl font-bold">Build Failed</h2>
                <p className="text-muted-foreground text-lg text-center">
                    We encountered an error while building your website.<br />
                    Please contact support.
                </p>
            </div>
        );
    }

    if (configError && document.buildStatus === "BUILT") {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Image
                    src="/documents.png"
                    height="300"
                    width="300"
                    alt="Error"
                    className="dark:hidden"
                />
                <Image
                    src="/documents-dark.png"
                    height="300"
                    width="300"
                    alt="Error"
                    className="hidden dark:block"
                />
                <h2 className="text-2xl font-bold">Configuration Error</h2>
                <p className="text-muted-foreground text-lg text-center">
                    We couldn&apos;t fetch your config file.<br />
                    Please check your configuration and try again.
                </p>
            </div>
        );
    }

    if (configLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Spinner size="lg" />
            </div>
        );
    }

    return ( 
        <div className="pb-40">
            <div className="md:max-w-3xl lg:max-w-4xl mx-auto">
                <div className="p-6 border rounded bg-muted">
                    <h2 className="text-lg font-semibold mb-2">Site Configuration</h2>
                    <p className="mb-4 text-sm text-muted-foreground">Modify your site settings. Click save when you&apos;re done.</p>
                    <div className="grid gap-4 py-4 overflow-y-auto" style={{ maxHeight: "400px" }}>
                        <Editor
                            height="500px"
                            defaultLanguage="ini"
                            language={getEditorLanguage()}
                            value={config}
                            onChange={handleConfigEditorChange}
                            theme="vs-dark"
                        />
                    </div>
                    <div className="flex justify-end mt-4">
                        <Button type="button" onClick={handleConfigSave}>
                            Save changes
                        </Button>
                    </div>
                </div>
            </div>
            <SettingsModal />
        </div>
     );
}
 
export default DocumentIdPage;