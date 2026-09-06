import StorefrontLayout from "@/components/StorefrontLayout";
import { PartnerServicesShelf } from "@/components/PartnerServicesShelf";
import { Reveal } from "@/components/Reveal";

export default function Topup() {
  return (
    <StorefrontLayout>
      <main className="zp-page">
        <Reveal as="section" index={0}>
          <PartnerServicesShelf />
        </Reveal>
      </main>
    </StorefrontLayout>
  );
}
