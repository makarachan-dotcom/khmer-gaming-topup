import StorefrontLayout from "@/components/StorefrontLayout";
import { PartnerServicesShelf } from "@/components/PartnerServicesShelf";

export default function Topup() {
  return (
    <StorefrontLayout>
      <main className="zp-page">
        <PartnerServicesShelf />
      </main>
    </StorefrontLayout>
  );
}
