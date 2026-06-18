import { describe, expect, it } from "vitest";
import { discoverLinks, parsePage } from "./parse";

const HTML = `<!doctype html><html><head>
<title>Radiance</title>
<meta name="description" content="Botox & filler">
<meta property="og:title" content="Radiance Med Spa">
<script src="https://connect.facebook.net/en_US/fbevents.js"></script>
<script>fbq('init','123');window.dataLayer=[];</script>
<script type="application/ld+json">{"@type":"MedicalBusiness","name":"Radiance"}</script>
</head><body>
<h1>Botox in Scottsdale</h1><h2>Our Treatments</h2>
<a href="/services/botox">Botox</a><a href="/about">About</a><a href="https://other.com/x">ext</a>
<a href="tel:+14805550100">Call</a>
<form action="/lead"><input name="email" type="email"><input name="phone" type="tel"></form>
<img src="http://insecure.example/x.png">
</body></html>`;

describe("parsePage", () => {
  const p = parsePage(HTML, "https://radiance.com/", 200, { "content-type": "text/html" });

  it("extracts scripts, meta, json-ld, headings, forms, tel", () => {
    expect(p.scripts).toContain("https://connect.facebook.net/en_US/fbevents.js");
    expect(p.inlineScripts.join(" ")).toContain("fbq('init'");
    expect(p.meta["description"]).toBe("Botox & filler");
    expect((p.jsonLd[0] as { "@type": string })["@type"]).toBe("MedicalBusiness");
    expect(p.h1).toEqual(["Botox in Scottsdale"]);
    expect(p.forms[0]!.inputs.map((i) => i.type)).toEqual(["email", "tel"]);
    expect(p.telLinks).toEqual(["+14805550100"]);
  });

  it("flags mixed content on an https page", () => {
    expect(p.mixedContent).toContain("http://insecure.example/x.png");
  });
});

describe("discoverLinks", () => {
  it("returns same-origin med-spa pages only", () => {
    const links = discoverLinks(HTML, "https://radiance.com/");
    expect(links).toContain("https://radiance.com/services/botox");
    expect(links).toContain("https://radiance.com/about");
    expect(links.some((l) => l.includes("other.com"))).toBe(false);
  });
});
