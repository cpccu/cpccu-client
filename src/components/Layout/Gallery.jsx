import GalleryScrollProvider from "@/Context/GalleryScroll/GalleryScrollProvider";
import GalleryHeader from "@/components/GALLERY/GalleryHeader";
import GalleryMain from "@/components/GALLERY/GalleryMain";

export default function Gallery() {
  return (
    <GalleryScrollProvider>
      <GalleryHeader />
      <GalleryMain />
    </GalleryScrollProvider>
  );
}
