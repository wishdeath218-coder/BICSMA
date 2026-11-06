declare module '*.css' {
  const content: string;
  export default content;
}

declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      className?: string;
    }
  }
}
