function element(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function renderOrbit() {
  const orbit = element("div", "orbit-art");
  orbit.setAttribute("aria-hidden", "true");
  for (const [className, text] of [
    ["orbit orbit-one", ""],
    ["orbit orbit-two", ""],
    ["orbit-core", "x"],
    ["orbit-node node-one", "+"],
    ["orbit-node node-two", "∑"],
    ["orbit-node node-three", "×"],
  ]) {
    orbit.append(element("span", className, text));
  }
  return orbit;
}

export function renderHeader({ root, branding, introText, onHome }) {
  root.replaceChildren();
  const siteHeader = element("header", "site-header");
  const homeLink = element("a", "brand");
  homeLink.href = "#home";
  homeLink.setAttribute("aria-label", `Return to ${branding.siteName} home`);
  homeLink.addEventListener("click", onHome);

  const mark = element("span", "brand-mark", branding.logoMark);
  mark.setAttribute("aria-hidden", "true");
  const brandName = element("span", "brand-name");
  const [beforeSlash, afterSlash] = branding.brandText.split("/", 2);
  brandName.append(document.createTextNode(beforeSlash));
  if (afterSlash !== undefined) {
    brandName.append(element("span", "brand-accent", "/"), document.createTextNode(afterSlash));
  }
  homeLink.append(mark, brandName);
  siteHeader.append(homeLink, element("span", "header-note", branding.tagline));
  root.append(siteHeader);

  const heroSection = element("section", "intro");
  heroSection.setAttribute("aria-labelledby", "page-title");
  const copy = element("div", "intro-copy");
  const eyebrow = element("p", "eyebrow");
  const dot = element("span", "eyebrow-dot");
  dot.setAttribute("aria-hidden", "true");
  eyebrow.append(dot, document.createTextNode(` ${branding.eyebrow}`));
  const heading = element("h1");
  heading.id = "page-title";
  heading.append(
    document.createTextNode(branding.headlineLine1),
    document.createElement("br"),
    document.createTextNode(`${branding.headlineLine2} `),
    element("span", "highlight", branding.headlineHighlight),
  );
  const introParagraph = element("p", "intro-text", introText);
  introParagraph.id = "intro-text";
  copy.append(eyebrow, heading, introParagraph);
  heroSection.append(copy);

  if (branding.heroImageUrl) {
    const image = element("img", "hero-image");
    image.src = branding.heroImageUrl;
    image.alt = branding.heroImageAlt || "";
    image.addEventListener("error", () => {
      console.error(`Could not load the configured event header image: ${branding.heroImageUrl}`);
      image.hidden = true;
    }, { once: true });
    heroSection.append(image);
  } else {
    heroSection.append(renderOrbit());
  }
  root.append(heroSection);
  return homeLink;
}
