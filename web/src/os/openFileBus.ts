// Tiny event bus so the Files app (rendered without props) can ask the Desktop
// to open a file in the center Editor view.
export interface OpenFileRequest {
  path: string;
  name: string;
  kind: "text" | "image";
}

type Listener = (req: OpenFileRequest) => void;

const listeners = new Set<Listener>();

export function openFile(req: OpenFileRequest) {
  listeners.forEach((l) => l(req));
}

export function onOpenFile(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

// Map a filename to a rough kind for the editor/preview.
const imageExt = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"];
export function fileKind(name: string): "text" | "image" {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return imageExt.includes(ext) ? "image" : "text";
}
