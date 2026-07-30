// Paperboy Ventures' actual Fund I investments, shown as the cycling hero on
// /login and as portfolio entries across the public site. Photo-driven: set
// `image` to a file in public/investments/ to make a slide cinematic;
// otherwise it renders a tasteful `tint`→white gradient with the brand
// wordmark. No AI images.

export type Investment = {
  id: string;
  brand: string;
  sector: string;
  thesis: string;
  tag: string; // e.g. "Fund I"
  href?: string; // the brand's own website
  image?: string; // optional full-bleed photo in public/investments/
  tint?: string; // light accent for the placeholder gradient
};

export const INVESTMENTS: Investment[] = [
  {
    id: "maxines-heavenly",
    brand: "Maxine's Heavenly",
    sector: "Better-for-you cookies",
    thesis: "Homemade-style cookies sweetened by nature — mom's recipe, modernized.",
    tag: "Fund I",
    href: "https://maxinesheavenly.com",
    tint: "#ecdcc4",
  },
  {
    id: "seatopia",
    brand: "Seatopia",
    sector: "Regenerative seafood · DTC",
    thesis: "Lab-tested, farm-raised seafood delivered to your door — zero detectable microplastics.",
    tag: "Fund I",
    href: "https://seatopia.fish",
    tint: "#d6e4e4",
  },
  {
    id: "ripi",
    brand: "Ripi",
    sector: "Chef-crafted frozen pasta",
    thesis: "Restaurant-level ravioli, flash-frozen — on shelf at Whole Foods and Target.",
    tag: "Fund I",
    href: "https://ripifoods.com",
    tint: "#f3e2c8",
  },
];
