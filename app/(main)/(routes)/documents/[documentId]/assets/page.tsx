"use client";

import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { FilePond, registerPlugin } from "react-filepond";
import { FilePondFile, FilePondErrorDescription } from 'filepond';
import FilePondPluginFileEncode from 'filepond-plugin-file-encode';
import 'filepond/dist/filepond.min.css';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Upload, Image as ImageIcon, File } from "lucide-react";
import Image from "next/image";

registerPlugin(FilePondPluginFileEncode);

interface AssetItem {
  path: string;
  type: 'tree' | 'blob';
  sha: string;
  size?: number;
  name: string;
}

const generateUniqueFilename = (originalFilename: string): string => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = originalFilename.split('.').pop();
  const nameWithoutExtension = originalFilename.slice(0, originalFilename.lastIndexOf('.'));
  return `${nameWithoutExtension}-${timestamp}-${randomString}.${extension}`;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (path: string) => {
  const extension = path.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension || '')) {
    return ImageIcon;
  }
  return File;
};

export default function AssetsPage() {
  const params = useParams();
  const documentId = params.documentId as Id<"documents">;
  
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  const document = useQuery(api.documents.getById, { documentId });
  const fetchAssetsTree = useAction(api.github.fetchAssetsTree);
  const uploadImage = useAction(api.github.uploadImage);
  const deleteAsset = useAction(api.github.deleteAsset);

  const loadAssets = async () => {
    if (!documentId) return;
    
    setIsLoading(true);
    try {
      const result = await fetchAssetsTree({ id: documentId });
      
      if (result && result.length > 0) {
        const processedAssets = result
          .filter((item: any) => item.type === 'blob') // Only show files, not folders
          .map((item: any) => ({
            path: item.path,
            type: item.type,
            sha: item.sha,
            size: item.size || 0,
            name: item.path.split('/').pop() || item.path,
          }));
        setAssets(processedAssets);
      } else {
        setAssets([]);
      }
    } catch (error) {
      console.error("Failed to load assets:", error);
      toast.error("Failed to load assets");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (documentId && document?.buildStatus === "BUILT") {
      loadAssets();
    }
  }, [documentId, document?.buildStatus]);

  const handleUpload = async (error: FilePondErrorDescription | null, fileItem: FilePondFile) => {
    if (error || !documentId) return;

    const promise = (async () => {
      const uniqueFilename = generateUniqueFilename(fileItem.filename);
      await uploadImage({
        id: documentId,
        file: fileItem.getFileEncodeBase64String(),
        filename: uniqueFilename
      });
      
      // Refresh the assets list
      await loadAssets();
      setUploadFiles([]);
    })();

    toast.promise(promise, {
      loading: "Uploading asset...",
      success: "Asset uploaded successfully!",
      error: "Failed to upload asset."
    });
  };

  const handleDelete = async (assetPath: string) => {
    if (!documentId) return;

    const confirmDelete = window.confirm("Are you sure you want to delete this asset? This action cannot be undone.");
    if (!confirmDelete) return;

    const promise = (async () => {
      await deleteAsset({
        id: documentId,
        filePath: assetPath.startsWith('static/') || assetPath.startsWith('assets/') ? assetPath : `static/${assetPath}`,
      });
      
      // Refresh the assets list
      await loadAssets();
    })();

    toast.promise(promise, {
      loading: "Deleting asset...",
      success: "Asset deleted successfully!",
      error: "Failed to delete asset."
    });
  };

  if (!documentId) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <p className="text-muted-foreground">No document selected.</p>
      </div>
    );
  }

  if (document?.buildStatus === "BUILDING") {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <Spinner />
        <p className="text-muted-foreground">Creating site...</p>
      </div>
    );
  }

  if (document?.buildStatus === "ERROR") {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <p className="text-muted-foreground">Site build failed. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="h-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="text-muted-foreground">
            Manage your website's media files and assets
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Upload Section */}
        <Card className="bg-muted">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload New Asset
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FilePond
              files={uploadFiles}
              allowMultiple={false}
              allowReplace={true}
              onaddfile={handleUpload}
              acceptedFileTypes={['image/*', 'application/pdf', 'text/*']}
              maxFiles={1}
              maxFileSize="5MB"
              labelIdle='Drag & Drop files here or <span class="filepond--label-action">Browse</span><br /><span class="text-sm text-muted-foreground">Max file size: 5MB</span>'
            />
            <div className="h-6" /> {/* Spacer for PQINA attribution */}
          </CardContent>
        </Card>

        {/* Assets Table */}
        <Card className="bg-muted">
          <CardHeader>
            <CardTitle>All Assets ({assets.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : assets.length === 0 ? (
              <div className="text-center py-8">
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No assets found. Upload your first asset above.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => {
                    const extension = asset.path.split('.').pop()?.toLowerCase();
                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension || '');
                    const imageUrl = isImage 
                      ? `https://raw.githubusercontent.com/hugotion/${documentId}/refs/heads/main/${asset.path}`
                      : null;
                    return (
                      <TableRow key={`${asset.path}-${asset.sha}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {isImage && imageUrl ? (
                              <div className="relative w-10 h-10 rounded overflow-hidden">
                                <Image
                                  src={`${imageUrl}?w=40&q=50`}
                                  alt={asset.name}
                                  fill
                                  className="object-cover"
                                  sizes="40px"
                                  priority={false}
                                  quality={1}
                                />
                              </div>
                            ) : (
                              <span className="inline-flex items-center justify-center w-10 h-10 bg-accent rounded">
                                <File className="h-6 w-6 text-muted-foreground" />
                              </span>
                            )}
                            <div>
                              <p className="font-medium">{asset.name}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {asset.path.split('.').pop()?.toUpperCase() || 'FILE'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatFileSize(asset.size || 0)}
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {asset.path}
                          </code>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(asset.path)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 