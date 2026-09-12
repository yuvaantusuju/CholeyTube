import Downloader from "./_components/Downloader";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Downloader />
    </main>
  );
}
