import Hero from '../components/Landing/Hero';
import FeatureCards from '../components/Landing/FeatureCards';
import HowItWorks from '../components/Landing/HowItWorks';
import ProblemStats from '../components/Landing/ProblemStats';

export default function Landing() {
  return (
    <div className="space-y-10">
      <Hero />
      <ProblemStats />
      <HowItWorks />
      <FeatureCards />
    </div>
  );
}
