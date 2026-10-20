// Markdown files import as their raw text (the "*.md" rule in next.config.ts).
declare module "*.md" {
  const text: string;
  export default text;
}
