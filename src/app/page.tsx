import { NeuralHomePage } from '@/components/neural/NeuralHomePage';
import { getNeuralGraphProps } from '@/lib/neural-graph-data';
import { isAdmin } from '@/lib/supabase-server';

// ISR configuration - regenerate every hour
export const revalidate = 3600;

export default async function Home() {
  const [{ graph, tagPostLinks, postLinks }, admin] = await Promise.all([
    getNeuralGraphProps(),
    isAdmin(),
  ]);

  return (
    <NeuralHomePage
      initialGraph={graph}
      tagPostLinks={tagPostLinks}
      postLinks={postLinks}
      isAdmin={admin}
    />
  );
}
