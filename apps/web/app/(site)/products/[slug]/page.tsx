import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { productBySlug, productPath, products } from "@vitalos/cms";
import { JsonLd } from "../../../../src/components/json-ld";
import { pageGraph, pageMetadata } from "../../../../src/templates/commercial/seo";
import {
  ProductTemplate,
  productTrail,
} from "../../../../src/templates/products/ProductsTemplates";

type Props = { params: Promise<{ slug: string }> };

/** Only the products in `@vitalos/cms` have a page; any other slug is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = productBySlug((await params).slug);
  if (!product) return {};
  return pageMetadata({
    path: productPath(product),
    title: product.seo.title,
    description: product.seo.description,
  });
}

export default async function ProductPage({ params }: Props) {
  const product = productBySlug((await params).slug);
  if (!product) notFound();
  return (
    <>
      <JsonLd
        data={pageGraph({
          trail: productTrail(product),
          name: product.name,
          description: product.description,
          software: {
            name: product.name,
            url: product.url,
            applicationCategory: product.applicationCategory,
          },
        })}
      />
      <ProductTemplate product={product} />
    </>
  );
}
