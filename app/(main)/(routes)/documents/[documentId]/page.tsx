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
import { Badge } from "@/components/ui/badge";

interface DocumentIdPageProps {
    params: Promise<{
        documentId: Id<"documents">;
    }>;
}

interface ConfigFile {
    content: string;
    path: string;
    name: string;
    isDirectory: boolean;
}

const DocumentIdPage = ({ params }: DocumentIdPageProps) => {
    const { documentId } = use(params);
    const document = useQuery(api.documents.getById, {
        documentId: documentId
    });

    // --- Multiple Config Files State and Logic ---
    const [configFiles, setConfigFiles] = useState<ConfigFile[]>([]);
    const [activeConfigTab, setActiveConfigTab] = useState<string>("");
    const [configLoading, setConfigLoading] = useState<boolean>(true);
    const [configError, setConfigError] = useState<string | null>(null);
    const [savingConfig, setSavingConfig] = useState<boolean>(false);
    const fetchAllConfigs = useAction(api.github.fetchAllConfigFiles);
    const saveMultipleConfigs = useAction(api.github.parseAndSaveMultipleConfigFiles);

    useEffect(() => {
        async function loadConfigs() {
            try {
                setConfigLoading(true);
                setConfigError(null);
                const result = await fetchAllConfigs({ id: documentId });
                if (result && result.length > 0) {
                    setConfigFiles(result);
                    setActiveConfigTab(result[0].path); // Set first config as active
                } else {
                    setConfigError("No configuration files found.");
                }
            } catch (err) {
                setConfigError((err as Error).message);
            } finally {
                setConfigLoading(false);
            }
        }
        if (documentId && document?.buildStatus === "BUILT") {
            loadConfigs();
        }
    }, [documentId, fetchAllConfigs, document?.buildStatus]);

    const handleConfigEditorChange = (value: string | undefined, path: string) => {
        const updatedFiles = configFiles.map(file => 
            file.path === path ? { ...file, content: value || "" } : file
        );
        setConfigFiles(updatedFiles);
    };

    const handleConfigSave = async () => {
        try {
            setSavingConfig(true);
            await saveMultipleConfigs({
                id: documentId,
                configFiles: configFiles,
            });
            setConfigError(null);
        } catch (err) {
            setConfigError("Failed to save configuration: " + (err as Error).message);
        } finally {
            setSavingConfig(false);
        }
    };

    const getEditorLanguage = (path: string) => {
        const extension = path.split('.').pop()?.toLowerCase();
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

    const getConfigDisplayName = (config: ConfigFile) => {
        if (config.isDirectory) {
            // For config directory files, show the relative path from config/
            return config.path.replace(/^config\//, "");
        }
        return config.name;
    };

    const getConfigCategory = (config: ConfigFile) => {
        if (config.isDirectory) {
            const pathParts = config.path.split('/');
            if (pathParts.length > 1) {
                return pathParts[1]; // e.g., "_default", "production", "staging"
            }
        }
        return "Root";
    };

    const groupedConfigs = configFiles.reduce((acc, config) => {
        const category = getConfigCategory(config);
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(config);
        return acc;
    }, {} as Record<string, ConfigFile[]>);

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
                    {configError}<br />
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

    const activeConfig = configFiles.find(config => config.path === activeConfigTab);

    return ( 
        <div className="pb-40">
            <div className="md:max-w-5xl lg:max-w-6xl mx-auto">
                <div className="p-6 border rounded bg-muted">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold">Site Configuration</h2>
                            <p className="text-sm text-muted-foreground">
                                Modify your site settings. Switch between files using the tabs below.
                            </p>
                        </div>
                        <Badge variant="secondary">
                            {configFiles.length} config file{configFiles.length > 1 ? 's' : ''}
                        </Badge>
                    </div>
                    
                    {/* Config File Tabs */}
                    <div className="mb-4">
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(groupedConfigs).map(([category, configs]) => (
                                <div key={category} className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground px-2 py-1 bg-secondary/50 rounded">
                                        {category}
                                    </span>
                                    {configs.map((config) => (
                                        <Button
                                            key={config.path}
                                            variant={activeConfigTab === config.path ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setActiveConfigTab(config.path)}
                                            className="text-xs"
                                        >
                                            {getConfigDisplayName(config)}
                                        </Button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Config Editor */}
                    {activeConfig && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Editing: <code className="bg-secondary px-2 py-1 rounded text-xs">{activeConfig.path}</code>
                                </div>
                            </div>
                            <div className="grid gap-4 py-4 overflow-y-auto" style={{ maxHeight: "500px" }}>
                                <Editor
                                    height="500px"
                                    language={getEditorLanguage(activeConfig.path)}
                                    value={activeConfig.content}
                                    onChange={(value) => handleConfigEditorChange(value, activeConfig.path)}
                                    theme="vs-dark"
                                    options={{
                                        minimap: { enabled: false },
                                        scrollBeyondLastLine: false,
                                        automaticLayout: true,
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end mt-4">
                        <Button 
                            type="button" 
                            onClick={handleConfigSave}
                            disabled={savingConfig}
                        >
                            {savingConfig ? (
                                <>
                                    <div className="mr-2">
                                        <Spinner size="sm" />
                                    </div>
                                    Saving...
                                </>
                            ) : (
                                "Save all changes"
                            )}
                        </Button>
                    </div>
                </div>
            </div>
            <SettingsModal />
        </div>
     );
}
 
export default DocumentIdPage;