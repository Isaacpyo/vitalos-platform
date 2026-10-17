import { navLabels, productPath, routes } from "@vitalos/cms";
import type { ProductView, RoutePageView } from "@vitalos/cms";
import { Button, Icon } from "@vitalos/ui";
import { MediaSlot } from "../../components/media-slot";
import { isMediaSlotId } from "../../content/media-slots";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { Band, ClosingBand, PageIntro, renderBands } from "../commercial/bands";
import { PageMain } from "../institutional/page-main";

/**
 * The Products section (owner direction, 17 Oct 2026), in the site's patterns: the compact dark
 * hero, one band, and the closing "Talk to Vitalos" card. Every word comes from `@vitalos/cms`
 * (products.ts and the Products route page); the snapshot is the `products.{slug}.hero` slot.
 */

export const productsTrail = () => trail({ label: navLabels.products, path: routes.products() });

export const productTrail = (product: ProductView) =>
  trail(
    { label: navLabels.products, path: routes.products() },
    { label: product.name, path: productPath(product) },
  );

/** The product's snapshot: its `products.{slug}.hero` slot, or nothing when none is registered. */
function ProductSnapshot({ product, sizes }: Readonly<{ product: ProductView; sizes: string }>) {
  const id = `products.${product.slug}.hero`;
  return isMediaSlotId(id) ? <MediaSlot id={id} sizes={sizes} /> : null;
}

/** One product as a card: the snapshot, the name, one line and the link to its page. */
function ProductCard({ product }: Readonly<{ product: ProductView }>) {
  return (
    <article className="group relative flex h-full min-w-0 flex-col gap-(--space-5) overflow-hidden rounded-2xl border border-tone-border bg-tone-bg p-(--space-5) transition-[border-color,translate] duration-(--duration-feedback) ease-(--ease-emphasis) focus-within:-translate-y-1 focus-within:border-tone-action hover:-translate-y-1 hover:border-tone-action motion-reduce:focus-within:translate-y-0 motion-reduce:hover:translate-y-0">
      <ProductSnapshot product={product} sizes="(min-width: 1024px) 40vw, 92vw" />
      <div className="flex min-w-0 flex-1 flex-col gap-(--space-3)">
        <h2 className="m-0 text-h3 text-balance text-tone-heading">{product.name}</h2>
        <p className="m-0 text-body text-pretty text-tone-text">{product.summary}</p>
        <a
          href={productPath(product)}
          className="mt-auto inline-flex min-h-11 items-center gap-(--space-2) self-start text-small font-semibold text-tone-link no-underline after:absolute after:inset-0 after:content-[''] hover:underline"
        >
          {product.viewLabel}
          <Icon
            name="arrow-right"
            size={16}
            className="transition-transform duration-(--duration-feedback) ease-(--ease-standard) group-hover:translate-x-0.5"
          />
        </a>
      </div>
    </article>
  );
}

export function ProductsIndexTemplate({
  page,
  products,
}: Readonly<{ page: RoutePageView | null; products: readonly ProductView[] }>) {
  return (
    <PageMain>
      <PageIntro
        crumbs={productsTrail()}
        compact
        title={page?.heading ?? navLabels.products}
        lead={page?.intro}
      />
      {renderBands(
        [
          (tone) =>
            products.length > 0 ? (
              <Band tone={tone}>
                <ul className="m-0 grid list-none grid-cols-1 gap-(--space-4) p-0 lg:grid-cols-2">
                  {products.map((product) => (
                    <li key={product.slug} className="min-w-0">
                      <ProductCard product={product} />
                    </li>
                  ))}
                </ul>
              </Band>
            ) : null,
        ],
        "light",
      )}
      <ClosingBand />
    </PageMain>
  );
}

export function ProductTemplate({ product }: Readonly<{ product: ProductView }>) {
  return (
    <PageMain>
      <PageIntro
        crumbs={productTrail(product)}
        compact
        eyebrow={navLabels.products}
        title={product.name}
        lead={product.description}
        actions={
          // Its own site, in the same tab: it is a Vitalos product.
          <Button href={product.url} rel="noopener" size="lg" arrow>
            {product.urlLabel}
          </Button>
        }
      />
      {renderBands(
        [
          (tone) => (
            <Band tone={tone}>
              <figure className="mx-auto my-0 max-w-[64rem]">
                <ProductSnapshot product={product} sizes="(min-width: 70rem) 64rem, 92vw" />
                <figcaption className="mt-(--space-4) max-w-(--container-prose) text-small text-pretty text-tone-muted">
                  {product.snapshotCaption}
                </figcaption>
              </figure>
            </Band>
          ),
        ],
        "light",
      )}
      <ClosingBand />
    </PageMain>
  );
}
