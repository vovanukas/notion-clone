"use client";

import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Toolbar } from "@/components/toolbar";
import { Cover } from "@/components/cover";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import { use, useMemo } from "react";
import Editor from "@monaco-editor/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/spinner";

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

    const update = useMutation(api.documents.update);

    const onChange = (title: string) => {
        update({
            id: documentId,
            title: title,
        });
    };

    // --- Config Editor State and Logic ---
    const router = useRouter();
    const [config, setConfig] = useState<string>("");
    const [configPath, setConfigPath] = useState<string>("");
    const [configLoading, setConfigLoading] = useState<boolean>(true);
    const [configError, setConfigError] = useState<string | null>(null);
    const fetchConfig = useAction(api.github.fetchConfigFile);
    const parseAndSaveSettingsObject = useAction(api.github.parseAndSaveSettingsObject);
    const remove = useMutation(api.documents.remove);
    const deleteRepo = useAction(api.github.deleteRepo);

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
        if (documentId) {
            loadConfig();
        }
    }, [documentId, fetchConfig]);

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

    const handleConfigDelete = async () => {
        try {
            router.push("/documents");
            await Promise.all([
                deleteRepo({ id: documentId }),
                remove({ id: documentId })
            ]);
        } catch (err) {
            setConfigError("Failed to delete repository: " + (err as Error).message);
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
            <div>
                Not Found...
            </div>
        );
    }

    return ( 
        <div className="pb-40">
            <div className="md:max-w-3xl lg:max-w-4xl mx-auto">
                <div className="mt-10 p-6 border rounded bg-muted">
                    <h2 className="text-lg font-semibold mb-2">Site Configuration</h2>
                    <p className="mb-4 text-sm text-muted-foreground">Modify your site settings. Click save when you&apos;re done.</p>
                    {configLoading && <Spinner size="lg" />}
                    {configError && <p style={{ color: "red" }}>Error: {configError}</p>}
                    <div className="grid gap-4 py-4 overflow-y-auto" style={{ maxHeight: "400px" }}>
                        <Editor
                            height="300px"
                            defaultLanguage="ini"
                            language={getEditorLanguage()}
                            value={config}
                            onChange={handleConfigEditorChange}
                            theme="vs-dark"
                        />
                    </div>
                    <div className="flex justify-between mt-4">
                        <Button type="button" variant="destructive" onClick={handleConfigDelete}>
                            Delete Permanently
                        </Button>
                        <Button type="button" onClick={handleConfigSave}>
                            Save changes
                        </Button>
                    </div>
                </div>
            </div>
        </div>
     );
}
 
export default DocumentIdPage;