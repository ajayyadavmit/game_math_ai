function element(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function renderFooter({ root, branding }) {
  root.replaceChildren();

  const learningFooter = element("section", "learning-footer");
  learningFooter.setAttribute("aria-label", "Learning approach");
  const star = element("span", "footer-star", branding.footerIcon);
  star.setAttribute("aria-hidden", "true");
  learningFooter.append(star, element("p", "", branding.footerMessage));
  if (branding.footerTagline) {
    learningFooter.append(element("span", "footer-tag", branding.footerTagline));
  }

  const siteFooter = element("footer", "site-footer");
  siteFooter.append(
    element("span", "", branding.siteName),
    element("span", "", branding.footerClosing),
  );
  root.append(learningFooter, siteFooter);
}
