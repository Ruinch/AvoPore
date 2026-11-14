const unsplash = { name: "Unsplash License", url: "https://unsplash.com/license" };

export const workshopPhotos = {
  hero: {
    label: "Pottery wheel",
    src: "/images/pottery-wheel.webp",
    alt: "A potter shaping a clay bowl on a wheel in a ceramics studio",
    photographer: "Laura Tommasina",
    source: "https://unsplash.com/photos/woman-shaping-clay-on-a-pottery-wheel-Wksd6I6mSkw",
    license: unsplash,
  },
  ceramics: {
    label: "Ceramics",
    src: "/images/workshop-ceramics.webp",
    alt: "Hand-painted ceramic cups and saucers lined up on a shelf",
    photographer: "Tanya Barrow",
    source: "https://unsplash.com/photos/collection-of-artistic-ceramic-cups-and-saucers-on-shelf-c-N5R35QtfA",
    license: unsplash,
  },
  printmaking: {
    label: "Printmaking",
    src: "/images/workshop-printmaking.webp",
    alt: "Hands pulling ink across a silkscreen frame with a wooden squeegee",
    photographer: "Ahmad Ali Karim",
    source: "https://commons.wikimedia.org/wiki/File:Screen_printing_demonstration_at_TEDxUTM.jpg",
    license: { name: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
  },
  textiles: {
    label: "Textiles",
    src: "/images/workshop-textiles.webp",
    alt: "Threads stretched across the frame of a wooden weaving loom",
    photographer: "Ermell",
    source: "https://commons.wikimedia.org/wiki/File:Nabburg_Freilandmuseum_Kolbeckhof_Webstuhl-20190823-RM-115330.jpg",
    license: { name: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
  },
  painting: {
    label: "Painting",
    src: "/images/workshop-painting.webp",
    alt: "A collection of used paintbrushes with colorful paint on their handles",
    photographer: "RhondaK Native Florida Folk Artist",
    source: "https://unsplash.com/photos/assorted-color-paintbrushes-_Yc7OtfFn-0",
    license: unsplash,
  },
  florals: {
    label: "Floral design",
    src: "/images/workshop-florals.webp",
    alt: "A florist trimming stems with scissors while assembling a bouquet",
    photographer: "direct2Florist",
    source: "https://commons.wikimedia.org/wiki/File:Florist_cutting_stems_with_floristry_scissors.jpg",
    license: { name: "CC BY 2.0", url: "https://creativecommons.org/licenses/by/2.0/" },
  },
};

export function workshopPhoto(key: string) {
  return Object.hasOwn(workshopPhotos, key) ? workshopPhotos[key as keyof typeof workshopPhotos] : workshopPhotos.ceramics;
}
