
import Head from "next/head";
import dynamic from "next/dynamic";

const Turniejownik = dynamic(() => import("../components/Turniejownik"), { ssr: false });

export default function Home() {
  return (
    <>
      <Head>
        <title>Turniejownik</title>
      </Head>
      <main className="min-h-screen p-4 bg-gray-100">
        <Turniejownik />
      </main>
    </>
  );
}
