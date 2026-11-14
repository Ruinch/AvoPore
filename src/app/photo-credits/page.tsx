import { workshopPhotos } from "@/lib/workshop-photos";

export const metadata = { title: "Photo credits" };

export default function PhotoCredits() {
  return <section className="shell page-section">
    <div className="page-heading">
      <h1 className="display">Photo credits</h1>
      <p>These photographs illustrate the crafts in the AvoPore demo catalog. Images have been resized, converted to WebP, and may be cropped for display.</p>
    </div>
    <ul className="facts-grid">
      {Object.values(workshopPhotos).map((photo) => <li className="border-t border-[var(--line)] pt-3" key={photo.src}>
        <h2>{photo.label}</h2>
        <a className="text-link underline" href={photo.source}>{photo.photographer}</a>
        <span className="muted"> · </span>
        <a className="text-link underline" href={photo.license.url}>{photo.license.name}</a>
      </li>)}
    </ul>
  </section>;
}
