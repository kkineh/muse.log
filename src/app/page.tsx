import { NeuralHomePage } from '@/components/neural/NeuralHomePage';
import { getNeuralGraphProps } from '@/lib/neural-graph-data';

// ISR configuration - regenerate every hour
export const revalidate = 3600;

export default async function Home() {
  const { graph, tagPostLinks } = await getNeuralGraphProps();

  return <NeuralHomePage initialGraph={graph} tagPostLinks={tagPostLinks} />;
}
