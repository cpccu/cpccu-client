import BlogHeader from "@/components/BLOG/BlogHeader";
import BlogPostLayout from "@/components/BLOG/BlogPostLayout";
import BlogScrollProvider from "@/Context/BlogScroll/BlogScrollProvider";

export default function Blog() {
  return (
    <BlogScrollProvider>
      <BlogHeader />
      <BlogPostLayout />
    </BlogScrollProvider>
  );
}
