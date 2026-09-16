import { defineField, defineType } from "sanity";
const governed = [
  defineField({
    name: "owner",
    title: "Content owner",
    type: "string",
    validation: (r) => r.required(),
  }),
  defineField({
    name: "reviewDate",
    title: "Review date",
    type: "date",
    validation: (r) => r.required(),
  }),
];
function entity(name: string, title: string) {
  return defineType({
    name,
    title,
    type: "document",
    fields: [
      defineField({
        name: "title",
        title: "Title",
        type: "string",
        validation: (r) => r.required(),
      }),
      defineField({
        name: "slug",
        title: "Slug",
        type: "slug",
        options: { source: "title" },
        validation: (r) => r.required(),
      }),
      defineField({
        name: "summary",
        title: "Summary",
        type: "text",
        validation: (r) => r.max(320),
      }),
      ...governed,
    ],
  });
}
export const schemaTypes = [
  "practice",
  "solution",
  "offer",
  "industry",
  "caseStudy",
  "insight",
  "person",
  "job",
  "siteSettings",
  "redirect",
].map((name) => entity(name, name));
export const labAsset = defineType({
  name: "labAsset",
  title: "Lab asset",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "maturity",
      type: "string",
      options: {
        list: ["research", "concept", "prototype", "accelerator", "beta", "production-product"],
      },
      validation: (r) => r.required(),
    }),
    ...governed,
  ],
});
export const trustItem = defineType({
  name: "trustItem",
  title: "Trust item",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "status", type: "string", validation: (r) => r.required() }),
    defineField({ name: "evidenceAvailable", type: "boolean", initialValue: false }),
    ...governed,
  ],
});
