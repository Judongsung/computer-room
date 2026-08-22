export function downloadFile(url: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
