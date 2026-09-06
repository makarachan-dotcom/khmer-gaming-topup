export type GameKey = "mlbb" | "free-fire" | "pubg" | "blox";

export type GameProduct = {
  id: GameKey;
  name: string;
  khmerName: string;
  currency: string;
  accent: string;
  icon: string;
  packageLabel: string;
  packages: { id: string; amount: string; price: number; featured?: boolean }[];
};

export const games: GameProduct[] = [
  {
    id: "mlbb", name: "Mobile Legends", khmerName: "Mobile Legends", currency: "Diamonds", accent: "from-[#4468ed] to-[#6c4ee8]", icon: "ML",
    packageLabel: "ពេជ្រ",
    packages: [{ id: "ml-86", amount: "86", price: 1.29 }, { id: "ml-172", amount: "172", price: 2.49 }, { id: "ml-344", amount: "344", price: 4.79, featured: true }, { id: "ml-706", amount: "706", price: 9.69 }],
  },
  {
    id: "free-fire", name: "Free Fire", khmerName: "Free Fire", currency: "Diamonds", accent: "from-[#ef6037] to-[#e5ae2f]", icon: "FF",
    packageLabel: "ពេជ្រ",
    packages: [{ id: "ff-100", amount: "100", price: 0.99 }, { id: "ff-310", amount: "310", price: 2.89 }, { id: "ff-520", amount: "520", price: 4.69, featured: true }, { id: "ff-1060", amount: "1,060", price: 9.19 }],
  },
  {
    id: "pubg", name: "PUBG Mobile", khmerName: "PUBG Mobile", currency: "UC", accent: "from-[#18a6a1] to-[#2068ac]", icon: "UC",
    packageLabel: "UC",
    packages: [{ id: "pg-60", amount: "60", price: 0.99 }, { id: "pg-325", amount: "325", price: 4.89 }, { id: "pg-660", amount: "660", price: 9.39, featured: true }, { id: "pg-1800", amount: "1,800", price: 24.99 }],
  },
  {
    id: "blox", name: "Blox Fruits", khmerName: "Blox Fruits", currency: "Robux", accent: "from-[#9e4ac4] to-[#e867ae]", icon: "BX",
    packageLabel: "កាក់",
    packages: [{ id: "bx-400", amount: "400", price: 4.99 }, { id: "bx-800", amount: "800", price: 9.69 }, { id: "bx-1700", amount: "1,700", price: 19.29, featured: true }, { id: "bx-4500", amount: "4,500", price: 49.49 }],
  },
];


export type MarketplaceListing = {
  id: string;
  type: "sale" | "swap" | "wanted";
  game: string;
  title: string;
  rank: string;
  price?: number;
  description: string;
  createdLabel: string;
};

export const sampleListings: MarketplaceListing[] = [
  { id: "listing-1", type: "sale", game: "Mobile Legends", title: "Mobile Legends — Mythic Account", rank: "Mythic • 82 heroes", price: 89, description: "គណនីលេងផ្ទាល់ មាន skin និង hero ច្រើន។", createdLabel: "បានបង្ហោះថ្មីៗ" },
  { id: "listing-2", type: "swap", game: "Free Fire", title: "Free Fire — Level 68", rank: "Level 68 • Rare bundle", description: "ចង់ដូរជាមួយគណនី PUBG Mobile ដែលមាន UC។", createdLabel: "មុន ២ ម៉ោង" },
  { id: "listing-3", type: "wanted", game: "PUBG Mobile", title: "កំពុងស្វែងរកគណនី PUBG Mobile", rank: "ចង់បានកម្រិត Ace ឡើងទៅ", description: "សូមផ្ញើររូបភាព និងតម្លៃដែលអ្នកចង់លក់។", createdLabel: "មុន ៤ ម៉ោង" },
  { id: "listing-4", type: "sale", game: "Blox Fruits", title: "Blox Fruits — Max Level", rank: "Max Level • Permanent fruits", price: 45, description: "គណនីសម្រាប់អ្នកចូលចិត្ត PvP និង fruit collection។", createdLabel: "ម្សិលមិញ" },
];

export const formatUsd = (value: number) => `$${value.toFixed(2)}`;
