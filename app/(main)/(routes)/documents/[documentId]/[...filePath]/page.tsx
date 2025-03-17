"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Toolbar } from "@/components/toolbar";
import { Cover } from "@/components/cover";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import { useEffect, useState, useMemo, useCallback, use } from "react";

interface FilePathPageProps {
  params: Promise<{
    documentId: Id<"documents">;
    filePath: [];
  }>;
}

const FilePathPage = ({ params }: FilePathPageProps) => {
  const { documentId, filePath } = use(params);
  const fetchFileContent = useAction(api.github.fetchAndReturnGithubFileContent);

  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const document = useQuery(api.documents.getById, useMemo(() => ({
    documentId: documentId,
  }), [documentId]));

  const Editor = useMemo(() => dynamic(() => import("@/components/editor"), { ssr: false }), []);
  
  const loadContent = useCallback(async () => {
    if (!documentId || !filePath) return;
    try {
      const filePathString = Array.isArray(filePath) ? filePath.join('/') : filePath;
      const fileContent = await fetchFileContent({
        id: documentId,
        path: `content/${filePathString}`,
      });
      const contentSections = fileContent.split('---');
      const actualContent = contentSections[contentSections.length - 1].trim();
      setContent(fileContent);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [documentId, filePath, fetchFileContent]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const update = useMutation(api.documents.update);

  const onChange = useCallback((content: string) => {
    update({
      id: documentId,
      content,
    });
  }, [documentId, update]);

  if (document === undefined || loading) {
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

  if (document === null || error) {
    return <div>Not Found...</div>;
  }

  return (
    <div className="pb-40">
      <Cover url={document.coverImage} />
      <div className="md:max-w-3xl lg:max-w-4xl mx-auto">
        <Toolbar initialData={} />
        <Editor onChange={onChange} initialContent={content} editable={true} />
      </div>
    </div>
  );
};

export default FilePathPage;