import { BrandMark } from "@/components/BrandMark";

/** The public site's footer, shared by every marketing page. */
export function SiteFooter() {
  return (
    <div className="pad home-footer">
      <BrandMark variant="footer" href={null} />
      <div className="copyright">© {new Date().getFullYear()} Kelo</div>
    </div>
  );
}
