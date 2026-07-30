// Demo data for the scroll-zoom newspaper (/brand-kit/front-page).
// Example portfolio brands used as articles — illustrative, not billed as
// confirmed deals. Headlines/body are real HTML text (legible); the `image`
// is a Higgsfield engraving "cut".

export type FrontPageArticle = {
  id: string;
  brand: string;
  headline: string;
  deck: string;
  body: string[];
  image: string;
};

export const ARTICLES: FrontPageArticle[] = [
  {
    id: "toto",
    brand: "Toto",
    headline: "Toto Bakes Its Way Onto Shelves",
    deck: "Clean, soft-baked cookies win over a new generation of snackers.",
    body: [
      "The whole-food cookie maker has gone from farmers-market darling to national retail in under two years, betting that shoppers will trade processed snacks for a short, readable ingredient list.",
      "With fresh capital from the Paperboy desk, Toto plans to widen distribution and turn out two new flavors before the holidays.",
    ],
    image: "/front-page/logos-engraved/toto.png",
  },
  {
    id: "cheddies",
    brand: "Cheddies",
    headline: "Cheddies Cracks the Code on Cheese",
    deck: "Organic cheddar crackers crunch into national distribution.",
    body: [
      "Built on real, organic cheddar, the crispy squares have become a lunchbox staple — and a case study in how a single hero SKU can carry a brand.",
    ],
    image: "/front-page/logos-engraved/cheddies.png",
  },
  {
    id: "just-date",
    brand: "Just Date",
    headline: "Just Date Sweetens the Deal",
    deck: "A date-based answer to America's sugar problem.",
    body: [
      "The pantry upstart swaps refined sugar for whole dates, landing on shelves as consumers hunt for cleaner ways to sweeten everything from coffee to cocktails.",
    ],
    image: "/front-page/logos-engraved/just-date.png",
  },
  {
    id: "waku",
    brand: "Waku",
    headline: "Waku Pours On the Prebiotics",
    deck: "Andean herbs, reinvented as a gut-friendly sparkling tea.",
    body: [
      "Rooted in a centuries-old Ecuadorian recipe, Waku is riding the functional-beverage wave with a can that promises flavor first and gut health close behind.",
    ],
    image: "/front-page/logos-engraved/waku.png",
  },
];
