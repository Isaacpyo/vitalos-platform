import type { Metadata } from "next";
import { navLabels, products, routes } from "@vitalos/cms";
import { JsonLd } from "../../../src/components/json-ld";
import { loadRoutePage } from "../../../src/templates/commercial/load";
import { pageGraph, pageMetadata } from "../../../src/templates/commercial/seo";
import {
  ProductsIndexTemplate,
  productsTrail,
} from "../../../src/templates/products/ProductsTemplates";

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadRoutePage("products");
  return pageMetadata({
    path: routes.products(),
    title: page?.heading ?? navLabels.products,
    seo: page?.seo,
  });
}

export default async function ProductsPage() {
  const page = await loadRoutePage("products");
  return (
    <>
      <JsonLd
        data={pageGraph({
          trail: productsTrail(),
          name: page?.heading ?? navLabels.products,
          description: page?.intro,
          type: "CollectionPage",
        })}
      />
      <ProductsIndexTemplate page={page} products={products} />
    </>
  );
}
